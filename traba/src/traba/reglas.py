from __future__ import annotations

import re
import tomllib
import unicodedata
from dataclasses import asdict
from decimal import InvalidOperation
from pathlib import Path
from typing import Protocol

from traba.cfdi import decimal
from traba.modelos import Factura, Fuente, Insumos, Vinculo

ESTADOS = (
    "pendiente de revisar",
    "vínculo por confirmar",
    "evidencia incompleta",
    "expediente listo para enviar",
    "recibido por la contraparte",
    "aceptado",
    "pago confirmado",
)
ACCIONES = {
    "falta acuse de entrega": "Obtener el acuse de entrega y vincularlo a la factura.",
    "falta orden de compra": "Solicitar la orden de compra del cliente.",
    "pedido no coincide": "Aclarar el pedido con ventas y el cliente.",
    "monto distinto": "Validar monto y moneda contra la orden de compra.",
    "falta aceptación": "Solicitar constancia de aceptación a la contraparte.",
    "vínculo ambiguo": "Revisar los candidatos y confirmar la relación correcta.",
    "pago por conciliar": "Conciliar el pago y documentar el complemento relacionado.",
    "falta liquidez reportada": "Revisar con finanzas la falta de liquidez reportada.",
    "sin motivo documentado": "Revisar el expediente con cuentas por cobrar.",
}


def normalizar(texto: str) -> str:
    return "".join(
        c
        for c in unicodedata.normalize("NFD", texto.lower())
        if not unicodedata.combining(c)
    )


class Clasificador(Protocol):
    """Un modelo futuro sólo propone señales; las reglas controlan los estados."""

    def clasificar(self, fuente: Fuente) -> set[str]: ...


class ClasificadorDeterminista:
    def clasificar(self, fuente: Fuente) -> set[str]:
        if fuente.campo in {"nombre de archivo", "asunto"}:
            return set()
        texto = normalizar(fuente.valor)
        senales = set()
        patrones = {
            "acuse": r"\bacuse de entrega (firmado|confirmado)\b",
            "aceptacion": r"\bfactura aceptada\b|\baceptacion confirmada\b",
            "recibido": r"\bexpediente recibido\b",
            "falta acuse de entrega": r"\bfalta (el )?acuse\b",
            "falta orden de compra": r"\bfalta (la )?(orden de compra|oc)\b",
            "pedido no coincide": r"\b(pedido|oc|orden de compra) no coincide\b",
            "monto distinto": r"\bmonto (distinto|no coincide)\b",
            "falta aceptación": r"\bfalta (la )?aceptacion\b|\bfactura no aceptada\b",
            "falta liquidez reportada": r"\bfalta (de )?liquidez\b",
            "pago_reportado": r"\bpago (reportado|recibido)\b",
        }
        for senal, patron in patrones.items():
            if re.search(patron, texto):
                senales.add(senal)
        # Negaciones, condicionales y preguntas no demuestran un evento positivo.
        if re.search(
            r"\b(no|sin|pendiente|falta|si|cuando|podria|solicitar|solicitamos|borrador)\b|\?",
            texto,
        ):
            senales -= {"acuse", "aceptacion", "recibido"}
        return senales


def configuracion(base: Path) -> dict[str, str]:
    with Path(__file__).with_name("config.toml").open("rb") as archivo:
        responsables = tomllib.load(archivo)["responsables"]
    if (base / "config.toml").exists():
        with (base / "config.toml").open("rb") as archivo:
            responsables.update(tomllib.load(archivo).get("responsables", {}))
    if not all(isinstance(v, str) for v in responsables.values()):
        raise ValueError("Cada responsable en config.toml debe ser texto")
    return responsables


