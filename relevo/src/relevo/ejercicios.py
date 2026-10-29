from __future__ import annotations

from relevo.modelos import Ficha


def _frase(texto: str) -> str:
    texto = texto.strip()
    return texto if texto.endswith((".", "?", "!")) else texto + "."


def ejercicios(ficha: Ficha, decision: str) -> list[dict[str, str]]:
    """Casos de práctica para el sucesor, armados solo con lo que dijo el experto."""
    situacion = ficha.primero("situacion")
    senal = ficha.primero("senal")
    limite = ficha.primero("limite")
    porque = ficha.primero("porque")
    casos = []
    if decision and (situacion or senal):
        partes = []
        if situacion:
            partes.append(f"Situación: {_frase(situacion)}")
        if senal:
            partes.append(f"Observas: {_frase(senal)}")
        esperada = _frase(decision) + (f" Por qué: {_frase(porque)}" if porque else "")
        casos.append(
            {
                "id": f"{ficha.id}-E1",
                "escenario": " ".join(partes) + " ¿Qué haces?",
                "esperada": esperada,
            }
        )
    if limite:
        casos.append(
            {
                "id": f"{ficha.id}-E{len(casos) + 1}",
                "escenario": f"Tema: {ficha.pregunta} ¿Qué nunca debes hacer?",
                "esperada": _frase(limite),
            }
        )
    for excepcion in ficha.campos.get("excepcion", [])[:1]:
        regla = ficha.reglas[0] if ficha.reglas else None
        esperada = (
            f"Si {regla.si}, entonces {regla.entonces}."
            if regla
            else _frase(excepcion.texto)
        )
        casos.append(
            {
                "id": f"{ficha.id}-E{len(casos) + 1}",
                "escenario": (
                    f"Mismo caso, pero: {_frase(excepcion.texto)} ¿Cambia tu decisión?"
                ),
                "esperada": esperada,
            }
        )
    return casos
