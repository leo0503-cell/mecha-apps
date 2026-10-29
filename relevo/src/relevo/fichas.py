from __future__ import annotations

import re
from typing import Protocol

from relevo.guia import Guia
from relevo.modelos import CAMPOS, MARCAS, Dato, Ficha, Fragmento, Regla

REGLA = re.compile(r"^si\s+(?P<si>.+?)\s*,?\s+entonces\s+(?P<entonces>.+)$", re.I)


class Extractor(Protocol):
    """Convierte fragmentos de entrevista en fichas.

    La versión determinista usa los campos marcados al transcribir. Un modelo
    puede implementar esta misma interfaz para leer texto libre, siempre que
    cada dato conserve la fuente del fragmento del que salió.
    """

    def extraer(
        self, fragmentos: list[Fragmento], guia: Guia, avisos: list[str]
    ) -> list[Ficha]: ...


class ExtractorDeterminista:
    def extraer(
        self, fragmentos: list[Fragmento], guia: Guia, avisos: list[str]
    ) -> list[Ficha]:
        fichas: dict[str, Ficha] = {}
        for fragmento in fragmentos:
            pid = fragmento.pregunta
            categoria = guia.categoria_de(pid)
            if categoria not in guia.categorias:
                avisos.append(
                    f"{fragmento.fuente.cita}: categoría «{categoria}» fuera de la guía"
                )
                continue
            pregunta = guia.preguntas.get(pid)
            ficha = fichas.setdefault(
                pid,
                Ficha(
                    id=pid,
                    categoria=categoria,
                    pregunta=pregunta.texto if pregunta else "Pregunta fuera de guía",
                ),
            )
            if fragmento.campo == "marca":
                marca = fragmento.texto.strip().lower()
                if marca in MARCAS:
                    ficha.marcas.add(marca)
                else:
                    avisos.append(f"{fragmento.fuente.cita}: marca desconocida")
            elif fragmento.campo == "regla":
                coincidencia = REGLA.match(fragmento.texto)
                if coincidencia:
                    ficha.reglas.append(
                        Regla(
                            coincidencia["si"].strip(),
                            coincidencia["entonces"].strip().rstrip("."),
                            fragmento.fuente,
                        )
                    )
                else:
                    avisos.append(
                        f"{fragmento.fuente.cita}: la regla no sigue «si … entonces …»"
                    )
            elif fragmento.campo in CAMPOS:
                ficha.campos.setdefault(fragmento.campo, []).append(
                    Dato(fragmento.texto, fragmento.fuente)
                )
        return sorted(fichas.values(), key=lambda f: orden(f, guia))


def orden(ficha: Ficha, guia: Guia) -> tuple[int, str]:
    categorias = list(guia.categorias)
    return (categorias.index(ficha.categoria), ficha.id)
