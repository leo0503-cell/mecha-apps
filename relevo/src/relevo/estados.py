"""Ciclo de vida de cada ficha.

borrador → validada por experto → practicada → vigente

Reglas duras:
- Nunca es vigente sin validación del experto de la versión actual y al menos
  una práctica del sucesor calificada como correcta sobre esa misma versión.
- Una corrección del experto crea una versión nueva; la corrección cuenta como
  validación del experto, pero la práctica anterior ya no cuenta.
- Las fichas marcadas de seguridad o calidad exigen además la validación de un
  responsable designado para la versión actual.
"""

from __future__ import annotations

from relevo.ejercicios import ejercicios
from relevo.guia import Guia
from relevo.modelos import CAMPOS, Ficha, Practica, Validacion

ESTADOS = ("borrador", "validada por experto", "practicada", "vigente")
CONTENIDO_ACCIONABLE = ("decision", "limite", "contacto")


def _dato(texto: str, cita: str) -> dict[str, str]:
    return {"texto": texto, "fuente": cita}


def evaluar(
    ficha: Ficha,
    guia: Guia,
    validaciones: list[Validacion],
    practicas: list[Practica],
) -> dict:
    eventos = sorted(
        [(v.fecha, 0, v.fuente.linea, v) for v in validaciones if v.ficha == ficha.id]
        + [(p.fecha, 1, p.fuente.linea, p) for p in practicas if p.ficha == ficha.id],
        key=lambda e: e[:3],
    )
    version = 1
    decisiones = ficha.campos.get("decision", [])
    decision = decisiones[0].texto if decisiones else ""
    versiones = [
        {
            "version": 1,
            "fecha": "",
            "motivo": "Entrevista",
            "decision": decision,
            "fuente": decisiones[0].fuente.cita if decisiones else "",
        }
    ]
    validada_experto: set[int] = set()
    validada_responsable: set[int] = set()
    correctas: set[int] = set()
    practicadas: set[int] = set()
    historial = []
    avisos = []

    for _, _, _, evento in eventos:
        if isinstance(evento, Validacion):
            etiqueta = (
                "Validación del experto"
                if evento.tipo == "experto"
                else ("Validación del responsable")
            )
            if evento.version != version:
                avisos.append(
                    f"{evento.fuente.cita}: valida la versión {evento.version}, "
                    f"pero la vigente es la {version}; no se toma en cuenta"
                )
                continue
            destino = (
                validada_experto if evento.tipo == "experto" else (validada_responsable)
            )
            destino.add(version)
            historial.append(
                {
                    "fecha": evento.fecha,
                    "tipo": etiqueta,
                    "detalle": evento.nombre,
                    "version": version,
                    "fuente": evento.fuente.cita,
                }
            )
            continue
        practicadas.add(version)
        historial.append(
            {
                "fecha": evento.fecha,
                "tipo": f"Práctica · {evento.calificacion}",
                "detalle": f"{evento.sucesor}: {evento.respuesta}",
                "version": version,
                "fuente": evento.fuente.cita,
            }
        )
        if evento.correccion:
            version += 1
            decision = evento.correccion
            validada_experto.add(version)
            versiones.append(
                {
                    "version": version,
                    "fecha": evento.fecha,
                    "motivo": "Corrección del experto durante la práctica",
                    "decision": decision,
                    "fuente": evento.fuente.cita,
                }
            )
            historial.append(
                {
                    "fecha": evento.fecha,
                    "tipo": "Corrección del experto",
                    "detalle": evento.correccion,
                    "version": version,
                    "fuente": evento.fuente.cita,
                }
            )
        elif evento.calificacion == "correcto":
            correctas.add(version)

    faltantes = []
    if not any(ficha.campos.get(c) for c in CONTENIDO_ACCIONABLE):
        faltantes.append("La entrevista no registró decisión, límite ni contacto")
    if version not in validada_experto:
        faltantes.append(f"Validación del experto de la versión {version}")
    if version not in correctas:
        faltantes.append("Una práctica del sucesor calificada como correcta")
    if ficha.requiere_responsable and version not in validada_responsable:
        marcas = " y ".join(sorted(ficha.marcas))
        faltantes.append(f"Firma del responsable designado ({marcas})")

    if version not in validada_experto:
        estado = "borrador"
    elif not faltantes:
        estado = "vigente"
    elif version in practicadas:
        estado = "practicada"
    else:
        estado = "validada por experto"

    campos = {
        campo: [_dato(d.texto, d.fuente.cita) for d in ficha.campos.get(campo, [])]
        for campo in CAMPOS
        if ficha.campos.get(campo)
    }
    if version > 1:
        campos["decision"] = [_dato(decision, versiones[-1]["fuente"])] + [
            {**d, "texto": f"(versión anterior) {d['texto']}"}
            for d in campos.get("decision", [])
        ]
    return {
        "id": ficha.id,
        "categoria": ficha.categoria,
        "categoria_nombre": guia.categorias[ficha.categoria],
        "pregunta": ficha.pregunta,
        "titulo": titulo(ficha),
        "estado": estado,
        "version": version,
        "marcas": sorted(ficha.marcas),
        "decision_vigente": decision,
        "campos": campos,
        "arbol": [
            {"si": r.si, "entonces": r.entonces, "fuente": r.fuente.cita}
            for r in ficha.reglas
        ],
        "ejercicios": ejercicios(ficha, decision),
        "historial": historial,
        "versiones": versiones,
        "faltantes": faltantes,
        "avisos": avisos,
    }


def titulo(ficha: Ficha) -> str:
    """La señal titula las fichas de señales; en las demás, la situación."""
    orden = ("situacion", "senal", "limite", "contacto")
    if ficha.categoria == "senales":
        orden = ("senal", "situacion", "limite", "contacto")
    return next((ficha.primero(c) for c in orden if ficha.primero(c)), ficha.pregunta)


def cobertura(fichas: list[dict], guia: Guia) -> list[dict]:
    resultado = []
    for cid, nombre in guia.categorias.items():
        propias = [f for f in fichas if f["categoria"] == cid]
        if propias:
            resultado.append(
                {
                    "categoria": cid,
                    "nombre": nombre,
                    "total": len(propias),
                    "vigentes": sum(f["estado"] == "vigente" for f in propias),
                }
            )
    return resultado
