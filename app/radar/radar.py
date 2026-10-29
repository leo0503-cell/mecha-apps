"""Radar de Mecha: arma la edición diaria de cada cliente.

Busca en la web lo que le importa al negocio (competidores, su giro, su ciudad,
fechas que vienen) con Claude + búsqueda web del servidor, y escribe la edición
en el formato que lee la app:

    app/web/datos/<cliente>/radar/<AAAA-MM-DD>.json
    app/web/datos/<cliente>/radar/index.json

Uso:
    uv run radar.py --cliente demo            # la edición de hoy de un cliente
    uv run radar.py --todos                   # todos los clientes de clientes/*.toml
    uv run radar.py --cliente demo --prueba   # muestra la petición sin llamar a la API

Necesita ANTHROPIC_API_KEY en el entorno o en app/radar/.env (nunca al repo).
"""

from __future__ import annotations

import argparse
import fcntl
import json
import os
import re
import sys
import tomllib
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from zoneinfo import ZoneInfo

AQUI = Path(__file__).resolve().parent
CLIENTES = AQUI / "clientes"
DATOS = AQUI.parent / "web" / "datos"
ZONA = ZoneInfo("America/Mexico_City")

MODELO = "claude-opus-5-5"
# medium es el default de Opus 5.5; se deja explícito. Súbelo a "high" si las
# ediciones salen flojas, bájalo a "low" si el costo por cliente aprieta.
ESFUERZO = "medium"
BUSQUEDAS_MAX = 12
CONTINUACIONES_MAX = 5

# ---------------------------------------------------------------- esquema

_FUENTES = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {"titulo": {"type": "string"}, "url": {"type": "string"}},
        "required": ["titulo", "url"],
        "additionalProperties": False,
    },
}


def _obj(props: dict) -> dict:
    return {"type": "object", "properties": props, "required": list(props), "additionalProperties": False}


ESQUEMA = _obj(
    {
        "portada": _obj(
            {
                "titulo": {"type": "string"},
                "bajada": {"type": "string"},
                "por_que_importa": {"type": "string"},
                "fuentes": _FUENTES,
            }
        ),
        "competencia": {
            "type": "array",
            "items": _obj(
                {
                    "competidor": {"type": "string"},
                    "titulo": {"type": "string"},
                    "detalle": {"type": "string"},
                    "que_hacer": {"type": "string"},
                    "fuentes": _FUENTES,
                }
            ),
        },
        "mercado": {
            "type": "array",
            "items": _obj(
                {
                    "titulo": {"type": "string"},
                    "detalle": {"type": "string"},
                    "impacto": {"type": "string", "enum": ["alto", "medio", "bajo"]},
                    "fuentes": _FUENTES,
                }
            ),
        },
        "fechas": {
            "type": "array",
            "items": _obj(
                {
                    "inicio": {"type": "string", "description": "AAAA-MM-DD"},
                    "fin": {"type": ["string", "null"], "description": "AAAA-MM-DD o null si es un solo día"},
                    "nombre": {"type": "string"},
                    "que_preparar": {"type": "string"},
                    "fuentes": _FUENTES,
                }
            ),
        },
        "idea": _obj(
            {
                "tipo": {"type": "string", "enum": ["post", "reel", "historia", "promocion", "mensaje"]},
                "titulo": {"type": "string"},
                "detalle": {"type": "string"},
                "texto_sugerido": {"type": "string"},
            }
        ),
        "sin_confirmar": {"type": "array", "items": {"type": "string"}},
    }
)

# ---------------------------------------------------------------- prompt

SISTEMA = """\
Eres el editor del Radar de Mecha: un periódico diario, corto y útil, para el dueño de una PyME mexicana.
Lo lee en su celular a primera hora. Escribe en español de México, tuteando, directo y sin tecnicismos.

Cómo se arma una edición:
- Busca en la web antes de escribir. Prioriza lo publicado en los últimos días; para competidores, su
  página, sus redes y notas sobre ellos.
- Portada: lo más importante del día PARA ESTE NEGOCIO, no la noticia más grande del país.
- Competencia: movimientos concretos (promociones, precios publicados, lanzamientos, aperturas, reseñas,
  campañas). Si de un competidor no encontraste nada nuevo, no lo incluyas.
- Mercado: noticias del giro y de la ciudad que cambian algo para el negocio. Marca el impacto.
- Fechas: comerciales, festivas, de pago o de trámites en los próximos 60 días que convenga preparar.
  Toda fecha, incluso las fechas fijas del calendario, requiere una fuente verificada. No supongas
  obligaciones ni fechas de pago que el negocio no haya confirmado.
- Idea para hoy: una sola acción concreta que el negocio pueda hacer hoy, con el texto listo para usar.
- Cada nota termina en algo accionable para el dueño, no en un resumen.

Reglas que no se rompen:
- Ningún dato inventado. Cada cifra, fecha, precio o afirmación sobre un competidor sale de una página
  que encontraste en esta búsqueda, y su liga va en "fuentes" (la URL exacta del resultado).
- Si algo lo viste pero no lo pudiste confirmar en una fuente confiable, no lo pongas como nota:
  descríbelo en "sin_confirmar".
- Si hoy no hay nada relevante en una sección, déjala vacía. Es mejor una edición corta que una de relleno.
- No repitas notas de ediciones anteriores salvo que haya algo nuevo; entonces di qué cambió.
- Sin superlativos ni frases de vendedor. Nada de "revoluciona", "potencia", "increíble".
"""


