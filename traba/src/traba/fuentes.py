from __future__ import annotations

import csv
import re
from email import policy
from email.parser import BytesParser
from pathlib import Path

from pypdf import PdfReader

from traba.cfdi import leer_cfdi
from traba.modelos import Evidencia, Fuente, Insumos, Registro

UUID_RE = re.compile(
    r"(?<![\w])([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(?![\w])", re.I
)
REF_RE = re.compile(r"\b(folio|factura|oc|orden de compra)\s*[:#=]?\s*([\w-]+)", re.I)


def referencias(texto: str) -> dict[str, set[str]]:
    refs = {
        "uuid": {m.upper() for m in UUID_RE.findall(texto)},
        "folio": set(),
        "oc": set(),
    }
    for tipo, valor in REF_RE.findall(texto):
        if valor.upper() in {
            "ACEPTADA",
            "NO",
            "RECIBIDA",
            "RECHAZADA",
            "DETENIDA",
            "PENDIENTE",
        }:
            continue
        refs["oc" if tipo.lower() in {"oc", "orden de compra"} else "folio"].add(
            valor.upper()
        )
    return refs


def cargar_csv(ruta: Path) -> list[Registro]:
    registros = []
    with ruta.open(encoding="utf-8-sig", newline="") as archivo:
        lector = csv.DictReader(archivo)
        for i, fila in enumerate(lector, 1):
            if None in fila:
                raise ValueError(f"{ruta.name}: fila {i} con columnas sobrantes")
            datos = {k.strip().lower(): (v or "").strip() for k, v in fila.items()}
            fuentes = [
                Fuente(ruta.name, k, v, lector.line_num) for k, v in datos.items()
            ]
            registros.append(Registro(f"{ruta.name}:{i}", datos, fuentes))
    return registros


def leer_evidencia(ruta: Path, base: Path) -> Evidencia:
    archivo = ruta.relative_to(base).as_posix()
    fuentes = [Fuente(archivo, "nombre de archivo", ruta.stem)]
    bloques = []
    if ruta.suffix.lower() == ".pdf":
        for pagina, hoja in enumerate(PdfReader(ruta).pages, 1):
            bloques.append((f"página {pagina}", hoja.extract_text() or ""))
    elif ruta.suffix.lower() == ".eml":
        mensaje = BytesParser(policy=policy.default).parsebytes(ruta.read_bytes())
        fuentes.append(Fuente(archivo, "asunto", str(mensaje.get("Subject", ""))))
        cuerpo = mensaje.get_body(preferencelist=("plain",))
        bloques.append(("cuerpo del correo", cuerpo.get_content() if cuerpo else ""))
    else:
        bloques.append(("texto", ruta.read_text(encoding="utf-8-sig")))
    for campo, texto in bloques:
        for linea, valor in enumerate(texto.splitlines(), 1):
            # No interpretar respuestas históricas como la postura vigente.
            if re.match(
                r"^(El .+escribió:|On .+wrote:|-----.*mensaje original)", valor, re.I
            ):
                break
            if valor.strip() and not valor.lstrip().startswith(">"):
                fuentes.append(Fuente(archivo, campo, valor, linea))
    texto = "\n".join(f.valor for f in fuentes if f.campo != "nombre de archivo")
    refs = referencias(texto + "\n" + ruta.stem.replace("_", " "))
    return Evidencia(archivo, texto, refs, fuentes)


def cargar(base: Path) -> Insumos:
    insumos = Insumos(demostracion=(base / "DATOS_DE_DEMOSTRACION.txt").exists())
    vistas = set()
    for ruta in sorted(base.rglob("*.xml")):
        if ruta.is_symlink():
            insumos.avisos.append(f"{ruta.name}: enlace simbólico omitido")
            continue
        try:
            factura, pagos = leer_cfdi(ruta, ruta.relative_to(base).as_posix())
            if factura:
                if factura.uuid in vistas:
                    insumos.avisos.append(
                        f"{ruta.name}: UUID repetido; revisar duplicado"
                    )
                    # No elegir silenciosamente una de dos versiones del mismo UUID.
                    insumos.facturas = [
                        f for f in insumos.facturas if f.uuid != factura.uuid
                    ]
                else:
                    insumos.facturas.append(factura)
                    vistas.add(factura.uuid)
            for pago in pagos:
                if pago not in insumos.pagos:
                    insumos.pagos.append(pago)
        except Exception as error:
            insumos.avisos.append(
                f"{ruta.relative_to(base)}: no se pudo leer ({error})"
            )
    for nombre in ("cartera", "pedidos"):
        ruta = base / f"{nombre}.csv"
        if ruta.exists():
            try:
                setattr(insumos, nombre, cargar_csv(ruta))
            except (ValueError, UnicodeError) as error:
                insumos.avisos.append(str(error))
        else:
            insumos.avisos.append(f"Falta {nombre}.csv")
    for ruta in sorted((base / "evidencias").glob("**/*")):
        if (
            ruta.is_file()
            and not ruta.is_symlink()
            and ruta.suffix.lower() in {".txt", ".eml", ".pdf"}
        ):
            try:
                evidencia = leer_evidencia(ruta, base)
                insumos.evidencias.append(evidencia)
                if not evidencia.texto.strip():
                    insumos.avisos.append(
                        f"{evidencia.id}: sin texto legible; requiere revisión/OCR"
                    )
            except Exception as error:
                insumos.avisos.append(f"{ruta.name}: evidencia ilegible ({error})")
    return insumos
