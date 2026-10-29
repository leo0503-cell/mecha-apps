from __future__ import annotations

import csv
import xml.etree.ElementTree as ET
from decimal import Decimal
from pathlib import Path
from uuid import NAMESPACE_DNS, uuid5

from traba.cfdi import NS

RFC = "EKU9003173C9"


def identificador(nombre: str) -> str:
    return str(uuid5(NAMESPACE_DNS, f"traba.demostracion.{nombre}")).upper()


def xml_factura(i: int, monto: Decimal, moneda: str, oc: str) -> ET.Element:
    raiz = ET.Element(
        f"{{{NS['cfdi']}}}Comprobante",
        {
            "Version": "4.0",
            "Serie": "DEMO",
            "Folio": str(i),
            "Fecha": "2026-09-01T12:00:00",
            "TipoDeComprobante": "I",
            "SubTotal": str(monto),
            "Total": str(monto),
            "Moneda": moneda,
            "MetodoPago": "PPD",
            "Exportacion": "01",
            "LugarExpedicion": "00000",
        },
    )
    ET.SubElement(
        raiz,
        f"{{{NS['cfdi']}}}Emisor",
        {
            "Rfc": RFC,
            "Nombre": "Proveedor Inventado Nube de Cartón",
            "RegimenFiscal": "601",
        },
    )
    ET.SubElement(
        raiz,
        f"{{{NS['cfdi']}}}Receptor",
        {
            "Rfc": RFC,
            "Nombre": "Cliente Inventado Tornillo Lunar",
            "DomicilioFiscalReceptor": "00000",
            "RegimenFiscalReceptor": "601",
            "UsoCFDI": "G03",
        },
    )
    conceptos = ET.SubElement(raiz, f"{{{NS['cfdi']}}}Conceptos")
    ET.SubElement(
        conceptos,
        f"{{{NS['cfdi']}}}Concepto",
        {
            "ClaveProdServ": "01010101",
            "Cantidad": "1",
            "ClaveUnidad": "H87",
            "Descripcion": "Producto ficticio · datos de demostración",
            "ValorUnitario": str(monto),
            "Importe": str(monto),
            "ObjetoImp": "01",
        },
    )
    complemento = ET.SubElement(raiz, f"{{{NS['cfdi']}}}Complemento")
    ET.SubElement(
        complemento,
        f"{{{NS['tfd']}}}TimbreFiscalDigital",
        {
            "Version": "1.1",
            "UUID": identificador(f"factura-{i}"),
            "FechaTimbrado": "2026-09-01T12:00:00",
        },
    )
    if oc:
        addenda = ET.SubElement(raiz, f"{{{NS['cfdi']}}}Addenda")
        ET.SubElement(addenda, "OrdenCompra", {"Numero": oc})
    return raiz


def guardar_xml(ruta: Path, raiz: ET.Element) -> None:
    ET.indent(raiz)
    ET.ElementTree(raiz).write(ruta, encoding="utf-8", xml_declaration=True)


def complemento(
    i: int, monto: Decimal, moneda: str, parcial: bool = False
) -> ET.Element:
    raiz = xml_factura(i, Decimal("0"), "XXX", "")
    raiz.set("TipoDeComprobante", "P")
    raiz.set("Folio", f"P{i}")
    raiz.attrib.pop("MetodoPago")
    receptor = raiz.find("cfdi:Receptor", NS)
    receptor.set("UsoCFDI", "CP01")
    concepto = raiz.find("cfdi:Conceptos/cfdi:Concepto", NS)
    concepto.attrib.update(
        {
            "ClaveProdServ": "84111506",
            "ClaveUnidad": "ACT",
            "Descripcion": "Pago ficticio · datos de demostración",
        }
    )
    timbre = raiz.find("cfdi:Complemento/tfd:TimbreFiscalDigital", NS)
    timbre.set("UUID", identificador(f"pago-{i}"))
    contenedor = raiz.find("cfdi:Complemento", NS)
    pagos = ET.SubElement(contenedor, f"{{{NS['pago20']}}}Pagos", {"Version": "2.0"})
    pagado = monto / 2 if parcial else monto
    ET.SubElement(pagos, f"{{{NS['pago20']}}}Totales", {"MontoTotalPagos": str(pagado)})
    pago = ET.SubElement(
        pagos,
        f"{{{NS['pago20']}}}Pago",
        {
            "FechaPago": "2026-09-15T12:00:00",
            "FormaDePagoP": "03",
            "MonedaP": moneda,
            "Monto": str(pagado),
        },
    )
    ET.SubElement(
        pago,
        f"{{{NS['pago20']}}}DoctoRelacionado",
        {
            "IdDocumento": identificador(f"factura-{i}"),
            "MonedaDR": moneda,
            "EquivalenciaDR": "1",
            "NumParcialidad": "1",
            "ImpSaldoAnt": str(monto),
            "ImpPagado": str(pagado),
            "ImpSaldoInsoluto": str(monto - pagado),
            "ObjetoImpDR": "01",
        },
    )
    return raiz


