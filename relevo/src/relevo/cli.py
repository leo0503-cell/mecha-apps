from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path

from relevo.demo import generar
from relevo.estados import ESTADOS, cobertura, evaluar
from relevo.fichas import ExtractorDeterminista
from relevo.guia import cargar_guia, guia_markdown
from relevo.modelos import CAMPOS
from relevo.transcripciones import cargar


def procesar(base: Path) -> dict:
    if not base.is_dir():
        raise ValueError("La carpeta de entrada no existe")
    insumos = cargar(base)
    if not insumos.fragmentos:
        raise ValueError(
            "No se encontraron fragmentos válidos en transcripciones/; "
            + "; ".join(insumos.avisos)
        )
    guia = cargar_guia(base / "guia.toml" if (base / "guia.toml").exists() else None)
    avisos = list(insumos.avisos)
    fichas = ExtractorDeterminista().extraer(insumos.fragmentos, guia, avisos)
    ids = {f.id for f in fichas}
    for registro in [*insumos.validaciones, *insumos.practicas]:
        if registro.ficha not in ids:
            avisos.append(f"{registro.fuente.cita}: ficha «{registro.ficha}» no existe")
    evaluadas = [
        evaluar(f, guia, insumos.validaciones, insumos.practicas) for f in fichas
    ]
    for ficha in evaluadas:
        avisos.extend(ficha.pop("avisos"))
    conteo = Counter(f["estado"] for f in evaluadas)
    salida = {
        "producto": "Relevo, por Mecha",
        "demostracion": insumos.demostracion,
        "aviso": "Datos de demostración: empresa, personas y casos inventados."
        if insumos.demostracion
        else "Uso interno; el manual solo incluye fichas vigentes.",
        "puesto": insumos.metadatos.get("puesto", "<puesto>"),
        "empresa": insumos.metadatos.get("empresa", "<empresa>"),
        "experto": insumos.metadatos.get("experto", "<experto>"),
        "sucesor": insumos.metadatos.get("sucesor", "<sucesor>"),
        "conteo_por_estado": {e: conteo.get(e, 0) for e in ESTADOS},
        "cobertura": cobertura(evaluadas, guia),
        "avisos": avisos,
        "fichas": evaluadas,
    }
    carpeta = base / "salida"
    carpeta.mkdir(exist_ok=True)
    datos = json.dumps(salida, ensure_ascii=False, indent=2)
    # Neutraliza cierre de script y separadores Unicode sin alterar los datos.
    embebido = (
        datos.replace("<", "\\u003c").replace(" ", "\\u2028").replace(" ", "\\u2029")
    )
    plantilla = Path(__file__).with_name("mapa.html").read_text(encoding="utf-8")
    for nombre, texto in (
        ("relevo.json", datos),
        ("mapa.html", plantilla.replace("__DATOS_RELEVO__", embebido)),
        ("manual.md", manual(salida)),
        ("ejercicios.md", hoja_ejercicios(salida)),
    ):
        temporal = carpeta / f".{nombre}.tmp"
        temporal.write_text(texto, encoding="utf-8")
        os.replace(temporal, carpeta / nombre)
    return salida


def manual(salida: dict) -> str:
    vigentes = [f for f in salida["fichas"] if f["estado"] == "vigente"]
    pendientes = [f for f in salida["fichas"] if f["estado"] != "vigente"]
    lineas = [
        f"# Manual del puesto · {salida['puesto']}",
        "",
        f"{salida['aviso']} Experto: {salida['experto']}. "
        f"Sucesor: {salida['sucesor']}.",
        "",
        "Solo incluye fichas vigentes: validadas por el experto y practicadas",
        "correctamente por el sucesor. Cada dato indica su fuente.",
        "",
    ]
    categoria = None
    for ficha in vigentes:
        if ficha["categoria_nombre"] != categoria:
            categoria = ficha["categoria_nombre"]
            lineas += [f"## {categoria}", ""]
        lineas += [f"### {ficha['titulo']} (`{ficha['id']}` · v{ficha['version']})", ""]
        for campo, etiqueta in CAMPOS.items():
            for dato in ficha["campos"].get(campo, []):
                lineas.append(f"- **{etiqueta}:** {dato['texto']} _({dato['fuente']})_")
        for regla in ficha["arbol"]:
            lineas.append(f"- **Si** {regla['si']} → **entonces** {regla['entonces']}")
        lineas.append("")
    lineas += ["## Pendientes de transferir", ""]
    for ficha in pendientes:
        lineas.append(
            f"- `{ficha['id']}` · {ficha['titulo']} — {ficha['estado']}. "
            f"Falta: {'; '.join(ficha['faltantes'])}."
        )
    return "\n".join(lineas) + "\n"


def hoja_ejercicios(salida: dict) -> str:
    lineas = [f"# Ejercicios para el sucesor · {salida['puesto']}", ""]
    for ficha in salida["fichas"]:
        for caso in ficha["ejercicios"]:
            lineas += [
                f"## {caso['id']}",
                "",
                caso["escenario"],
                "",
                "Respuesta del sucesor: ______________________________",
                "",
                f"<details><summary>Respuesta del experto</summary>"
                f"{caso['esperada']}</details>",
                "",
            ]
    return "\n".join(lineas)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Lo que sabe quien se va, probado por quien se queda"
    )
    comandos = parser.add_subparsers(dest="comando", required=True)
    demo = comandos.add_parser("demo", help="Generar datos ficticios de demostración")
    demo.add_argument("--carpeta", type=Path, default=Path("demo/datos"))
    guia = comandos.add_parser("guia", help="Exportar la guía de entrevista")
    guia.add_argument("--salida", type=Path, help="Archivo Markdown de destino")
    procesamiento = comandos.add_parser(
        "procesar", help="Generar fichas, mapa, manual y ejercicios"
    )
    procesamiento.add_argument(
        "carpeta", type=Path, help="Carpeta con transcripciones/ y CSV de avance"
    )
    args = parser.parse_args()
    try:
        if args.comando == "demo":
            generar(args.carpeta)
            print(f"Demo creada en {args.carpeta}. Datos de demostración.")
        elif args.comando == "guia":
            texto = guia_markdown(cargar_guia())
            if args.salida:
                args.salida.write_text(texto, encoding="utf-8")
                print(f"Guía guardada en {args.salida}.")
            else:
                print(texto)
        else:
            salida = procesar(args.carpeta)
            conteo = salida["conteo_por_estado"]
            print(
                f"{len(salida['fichas'])} fichas · {conteo['vigente']} vigentes. "
                f"Resultados en {args.carpeta / 'salida'}."
            )
            for aviso in salida["avisos"]:
                print(f"Aviso: {aviso}")
    except (ValueError, OSError) as error:
        print(f"No se pudo completar: {error}", file=sys.stderr)
        raise SystemExit(1) from error
