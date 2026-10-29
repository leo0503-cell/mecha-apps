"""Carga de transcripciones con formato guiado.

Formato de cada línea útil:

    [P:<pregunta>] [mm:ss] <campo>: <texto>

Las líneas que empiezan con `#` son metadatos (`# experto: …`) o comentarios.
Las líneas vacías se ignoran. Cualquier otra línea se reporta como aviso.
"""

from __future__ import annotations

import csv
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Protocol

from relevo.modelos import CAMPOS, Fragmento, Fuente, Practica, Validacion

LINEA = re.compile(
    r"^\[P:(?P<pid>[a-z]+-\d{2})\]\s*\[(?P<minuto>\d{1,2}:\d{2}(?::\d{2})?)\]\s*"
    r"(?P<campo>[^:]+):\s*(?P<texto>.+)$"
)
CAMPOS_EXTRA = ("regla", "marca")
CALIFICACIONES = ("correcto", "parcial", "incorrecto")


class Transcriptor(Protocol):
    """Punto de enchufe para convertir audio en transcripción guiada.

    Aún no hay implementación: la primera versión recibe texto ya transcrito.
    Una implementación debe devolver líneas con el formato de este módulo.
    """

    def transcribir(self, audio: Path) -> str: ...


@dataclass
class Insumos:
    fragmentos: list[Fragmento] = field(default_factory=list)
    metadatos: dict[str, str] = field(default_factory=dict)
    validaciones: list[Validacion] = field(default_factory=list)
    practicas: list[Practica] = field(default_factory=list)
    avisos: list[str] = field(default_factory=list)
    demostracion: bool = False


def normalizar(campo: str) -> str:
    sin_acentos = unicodedata.normalize("NFKD", campo.strip().lower())
    return "".join(c for c in sin_acentos if not unicodedata.combining(c))


def leer_transcripcion(ruta: Path, insumos: Insumos) -> None:
    for numero, linea in enumerate(ruta.read_text(encoding="utf-8").splitlines(), 1):
        linea = linea.strip()
        if not linea:
            continue
        if linea.startswith("#"):
            if ":" in linea:
                clave, valor = linea[1:].split(":", 1)
                insumos.metadatos.setdefault(clave.strip().lower(), valor.strip())
            continue
        coincidencia = LINEA.match(linea)
        if not coincidencia:
            insumos.avisos.append(f"{ruta.name} línea {numero}: formato no reconocido")
            continue
        campo = normalizar(coincidencia["campo"])
        if campo not in CAMPOS and campo not in CAMPOS_EXTRA:
            insumos.avisos.append(
                f"{ruta.name} línea {numero}: campo desconocido «{campo}»"
            )
            continue
        insumos.fragmentos.append(
            Fragmento(
                pregunta=coincidencia["pid"],
                campo=campo,
                texto=coincidencia["texto"].strip(),
                fuente=Fuente(ruta.name, numero, coincidencia["minuto"]),
            )
        )


def _filas(ruta: Path, insumos: Insumos):
    with ruta.open(encoding="utf-8-sig", newline="") as archivo:
        for numero, fila in enumerate(csv.DictReader(archivo), start=2):
            if None in fila:
                insumos.avisos.append(
                    f"{ruta.name} línea {numero}: columnas adicionales sin encabezado"
                )
                continue
            yield (
                numero,
                {k.strip().lower(): (v or "").strip() for k, v in fila.items()},
            )


def _identificado(fila: dict, campos: tuple[str, ...]) -> bool:
    if any(not fila.get(campo) for campo in campos):
        return False
    try:
        date.fromisoformat(fila.get("fecha", ""))
    except ValueError:
        return False
    return True


def leer_validaciones(ruta: Path, insumos: Insumos) -> None:
    for numero, fila in _filas(ruta, insumos):
        if not _identificado(fila, ("fecha", "ficha", "nombre")):
            insumos.avisos.append(
                f"{ruta.name} línea {numero}: "
                "validación sin fecha o firmante identificado"
            )
            continue
        tipo = fila.get("tipo", "").lower()
        if tipo not in ("experto", "responsable"):
            insumos.avisos.append(f"{ruta.name} línea {numero}: tipo inválido")
            continue
        try:
            version = int(fila.get("version") or 1)
            if version < 1:
                raise ValueError("Versión inválida")
        except ValueError:
            insumos.avisos.append(f"{ruta.name} línea {numero}: versión inválida")
            continue
        insumos.validaciones.append(
            Validacion(
                fecha=fila.get("fecha", ""),
                ficha=fila.get("ficha", ""),
                tipo=tipo,
                nombre=fila.get("nombre", ""),
                version=version,
                fuente=Fuente(ruta.name, numero),
            )
        )


def leer_practicas(ruta: Path, insumos: Insumos) -> None:
    for numero, fila in _filas(ruta, insumos):
        if not _identificado(fila, ("fecha", "ficha", "sucesor", "respuesta")):
            insumos.avisos.append(
                f"{ruta.name} línea {numero}: práctica sin fecha, sucesor o respuesta"
            )
            continue
        calificacion = normalizar(fila.get("calificacion", ""))
        if calificacion not in CALIFICACIONES:
            insumos.avisos.append(f"{ruta.name} línea {numero}: calificación inválida")
            continue
        insumos.practicas.append(
            Practica(
                fecha=fila.get("fecha", ""),
                ficha=fila.get("ficha", ""),
                sucesor=fila.get("sucesor", ""),
                respuesta=fila.get("respuesta", ""),
                calificacion=calificacion,
                correccion=fila.get("correccion", ""),
                fuente=Fuente(ruta.name, numero),
            )
        )


def cargar(base: Path) -> Insumos:
    insumos = Insumos(demostracion=(base / "DATOS_DE_DEMOSTRACION.txt").exists())
    carpeta = base / "transcripciones"
    for ruta in sorted(carpeta.glob("*.txt")) if carpeta.is_dir() else []:
        leer_transcripcion(ruta, insumos)
    if (base / "validaciones.csv").exists():
        leer_validaciones(base / "validaciones.csv", insumos)
    if (base / "practica.csv").exists():
        leer_practicas(base / "practica.csv", insumos)
    return insumos