def escribir_csv(ruta: Path, filas: list[dict[str, str]]) -> None:
    campos = list(dict.fromkeys(k for fila in filas for k in fila))
    with ruta.open("w", encoding="utf-8", newline="") as archivo:
        escritor = csv.DictWriter(archivo, fieldnames=campos)
        escritor.writeheader()
        escritor.writerows(filas)


def generar(destino: Path) -> None:
    if (
        destino.exists()
        and any(destino.iterdir())
        and not (destino / "DATOS_DE_DEMOSTRACION.txt").exists()
    ):
        raise ValueError(
            "La carpeta contiene archivos ajenos a la demo; elige otra carpeta"
        )
    for nombre in ("xml", "evidencias"):
        (destino / nombre).mkdir(parents=True, exist_ok=True)
    (destino / "DATOS_DE_DEMOSTRACION.txt").write_text(
        "DATOS DE DEMOSTRACIÓN. Nombres, montos, fechas y UUID ficticios.\n"
        "RFC de prueba EKU9003173C9. XML sin sello ni validez fiscal.\n",
        encoding="utf-8",
    )
    cartera, pedidos = [], []
    for i in range(1, 26):
        monto = Decimal(1000 + i * 137).quantize(Decimal("0.01"))
        moneda = "USD" if i == 23 else "MXN"
        oc = f"OC-DEMO-{i:03d}"
        if i in {7, 8, 24, 25}:
            oc = ""
        guardar_xml(
            destino / "xml" / f"factura-{i:02d}.xml", xml_factura(i, monto, moneda, oc)
        )
        fila = {
            "uuid": identificador(f"factura-{i}"),
            "folio": f"DEMO{i}",
            "rfc": RFC,
            "monto": str(monto),
            "moneda": moneda,
            "saldo": str(monto),
            "vencimiento": "2026-09-30",
            "pago_conciliado": "no",
            "complemento_uuid": "",
            "referencia_conciliacion": "",
        }
        if i != 25:
            cartera.append(fila)
        if oc:
            pedidos.append(
                {
                    "uuid": fila["uuid"],
                    "folio": fila["folio"],
                    "oc": "OC-OTRA-009" if i in {9, 10} else oc,
                    "rfc": RFC,
                    "monto": str(monto + 99) if i in {11, 12} else str(monto),
                    "moneda": moneda,
                }
            )
        contenido = f"Datos de demostración.\nUUID: {fila['uuid']}\nFolio: DEMO{i}\n"
        if i in {1, 2, 3, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23}:
            contenido += "Acuse de entrega firmado.\n"
        if i in {4, 5, 6}:
            contenido += "Rechazo: falta acuse de entrega.\n"
        if i in {7, 8}:
            contenido += "Rechazo: falta orden de compra.\n"
        if i in {9, 10}:
            contenido += "Rechazo: pedido no coincide.\n"
        if i in {11, 12}:
            contenido += "Rechazo: monto distinto.\n"
        if i in {13, 14, 15, 23}:
            contenido += "Factura aceptada por Cliente Inventado Tornillo Lunar.\n"
        if i in {19, 20}:
            contenido += "Expediente recibido por la contraparte.\n"
        if i == 21:
            contenido += "Pago reportado; factura no aceptada.\n"
            fila["pago_conciliado"] = "si"  # No hay REP: jamás confirmar pago.
        if i == 22:
            contenido += "Pago parcial reportado.\n"
        if i in {1, 2, 3, 22}:
            guardar_xml(
                destino / "xml" / f"pago-{i:02d}.xml",
                complemento(i, monto, moneda, i == 22),
            )
            fila.update(
                {
                    "pago_conciliado": "si",
                    "complemento_uuid": identificador(f"pago-{i}"),
                    "referencia_conciliacion": f"Conciliación ficticia DEMO-{i}",
                }
            )
            fila["saldo"] = str(monto / 2) if i == 22 else "0.00"
        if i == 24:
            pedidos.extend(
                {
                    "oc": f"OC-AMBIGUA-{letra}",
                    "rfc": RFC,
                    "monto": str(monto),
                    "moneda": moneda,
                }
                for letra in ("A", "B")
            )
            contenido = "Datos de demostración.\nFolio: DEMO24\nFactura no aceptada.\n"
        if i == 25:
            continue
        if i % 3 == 0:
            contenido = (
                "Subject: Evidencia ficticia\nFrom: ejemplo@invalid.invalid\n"
                "To: ejemplo@invalid.invalid\n"
                "Content-Type: text/plain; charset=utf-8\n\n" + contenido
            )
            extension = "eml"
        else:
            extension = "txt"
        (destino / "evidencias" / f"soporte-{i:02d}.{extension}").write_text(
            contenido, encoding="utf-8"
        )
    escribir_csv(destino / "cartera.csv", cartera)
    escribir_csv(destino / "pedidos.csv", pedidos)