def evaluar(
    factura: Factura,
    insumos: Insumos,
    vinculos: list[Vinculo],
    responsables: dict[str, str],
    clasificador: Clasificador | None = None,
) -> dict:
    clasificador = clasificador or ClasificadorDeterminista()
    hechos = [
        {
            "descripcion": (
                "Factura de ingreso con UUID leído; vigencia fiscal por confirmar."
            ),
            "fuentes": factura.fuentes,
        }
    ]
    inferencias = []
    faltantes = []
    motivos = []
    senales: dict[str, list[Fuente]] = {}
    confirmado = [v for v in vinculos if v.nivel == "confirmado"]
    for vinculo in confirmado:
        if vinculo.tipo == "evidencia":
            for fuente in vinculo.fuentes:
                for senal in clasificador.clasificar(fuente):
                    senales.setdefault(senal, []).append(fuente)
    # Un clasificador externo no puede fabricar aceptación: revalidación determinista.
    verificador = ClasificadorDeterminista()
    for positivo in ("acuse", "aceptacion", "recibido"):
        if positivo in senales:
            senales[positivo] = [
                f for f in senales[positivo] if positivo in verificador.clasificar(f)
            ]
            if not senales[positivo]:
                del senales[positivo]
    for senal, fuentes in sorted(senales.items()):
        hechos.append(
            {"descripcion": f"La evidencia declara: {senal}.", "fuentes": fuentes}
        )
        if senal in ACCIONES:
            motivos.append(senal)
    carteras = [
        r
        for r in insumos.cartera
        if any(v.tipo == "cartera" and v.destino == r.id for v in confirmado)
    ]
    pedidos = [
        r
        for r in insumos.pedidos
        if any(v.tipo == "pedido" and v.destino == r.id for v in confirmado)
    ]
    cartera = carteras[0] if len(carteras) == 1 else None
    pedido = pedidos[0] if len(pedidos) == 1 else None
    if cartera:
        hechos.append(
            {
                "descripcion": "Datos de cartera documentados; saldo sin recalcular.",
                "fuentes": cartera.fuentes,
            }
        )
    else:
        faltantes.append("Cartera vinculada y vencimiento contractual documentado")
    if pedido:
        hechos.append(
            {"descripcion": "Orden de compra vinculada.", "fuentes": pedido.fuentes}
        )
        if factura.oc and pedido.datos.get("oc", "").upper() != factura.oc.upper():
            motivos.append("pedido no coincide")
            hechos.append(
                {
                    "descripcion": (
                        "OC declarada en la factura difiere del pedido vinculado."
                    ),
                    "fuentes": factura.fuentes + pedido.fuentes,
                }
            )
        try:
            if (
                decimal(pedido.datos.get("monto", "")) != factura.monto
                or pedido.datos.get("moneda") != factura.moneda
            ):
                motivos.append("monto distinto")
                hechos.append(
                    {
                        "descripcion": "Monto o moneda de factura difiere del pedido.",
                        "fuentes": factura.fuentes + pedido.fuentes,
                    }
                )
        except (ValueError, InvalidOperation):
            faltantes.append("Monto válido del pedido")
    else:
        motivos.append("falta orden de compra")
        faltantes.append("Orden de compra confirmada")
    if "acuse" not in senales:
        motivos.append("falta acuse de entrega")
        faltantes.append("Acuse de entrega confirmado")
    if "aceptacion" not in senales:
        motivos.append("falta aceptación")
        faltantes.append("Constancia de aceptación de la contraparte")
    dudosos = [v for v in vinculos if v.nivel == "por confirmar"]
    if dudosos:
        motivos.insert(0, "vínculo ambiguo")
        faltantes.append("Validación humana de los vínculos propuestos")
        inferencias.extend(
            {"descripcion": f"Relación propuesta: {v.criterio}.", "fuentes": v.fuentes}
            for v in dudosos
        )
    pagos = [p for p in insumos.pagos if p.documento == factura.uuid]
    conciliados = []
    for pago in pagos:
        hechos.append(
            {
                "descripcion": (
                    "Complemento de pago relacionado; no acredita "
                    "conciliación bancaria por sí solo."
                ),
                "fuentes": pago.fuentes,
            }
        )
        conciliado = (
            cartera is not None
            and cartera.datos.get("pago_conciliado", "").lower() == "si"
            and cartera.datos.get("complemento_uuid", "").upper()
            == pago.uuid_complemento
            and bool(cartera.datos.get("referencia_conciliacion"))
            and pago.moneda == factura.moneda
            and pago.monto > 0
            and pago.saldo_anterior - pago.monto == pago.saldo_insoluto
            and pago.saldo_insoluto == 0
            and pago.saldo_anterior == factura.monto
        )
        if conciliado:
            conciliados.append(pago)
    estado = "evidencia incompleta"
    if not vinculos:
        estado = "pendiente de revisar"
    elif dudosos:
        estado = "vínculo por confirmar"
    elif "aceptacion" in senales and not any(
        m in motivos
        for m in (
            "pedido no coincide",
            "monto distinto",
            "falta liquidez reportada",
            "falta aceptación",
        )
    ):
        estado = "aceptado"
    elif "recibido" in senales:
        estado = "recibido por la contraparte"
    elif (
        pedido
        and "acuse" in senales
        and not any(
            m in senales or m in motivos
            for m in ("pedido no coincide", "monto distinto")
        )
    ):
        estado = "expediente listo para enviar"
    if conciliados and not dudosos:
        estado = "pago confirmado"
        hechos.append(
            {
                "descripcion": (
                    "Pago total relacionado y conciliación explícita de cartera."
                ),
                "fuentes": conciliados[0].fuentes + cartera.fuentes,
            }
        )
    elif (
        pagos
        or "pago_reportado" in senales
        or (cartera and cartera.datos.get("pago_conciliado") == "si")
    ):
        motivos.insert(0 if not dudosos else 1, "pago por conciliar")
        faltantes.append(
            "Complemento válido de liquidación total "
            "y conciliación explícita relacionada"
        )
    if estado in {"aceptado", "pago confirmado"}:
        motivos = []
        # Conservar faltantes operativos visibles aun cuando exista aceptación o pago.
    motivos = list(dict.fromkeys(motivos))
    principal = motivos[0] if motivos else "sin motivo documentado"
    if estado == "pago confirmado":
        accion = (
            "Conservar la conciliación y el expediente; "
            "saldo de cartera sin modificación automática."
        )
    elif estado == "aceptado":
        accion = "Dar seguimiento al pago y documentar su conciliación."
    elif estado == "expediente listo para enviar":
        accion = (
            "Revisar el expediente y enviarlo por el canal autorizado fuera de Traba."
        )
    else:
        accion = ACCIONES[principal]
    inferencias.append(
        {
            "descripcion": f"Siguiente acción sugerida: {accion}",
            "fuentes": [f for v in vinculos for f in v.fuentes],
        }
    )
    return {
        "id": factura.uuid,
        "uuid": factura.uuid,
        "folio": factura.referencia,
        "cliente": factura.receptor.get("Nombre", "<nombre por confirmar>"),
        "rfc": factura.receptor.get("Rfc", "<RFC por confirmar>"),
        "monto": str(factura.monto),
        "moneda": factura.moneda,
        "pedido": pedido.datos.get("oc", "") if pedido else "<por confirmar>",
        "vencimiento": cartera.datos.get("vencimiento") or "<por confirmar>"
        if cartera
        else "<por confirmar>",
        "saldo_cartera": cartera.datos.get("saldo", "<por confirmar>")
        if cartera
        else "<por confirmar>",
        "estado_fiscal": "Vigencia por confirmar; XML local sin consulta SAT",
        "fecha_consulta_fiscal": "<sin consulta>",
        "estado": estado,
        "motivos": motivos,
        "motivo": principal,
        "responsable": responsables.get(principal, "Cuentas por cobrar"),
        "siguiente_accion": accion,
        "hechos_confirmados": hechos,
        "inferencias": inferencias,
        "datos_faltantes": faltantes,
        "vinculos": [asdict(v) for v in vinculos],
        "fuentes": factura.fuentes,
    }
