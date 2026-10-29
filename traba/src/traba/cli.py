from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, is_dataclass
from decimal import Decimal
from pathlib import Path

from traba.demo import generar
from traba.fuentes import cargar
from traba.reglas import configuracion, evaluar
from traba.vinculos import vincular


def serializar(valor):
    if is_dataclass(valor):
        return asdict(valor)
    if isinstance(valor, Decimal):
        return str(valor)
    raise TypeError(f"No se puede serializar {type(valor).__name__}")


def procesar(base: Path) -> dict:
    if not base.is_dir():
        raise ValueError("La carpeta de entrada no existe")
    insumos = cargar(base)
    if not insumos.facturas:
        raise ValueError(
            "No se encontraron facturas de ingreso válidas; "
            + "; ".join(insumos.avisos)
        )
    responsables = configuracion(base)
    expedientes = [
        evaluar(f, insumos, vincular(f, insumos), responsables)
        for f in insumos.facturas
    ]
    totales = defaultdict(lambda: Decimal("0"))
    for expediente in expedientes:
        totales[expediente["moneda"]] += Decimal(expediente["monto"])
    salida = {
        "producto": "Traba, por Mecha",
        "demostracion": insumos.demostracion,
        "aviso": "Datos de demostración: montos y clientes ficticios."
        if insumos.demostracion
        else "Revisión interna con fuentes locales; requiere validación humana.",
        "totales_facturados_por_moneda": {
            m: str(t) for m, t in sorted(totales.items())
        },
        "conteo_por_estado": dict(Counter(e["estado"] for e in expedientes)),
        "avisos": insumos.avisos,
        "expedientes": expedientes,
    }
    carpeta = base / "salida"
    carpeta.mkdir(exist_ok=True)
    datos = json.dumps(salida, ensure_ascii=False, indent=2, default=serializar)
    # Neutraliza cierre de script y separadores Unicode sin alterar los datos.
    embebido = (
        datos.replace("<", "\\u003c")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )
    plantilla = Path(__file__).with_name("bandeja.html").read_text(encoding="utf-8")
    for nombre, texto in (
        ("expedientes.json", datos),
        ("bandeja.html", plantilla.replace("__DATOS_TRABA__", embebido)),
    ):
        temporal = carpeta / f".{nombre}.tmp"
        temporal.write_text(texto, encoding="utf-8")
        os.replace(temporal, carpeta / nombre)
    return salida


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Cada factura detenida, con su motivo, evidencia y siguiente responsable"
        )
    )
    comandos = parser.add_subparsers(dest="comando", required=True)
    demo = comandos.add_parser("demo", help="Generar datos ficticios de demostración")
    demo.add_argument(
        "--carpeta",
        type=Path,
        default=Path("demo/datos"),
        help="Carpeta para la demostración",
    )
    procesamiento = comandos.add_parser(
        "procesar", help="Preparar expedientes y bandeja interna"
    )
    procesamiento.add_argument(
        "carpeta", type=Path, help="Carpeta de XML, cartera, pedidos y evidencias"
    )
    args = parser.parse_args()
    try:
        if args.comando == "demo":
            generar(args.carpeta)
            print(
                f"Demo creada en {args.carpeta}: 25 facturas ficticias. "
                "Datos de demostración."
            )
        else:
            salida = procesar(args.carpeta)
            print(
                f"{len(salida['expedientes'])} expedientes preparados "
                f"en {args.carpeta / 'salida'}."
            )
            for aviso in salida["avisos"]:
                print(f"Aviso: {aviso}")
    except (ValueError, OSError) as error:
        print(f"No se pudo completar: {error}", file=sys.stderr)
        raise SystemExit(1) from error
