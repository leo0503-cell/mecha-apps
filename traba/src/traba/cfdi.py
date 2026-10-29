"""Lectura local de campos; no valida timbrado, vigencia SAT ni firmas."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from decimal import Decimal
from pathlib import Path

from traba.modelos import Factura, Fuente, Pago

NS = {
    "cfdi": "http://www.sat.gob.mx/cfd/4",
    "tfd": "http://www.sat.gob.mx/TimbreFiscalDigital",
    "pago20": "http://www.sat.gob.mx/Pagos20",
}


def decimal(valor: str) -> Decimal:
    numero = Decimal(valor)
    if not numero.is_finite() or numero < 0:
        raise ValueError("El monto debe ser finito y no negativo")
    return numero


def leer_cfdi(
    ruta: Path, archivo: str | None = None
) -> tuple[Factura | None, list[Pago]]:
    contenido = ruta.read_bytes()
    # UTF-16/32 intercala ceros; no debe evadir el rechazo de DTD/entidades.
    declaracion = contenido.replace(b"\x00", b"").upper()
    if b"<!DOCTYPE" in declaracion or b"<!ENTITY" in declaracion:
        raise ValueError("XML con entidades o DTD no permitido")
    raiz = ET.fromstring(contenido)
    if raiz.tag != f"{{{NS['cfdi']}}}Comprobante" or raiz.get("Version") != "4.0":
        raise ValueError("Se requiere CFDI 4.0")
    archivo = archivo or ruta.name
    timbre = raiz.find("cfdi:Complemento/tfd:TimbreFiscalDigital", NS)
    if timbre is None or not timbre.get("UUID"):
        raise ValueError("Falta UUID en TimbreFiscalDigital")
    uuid = timbre.attrib["UUID"].upper()
    fuentes = [Fuente(archivo, "TimbreFiscalDigital/@UUID", uuid)]
    fuentes.extend(
        Fuente(archivo, f"Comprobante/@{k}", v) for k, v in raiz.attrib.items()
    )
    emisor = raiz.find("cfdi:Emisor", NS)
    receptor = raiz.find("cfdi:Receptor", NS)
    if emisor is None or receptor is None:
        raise ValueError("Falta Emisor o Receptor")
    for nombre, nodo in (("Emisor", emisor), ("Receptor", receptor)):
        fuentes.extend(
            Fuente(archivo, f"{nombre}/@{k}", v) for k, v in nodo.attrib.items()
        )
    pagos = []
    for i, pago in enumerate(
        raiz.findall("cfdi:Complemento/pago20:Pagos/pago20:Pago", NS)
    ):
        for j, doc in enumerate(pago.findall("pago20:DoctoRelacionado", NS)):
            campos = [
                Fuente(archivo, f"Pago[{i + 1}]/@FechaPago", pago.get("FechaPago", "")),
                Fuente(archivo, "TimbreFiscalDigital/@UUID", uuid),
            ]
            campos.extend(
                Fuente(archivo, f"Pago[{i + 1}]/DoctoRelacionado[{j + 1}]/@{k}", v)
                for k, v in doc.attrib.items()
            )
            pagos.append(
                Pago(
                    uuid,
                    doc.attrib["IdDocumento"].upper(),
                    decimal(doc.attrib["ImpPagado"]),
                    doc.attrib["MonedaDR"],
                    decimal(doc.attrib["ImpSaldoAnt"]),
                    decimal(doc.attrib["ImpSaldoInsoluto"]),
                    pago.get("FechaPago", ""),
                    campos,
                )
            )
    if raiz.get("TipoDeComprobante") == "P":
        if not pagos:
            raise ValueError("Complemento de pago sin documentos relacionados")
        return None, pagos
    if raiz.get("TipoDeComprobante") != "I":
        raise ValueError("Sólo se procesan facturas de ingreso y complementos de pago")
    conceptos = []
    for i, concepto in enumerate(raiz.findall("cfdi:Conceptos/cfdi:Concepto", NS)):
        conceptos.append(dict(concepto.attrib))
        fuentes.extend(
            Fuente(archivo, f"Conceptos/Concepto[{i + 1}]/@{k}", v)
            for k, v in concepto.attrib.items()
        )
    # Campo operativo aportado por el cliente; no valida requisitos fiscales.
    oc_nodo = raiz.find("cfdi:Addenda/OrdenCompra", NS)
    oc = oc_nodo.get("Numero", "") if oc_nodo is not None else ""
    if oc:
        fuentes.append(Fuente(archivo, "Addenda/OrdenCompra/@Numero", oc))
    return Factura(
        uuid,
        raiz.get("Folio", ""),
        raiz.get("Serie", ""),
        raiz.get("Fecha", ""),
        dict(emisor.attrib),
        dict(receptor.attrib),
        decimal(raiz.attrib["Total"]),
        raiz.attrib["Moneda"],
        conceptos,
        oc,
        fuentes,
    ), pagos
