"""Una coincidencia de RFC y monto propone un vínculo, nunca lo confirma."""

from __future__ import annotations

from decimal import InvalidOperation

from traba.cfdi import decimal
from traba.fuentes import referencias
from traba.modelos import Factura, Insumos, Vinculo


def vincular(factura: Factura, insumos: Insumos) -> list[Vinculo]:
    resultado = []
    for tipo, registros in (("cartera", insumos.cartera), ("pedido", insumos.pedidos)):
        candidatos = []
        for registro in registros:
            d = registro.datos
            uuid = d.get("uuid", "").upper()
            folio = d.get("folio", "").upper()
            oc = d.get("oc", "").upper()
            criterio = ""
            fuerte = False
            if uuid:
                if uuid != factura.uuid:
                    continue
                criterio, fuerte = "UUID explícito", True
            elif folio:
                if folio not in {factura.folio.upper(), factura.referencia.upper()}:
                    continue
                criterio = "folio"
                fuerte = (
                    sum(
                        folio in {f.folio.upper(), f.referencia.upper()}
                        for f in insumos.facturas
                    )
                    == 1
                )
            elif oc and factura.oc and oc == factura.oc.upper():
                criterio = "orden de compra"
                fuerte = sum(f.oc.upper() == oc for f in insumos.facturas) == 1
            elif d.get("rfc", "").upper() == factura.receptor.get("Rfc", "").upper():
                try:
                    coincide = decimal(d.get("monto", "")) == factura.monto
                except (InvalidOperation, ValueError):
                    coincide = False
                if coincide and d.get("moneda") == factura.moneda:
                    criterio = "RFC + monto + moneda (requiere validación)"
            if not criterio:
                continue
            if (
                d.get("rfc")
                and d["rfc"].upper() != factura.receptor.get("Rfc", "").upper()
            ):
                fuerte = False
            if folio and folio not in {
                factura.folio.upper(),
                factura.referencia.upper(),
            }:
                fuerte = False
            candidatos.append(
                Vinculo(
                    tipo,
                    registro.id,
                    "confirmado" if fuerte else "por confirmar",
                    criterio,
                    registro.fuentes,
                )
            )
        if len(candidatos) > 1:
            for vinculo in candidatos:
                vinculo.nivel = "por confirmar"
                vinculo.criterio += "; varios candidatos"
        resultado.extend(candidatos)
    for evidencia in insumos.evidencias:
        refs = evidencia.referencias
        criterio = ""
        fuerte = False
        if refs["uuid"]:
            if factura.uuid not in refs["uuid"]:
                continue
            criterio = "UUID en evidencia"
            fuerte = len(refs["uuid"]) == 1
        elif refs["folio"] & {factura.folio.upper(), factura.referencia.upper()}:
            criterio = "folio en evidencia"
            fuerte = (
                len(refs["folio"]) == 1
                and sum(
                    bool(refs["folio"] & {f.folio.upper(), f.referencia.upper()})
                    for f in insumos.facturas
                )
                == 1
            )
        elif factura.oc and factura.oc.upper() in refs["oc"]:
            criterio = "orden de compra en evidencia"
            fuerte = (
                len(refs["oc"]) == 1
                and sum(f.oc.upper() == factura.oc.upper() for f in insumos.facturas)
                == 1
            )
        if criterio:
            if refs["folio"] and not refs["folio"] <= {
                factura.folio.upper(),
                factura.referencia.upper(),
            }:
                fuerte = False
            if refs["oc"] and factura.oc and refs["oc"] != {factura.oc.upper()}:
                fuerte = False
            # El nombre sólo sugiere: un archivo llamado aceptada no es una aceptación.
            contenido_identifica = False
            for fuente in evidencia.fuentes:
                if fuente.campo == "nombre de archivo":
                    continue
                referencia = referencias(fuente.valor)
                if (
                    factura.uuid in referencia["uuid"]
                    or referencia["folio"]
                    & {
                        factura.folio.upper(),
                        factura.referencia.upper(),
                    }
                    or (factura.oc and factura.oc.upper() in referencia["oc"])
                ):
                    contenido_identifica = True
            fuerte = fuerte and contenido_identifica
            resultado.append(
                Vinculo(
                    "evidencia",
                    evidencia.id,
                    "confirmado" if fuerte else "por confirmar",
                    criterio,
                    evidencia.fuentes,
                )
            )
    for pago in insumos.pagos:
        if pago.documento == factura.uuid:
            resultado.append(
                Vinculo(
                    "pago",
                    pago.uuid_complemento,
                    "confirmado",
                    "DoctoRelacionado/@IdDocumento",
                    pago.fuentes,
                )
            )
    return resultado
