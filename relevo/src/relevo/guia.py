from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path

GUIA_BASE = Path(__file__).with_name("guia.toml")


@dataclass(frozen=True)
class Pregunta:
    id: str
    categoria: str
    texto: str


@dataclass(frozen=True)
class Guia:
    categorias: dict[str, str]
    preguntas: dict[str, Pregunta]

    def categoria_de(self, pregunta_id: str) -> str:
        return pregunta_id.rsplit("-", 1)[0]


def cargar_guia(ruta: Path | None = None) -> Guia:
    """Carga la guía del cliente si existe; si no, la guía base."""
    datos = tomllib.loads((ruta or GUIA_BASE).read_text(encoding="utf-8"))
    categorias: dict[str, str] = {}
    preguntas: dict[str, Pregunta] = {}
    for categoria in datos["categoria"]:
        categorias[categoria["id"]] = categoria["nombre"]
        for numero, texto in enumerate(categoria["preguntas"], start=1):
            pid = f"{categoria['id']}-{numero:02d}"
            preguntas[pid] = Pregunta(pid, categoria["id"], texto)
    return Guia(categorias, preguntas)


def guia_markdown(guia: Guia) -> str:
    lineas = [
        "# Guía de entrevista · Relevo",
        "",
        "Graba la entrevista solo con permiso de la persona entrevistada.",
        "Al transcribir, marca cada respuesta con el identificador de la pregunta",
        "y el minuto: `[P:decisiones-01] [04:10] decision: texto`.",
        "Campos: situacion, senal, decision, porque, excepcion, limite, contacto,",
        "regla (`si … entonces …`) y marca (`seguridad` o `calidad`).",
        "",
    ]
    for cid, nombre in guia.categorias.items():
        lineas += [f"## {nombre}", ""]
        for pregunta in guia.preguntas.values():
            if pregunta.categoria == cid:
                lineas.append(f"- **{pregunta.id}** · {pregunta.texto}")
        lineas.append("")
    return "\n".join(lineas)