def instruccion(cliente: dict, hoy: date, anteriores: list[str]) -> str:
    r = cliente.get("radar", {})
    comp = "\n".join(
        f"- {c['nombre']}" + "".join(f" · {k}: {c[k]}" for k in ("web", "instagram", "facebook") if c.get(k))
        for c in r.get("competidores", [])
    )
    previas = "\n".join(f"- {t}" for t in anteriores) or "- (es la primera edición)"
    return f"""\
Arma la edición del {hoy.isoformat()} para este negocio:

Negocio: {cliente["nombre"]}
Giro: {cliente["giro"]}
Ciudad: {cliente["ciudad"]}
Lo que vende y a quién: {cliente.get("descripcion", "")}

Competidores que el dueño quiere vigilar:
{comp or "- (no dio nombres: identifica los 3 más visibles en su ciudad y giro)"}

Temas que le importan:
{chr(10).join("- " + t for t in r.get("temas", [])) or "- su giro y su ciudad"}

Titulares de las últimas ediciones (no los repitas):
{previas}
"""


# ---------------------------------------------------------------- fuentes


def _normaliza(url: str) -> str:
    p = urlsplit(url.strip())
    ruta = p.path.rstrip("/") or "/"
    return urlunsplit((p.scheme.lower(), p.netloc.lower().removeprefix("www."), ruta, p.query, ""))


def urls_buscadas(contenido) -> set[str]:
    """URLs que de verdad salieron en los resultados de búsqueda de esta respuesta."""
    vistas: set[str] = set()
    for bloque in contenido:
        if getattr(bloque, "type", "") != "web_search_tool_result":
            continue
        resultados = bloque.content
        if not isinstance(resultados, list):  # error de la herramienta: viene como objeto
            continue
        for res in resultados:
            if getattr(res, "url", None):
                vistas.add(_normaliza(res.url))
    return vistas


def depura_fuentes(ed: dict, vistas: set[str]) -> dict:
    """Quita ligas que no salieron en la búsqueda. Una nota sin fuente pasa a sin_confirmar."""

    def limpia(fuentes: list[dict]) -> list[dict]:
        return [
            f
            for f in fuentes
            if urlsplit(f["url"]).scheme in {"http", "https"} and _normaliza(f["url"]) in vistas
        ]

    ed["portada"]["fuentes"] = limpia(ed["portada"]["fuentes"])
    portada_sin_fuente = not ed["portada"]["fuentes"]
    for seccion in ("competencia", "mercado"):
        quedan = []
        for nota in ed[seccion]:
            nota["fuentes"] = limpia(nota["fuentes"])
            if nota["fuentes"]:
                quedan.append(nota)
            else:
                ed["sin_confirmar"].append(f"{nota['titulo']} (no encontramos la fuente para confirmarlo)")
        ed[seccion] = quedan
    fechas = []
    for f in ed["fechas"]:
        f["fuentes"] = limpia(f["fuentes"])
        try:
            inicio = date.fromisoformat(f["inicio"])
            fin = date.fromisoformat(f["fin"]) if f.get("fin") else inicio
            valida = fin >= inicio
        except (ValueError, TypeError):
            valida = False
        if f["fuentes"] and valida:
            fechas.append(f)
        else:
            ed["sin_confirmar"].append(f"{f['nombre']} (fecha o fuente sin confirmar)")
    ed["fechas"] = fechas

    if portada_sin_fuente:
        ed["sin_confirmar"].append(f"{ed['portada']['titulo']} (no encontramos la fuente para confirmarlo)")
        nota = next(iter(ed["mercado"] + ed["competencia"]), None)
        if nota:
            ed["portada"] = {
                "titulo": nota["titulo"],
                "bajada": nota["detalle"],
                "por_que_importa": nota.get("que_hacer", ""),
                "fuentes": nota["fuentes"],
            }
            for seccion in ("mercado", "competencia"):
                ed[seccion] = [n for n in ed[seccion] if n is not nota]
        else:
            ed["portada"] = {
                "titulo": "Hoy no hubo noticias confirmadas para tu negocio",
                "bajada": "Revisamos tu competencia, tu giro y tu ciudad y nada se pudo confirmar con una fuente.",
                "por_que_importa": "",
                "fuentes": [],
            }
    return ed


