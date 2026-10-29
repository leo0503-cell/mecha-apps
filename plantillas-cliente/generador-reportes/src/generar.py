#!/usr/bin/env python3
"""CSV de métricas → reporte HTML branded. Abre el HTML e imprime a PDF (⌘P).

    uv run src/generar.py ejemplos/metricas.csv --cliente "Tableros Bonaterra"

CSV esperado (encabezados): fecha,metrica,valor,meta
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import math
import re
import webbrowser
from collections import defaultdict
from html import escape
from pathlib import Path
from zoneinfo import ZoneInfo

try:
    import tomllib
except ModuleNotFoundError:  # py<3.11
    tomllib = None

PLANTILLA = """<!doctype html><html lang=es><meta charset=utf-8>
<title>Reporte {cliente} · {periodo}</title>
<style>
  body{{font-family:-apple-system,sans-serif;color:#1a1a1a;max-width:760px;margin:40px auto;padding:0 24px}}
  h1{{color:{color};font-size:22px}} .periodo{{color:#666}}
  table{{width:100%;border-collapse:collapse;margin-top:24px}}
  th,td{{text-align:left;padding:10px;border-bottom:1px solid #e5e5e5}}
  th{{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#888}}
  .ok{{color:#16a34a}} .bajo{{color:{color}}}
  footer{{margin-top:40px;color:#999;font-size:12px}}
</style>
<h1>{cliente}</h1>
<div class=periodo>Reporte de desempeño · {periodo}</div>
<table><tr><th>Métrica</th><th>Valor</th><th>Meta</th><th>Cumplimiento</th></tr>
{filas}
</table>
<footer>Generado por Mecha · {hoy} · Datos entre &lt;corchetes&gt; = pendientes de confirmar</footer>
</html>"""


def cargar_marca(ruta: Path) -> dict:
    d = {"color": "#e63329"}
    if ruta.exists() and tomllib:
        d.update(tomllib.loads(ruta.read_text()))
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", str(d.get("color", ""))):
        raise ValueError("La marca requiere un color hexadecimal de seis dígitos")
    return d


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", type=Path)
    ap.add_argument("--cliente", default="<Cliente>")
    ap.add_argument("--salida", type=Path, default=Path("reporte.html"))
    ap.add_argument("--sin-abrir", action="store_true")
    args = ap.parse_args()

    try:
        marca = cargar_marca(Path("marca.toml"))
        with args.csv.open(encoding="utf-8-sig", newline="") as archivo:
            lector = csv.DictReader(archivo)
            lector.fieldnames = [c.strip().lower() for c in (lector.fieldnames or [])]
            if not {"fecha", "metrica", "valor"}.issubset(lector.fieldnames or []):
                raise ValueError("CSV requiere fecha, metrica y valor")
            filas_csv = list(lector)
    except (OSError, ValueError) as error:
        ap.error(str(error))
    if not filas_csv:
        print("CSV vacío")
        return 1

    agg: dict[str, list[float]] = defaultdict(list)
    metas: dict[str, float] = {}
    fechas = []
    incompletas = set()
    try:
        for r in filas_csv:
            metrica = r["metrica"].strip()
            if not metrica:
                raise ValueError("Hay una métrica sin nombre")
            fecha = dt.date.fromisoformat(r["fecha"].strip())
            agg[metrica]  # Conserva las métricas sin valor, sin convertirlas en cero.
            if r["valor"].strip():
                valor = float(r["valor"])
                if not math.isfinite(valor):
                    raise ValueError("Los valores deben ser finitos")
                agg[metrica].append(valor)
            else:
                incompletas.add(metrica)
            if (r.get("meta") or "").strip():
                meta = float(r["meta"])
                if not math.isfinite(meta) or meta < 0:
                    raise ValueError("La meta debe ser finita y no negativa")
                if metrica in metas and metas[metrica] != meta:
                    raise ValueError(f"Metas contradictorias para {metrica}")
                metas[metrica] = meta
            fechas.append(fecha.isoformat())
    except (ValueError, TypeError, AttributeError) as error:
        ap.error(f"CSV inválido: {error}")

    filas_html = []
    for metrica, valores in agg.items():
        total = sum(valores)
        if not math.isfinite(total):
            ap.error("El total excede el rango permitido")
        meta = metas.get(metrica)
        if meta and metrica not in incompletas:
            pct = total / meta * 100
            cls = "ok" if pct >= 100 else "bajo"
            cumpl = f'<span class="{cls}">{pct:.0f}%</span>'
        else:
            cumpl = "&lt;sin meta&gt;"
        valor_html = "&lt;sin datos completos&gt;" if metrica in incompletas else f"{total:,.2f}"
        meta_html = f"{meta:,.2f}" if meta is not None else "&lt;meta&gt;"
        if metrica in incompletas:
            cumpl = "&lt;sin datos completos&gt;"
        elif meta == 0:
            cumpl = "&lt;no aplica: meta cero&gt;"
        filas_html.append(
            f"<tr><td>{escape(metrica)}</td><td>{valor_html}</td>"
            f"<td>{meta_html}</td><td>{cumpl}</td></tr>"
        )

    periodo = f"{min(fechas)} — {max(fechas)}"
    html = PLANTILLA.format(
        cliente=escape(args.cliente),
        periodo=escape(periodo),
        color=marca["color"],
        filas="\n".join(filas_html),
        hoy=dt.datetime.now(ZoneInfo("America/Mexico_City")).date().isoformat(),
    )
    args.salida.write_text(html, encoding="utf-8")
    print(f"→ {args.salida.resolve()}  (ábrelo e imprime a PDF)")
    if not args.sin_abrir:
        webbrowser.open(args.salida.resolve().as_uri())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