# ---------------------------------------------------------------- API


def pedir_edicion(
    cliente: dict, hoy: date, anteriores: list[str], prueba: bool
) -> tuple[dict | None, set[str]]:
    r = cliente.get("radar", {})
    herramienta = {"type": "web_search_20260209", "name": "web_search", "max_uses": BUSQUEDAS_MAX}
    if r.get("ubicacion"):
        herramienta["user_location"] = {"type": "approximate", **r["ubicacion"]}

    peticion = {
        "model": MODELO,
        "max_tokens": 32000,
        "system": SISTEMA,
        "tools": [herramienta],
        "output_config": {"effort": ESFUERZO, "format": {"type": "json_schema", "schema": ESQUEMA}},
        # Si un clasificador rechaza la petición, la API la reintenta sola con el modelo recomendado.
        "betas": ["server-side-fallback-2026-07-01"],
        "fallbacks": "default",
    }
    mensajes = [{"role": "user", "content": instruccion(cliente, hoy, anteriores)}]

    if prueba:
        print(json.dumps({**peticion, "messages": mensajes}, ensure_ascii=False, indent=2))
        return None, set()

    import anthropic  # aquí para que --prueba funcione sin la llave

    _carga_env()
    cliente_api = anthropic.Anthropic()
    vistas: set[str] = set()

    for _ in range(CONTINUACIONES_MAX + 1):
        try:
            with cliente_api.beta.messages.stream(**peticion, messages=mensajes) as flujo:
                resp = flujo.get_final_message()
        except anthropic.RateLimitError as e:
            raise SystemExit(f"Límite de la API (429). Vuelve a correrlo en unos minutos. {e.message}") from None
        except anthropic.APIStatusError as e:
            raise SystemExit(f"La API respondió {e.status_code}: {e.message}") from None
        except anthropic.APIConnectionError as e:
            raise SystemExit(f"Sin conexión con la API: {e}") from None

        vistas |= urls_buscadas(resp.content)
        if resp.stop_reason == "pause_turn":
            # La búsqueda del servidor llegó a su tope de vueltas: se reenvía y continúa sola.
            mensajes.append({"role": "assistant", "content": resp.content})
            continue
        if resp.stop_reason == "refusal":
            raise SystemExit(
                "El modelo no quiso armar la edición (refusal). Revisa la configuración del cliente."
            )
        if resp.stop_reason == "max_tokens":
            raise SystemExit("La edición se cortó por max_tokens. Súbelo en radar.py.")
        # Puede haber texto antes de las búsquedas; la edición (JSON con esquema) es el último bloque.
        textos = [b.text for b in resp.content if b.type == "text" and b.text.strip()]
        if not textos:
            raise SystemExit("La respuesta no trajo la edición.")
        uso = resp.usage
        print(f"  tokens: entrada {uso.input_tokens} · salida {uso.output_tokens}", file=sys.stderr)
        try:
            return json.loads(textos[-1]), vistas
        except json.JSONDecodeError as e:
            raise SystemExit(f"La edición no es JSON válido: {e}") from None

    raise SystemExit("La búsqueda no terminó después de varias continuaciones.")


def _carga_env() -> None:
    env = AQUI / ".env"
    if env.exists() and not os.environ.get("ANTHROPIC_API_KEY"):
        for linea in env.read_text().splitlines():
            clave, _, valor = linea.partition("=")
            if clave.strip() == "ANTHROPIC_API_KEY":
                os.environ["ANTHROPIC_API_KEY"] = valor.strip().strip('"')


# ---------------------------------------------------------------- archivos


SLUG = re.compile(r"^[a-z0-9-]{2,64}$")


def lee_cliente(slug: str) -> dict:
    if not SLUG.match(slug):
        raise SystemExit(f"Slug inválido: {slug!r} (solo minúsculas, números y guiones)")
    ruta = CLIENTES / f"{slug}.toml"
    if not ruta.exists():
        raise SystemExit(f"No existe {ruta}")
    try:
        cliente = tomllib.loads(ruta.read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as error:
        raise SystemExit(f"No se puede leer el cliente {slug}: {error}") from None
    for campo in ("nombre", "giro", "ciudad"):
        if not isinstance(cliente.get(campo), str) or not cliente[campo].strip():
            raise SystemExit(f"Cliente {slug}: falta {campo}")
    return cliente


def lee_indice(carpeta: Path) -> dict:
    ruta = carpeta / "index.json"
    return json.loads(ruta.read_text()) if ruta.exists() else {"ediciones": []}


def guarda(slug: str, hoy: date, ed: dict) -> Path:
    carpeta = DATOS / slug / "radar"
    carpeta.mkdir(parents=True, exist_ok=True)
    indice = lee_indice(carpeta)
    otras = [e for e in indice["ediciones"] if e["fecha"] != hoy.isoformat()]
    numero = max((e.get("numero", 0) for e in otras), default=0) + 1

    edicion = {
        "version": 1,
        "cliente": slug,
        "fecha": hoy.isoformat(),
        "numero": numero,
        "generado": datetime.now(ZONA).isoformat(timespec="seconds"),
        **ed,
        "notas_metodo": "Armada sola por el radar de Mecha con búsqueda web. "
        "Cada nota trae la liga de donde salió; lo que no se pudo confirmar va aparte.",
    }
    destino = carpeta / f"{hoy.isoformat()}.json"
    _escribe_atomico(destino, edicion)
    otras.append({"fecha": hoy.isoformat(), "numero": numero, "titular": ed["portada"]["titulo"]})
    otras.sort(key=lambda e: e["fecha"], reverse=True)
    _escribe_atomico(carpeta / "index.json", {"ediciones": otras})
    return destino


def _escribe_atomico(destino: Path, datos: dict) -> None:
    """Escribe a un temporal y lo cambia de nombre: la app nunca lee un archivo a medias."""
    temporal = destino.with_name(f".{destino.name}.tmp")
    temporal.write_text(json.dumps(datos, ensure_ascii=False, indent=2))
    temporal.replace(destino)


def titulares_previos(slug: str, hoy: date, dias: int = 7) -> list[str]:
    indice = lee_indice(DATOS / slug / "radar")
    desde = (hoy - timedelta(days=dias)).isoformat()
    return [e["titular"] for e in indice["ediciones"] if desde <= e["fecha"] < hoy.isoformat()]


def corre(slug: str, hoy: date, prueba: bool) -> None:
    cliente = lee_cliente(slug)
    if prueba:
        pedir_edicion(cliente, hoy, titulares_previos(slug, hoy), prueba=True)
        return
    carpeta = DATOS / slug / "radar"
    carpeta.mkdir(parents=True, exist_ok=True)
    with open(carpeta / ".candado", "w") as candado:
        try:
            fcntl.flock(candado, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit(f"Ya hay otra edición de {slug} corriendo.") from None
        _corre(slug, cliente, hoy)


def _corre(slug: str, cliente: dict, hoy: date) -> None:
    print(f"Radar · {cliente['nombre']} · {hoy.isoformat()}", file=sys.stderr)
    ed, vistas = pedir_edicion(cliente, hoy, titulares_previos(slug, hoy), prueba=False)
    ed = depura_fuentes(ed, vistas)
    destino = guarda(slug, hoy, ed)
    print(f"  listo: {destino.relative_to(AQUI.parent.parent)}", file=sys.stderr)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    grupo = ap.add_mutually_exclusive_group(required=True)
    grupo.add_argument("--cliente", help="slug del cliente (clientes/<slug>.toml)")
    grupo.add_argument("--todos", action="store_true", help="todos los clientes")
    ap.add_argument("--fecha", help="AAAA-MM-DD (por defecto, hoy en Ciudad de México)")
    ap.add_argument("--prueba", action="store_true", help="imprime la petición y no llama a la API")
    args = ap.parse_args()

    hoy = date.fromisoformat(args.fecha) if args.fecha else datetime.now(ZONA).date()
    slugs = [args.cliente] if args.cliente else sorted(p.stem for p in CLIENTES.glob("*.toml"))
    fallidos = []
    for slug in slugs:
        try:
            corre(slug, hoy, args.prueba)
        except (SystemExit, OSError, ValueError, KeyError, TypeError) as e:
            if args.cliente:
                raise
            print(f"  {slug}: {e}", file=sys.stderr)
            fallidos.append(slug)
    if fallidos:
        raise SystemExit(f"Fallaron: {', '.join(fallidos)}")


if __name__ == "__main__":
    main()
