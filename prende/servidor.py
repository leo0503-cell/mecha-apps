# /// script
# requires-python = ">=3.11"
# dependencies = ["anthropic>=1.11.0"]
# ///
"""Servidor de Prende: sirve la app (web/) y la Mesa de trabajo con IA.

    uv run servidor.py                 # http://localhost:4190
    uv run servidor.py --puerto 8080

Sin ANTHROPIC_API_KEY (en el entorno o en prende/.env) la app funciona igual,
pero la Mesa de trabajo cae en modo sin conexión: arma la receta para copiarla
en cualquier chat de IA. La llave nunca se manda al navegador.
"""

from __future__ import annotations

import argparse
import errno
import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

AQUI = Path(__file__).resolve().parent
WEB = AQUI / "web"
RECETAS = json.loads((WEB / "datos" / "recetas.json").read_text(encoding="utf-8"))[
    "recetas"
]

MODELO = "claude-sonnet-5-5"
MAX_PEDIDO = 4000  # caracteres
CAMPOS_PERFIL = ("negocio", "giro", "ciudad", "vende", "cliente", "tono")

SISTEMA = """Eres la Mesa de trabajo de Prende, la guía de IA de Mecha (agencia de IA y \
automatización para PyMEs mexicanas). Te escribe el dueño o alguien del equipo de una PyME.

Tu trabajo, en este orden:
1. RESUELVE lo que te piden, de verdad y ya: el mensaje, el correo, el guion, la lista, el plan. \
Entrega el resultado listo para usar, no consejos sobre cómo hacerlo.
2. Clasifica el pedido con honestidad:
   - "resuelto": con tu respuesta ya quedó.
   - "receta": es algo que van a repetir; diles qué receta del recetario usar la próxima vez.
   - "servicio": lo que necesitan no se resuelve con un chat (contestar WhatsApp 24/7, cotizar \
solo, agendar solo, producir contenido cada semana, una página web, conectar sistemas). \
Ahí sugiere el paquete de Mecha que corresponde. No vendas de más: si con una receta basta, dilo.

Reglas:
- Español de México, tuteando, directo. Nada de "revoluciona", "potencia", "soluciones integrales".
- Ningún número se inventa: precios, fechas, cifras o datos del negocio que no te dieron van entre \
[corchetes] para que la persona los llene.
- Si el pedido trae datos sensibles (contraseñas, tarjetas, RFC o CURP de terceros, datos de salud), \
no los repitas y avisa en "aviso" que no deben compartirse con una IA.
- No prometas tiempos ni resultados de Mecha.
- Formato de "respuesta": texto plano con saltos de línea; listas con "- ". Sin markdown de encabezados.

Paquetes de Mecha: chispa (asistente de WhatsApp que contesta lo de siempre), mecha (además \
cotiza, agenda, reporte diario y radar de competencia), contenido (además página web, 2 posts y \
1 reel por semana, imagen y campaña en Meta), taller (capacitar al equipo en IA), \
acompanamiento (hacer la ruta de 30 días con alguien de Mecha).

Recetas disponibles (id: título):
""" + "\n".join(f"- {r['id']}: {r['titulo']}" for r in RECETAS)

ESQUEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "respuesta",
        "tipo",
        "receta",
        "paquete",
        "razon",
        "siguiente_paso",
        "aviso",
    ],
    "properties": {
        "respuesta": {
            "type": "string",
            "description": "El trabajo resuelto, listo para usar.",
        },
        "tipo": {"type": "string", "enum": ["resuelto", "receta", "servicio"]},
        "receta": {
            "type": ["string", "null"],
            "enum": [r["id"] for r in RECETAS] + [None],
        },
        "paquete": {
            "type": ["string", "null"],
            "enum": ["chispa", "mecha", "contenido", "taller", "acompanamiento", None],
        },
        "razon": {
            "type": "string",
            "description": "Una línea: por qué esa clasificación.",
        },
        "siguiente_paso": {
            "type": "string",
            "description": "Una acción concreta para hoy.",
        },
        "aviso": {
            "type": ["string", "null"],
            "description": "Solo si hubo datos sensibles.",
        },
    },
}


def cargar_env() -> None:
    env = AQUI / ".env"
    if not env.exists():
        return
    for linea in env.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if linea and not linea.startswith("#") and "=" in linea:
            clave, valor = linea.split("=", 1)
            os.environ.setdefault(clave.strip(), valor.strip().strip('"').strip("'"))


def resolver(perfil: dict, pedido: str) -> dict:
    import anthropic

    datos = "\n".join(
        f"- {c}: {str(perfil.get(c) or '[sin dato]')[:200]}" for c in CAMPOS_PERFIL
    )
    mensaje = f"Perfil del negocio:\n{datos}\n\nPedido:\n{pedido}"
    resp = anthropic.Anthropic().beta.messages.create(
        model=MODELO,
        max_tokens=4000,
        system=SISTEMA,
        output_config={
            "effort": "low",
            "format": {"type": "json_schema", "schema": ESQUEMA},
        },
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        messages=[{"role": "user", "content": mensaje}],
    )
    texto = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
    return json.loads(texto)


class Manejador(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(WEB), **k)

    def _json(self, codigo: int, cuerpo: dict) -> None:
        datos = json.dumps(cuerpo, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(datos)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(datos)

    def do_GET(self):
        if self.path == "/api/estado":
            return self._json(200, {"ia": bool(os.environ.get("ANTHROPIC_API_KEY"))})
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/mesa":
            return self._json(404, {"error": "No existe"})
        if (
            self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
            != "application/json"
        ):
            return self._json(415, {"error": "Usa application/json"})
        origen = self.headers.get("Origin")
        if origen and origen not in {
            f"http://{self.headers.get('Host')}",
            f"https://{self.headers.get('Host')}",
        }:
            return self._json(403, {"error": "Origen no permitido"})
        if not os.environ.get("ANTHROPIC_API_KEY"):
            return self._json(503, {"error": "sin_llave"})
        try:
            largo = int(self.headers.get("Content-Length", 0))
            if largo <= 0:
                return self._json(400, {"error": "Petición inválida"})
            if largo > 20_000:
                return self._json(413, {"error": "Pedido demasiado largo"})
            entrada = json.loads(self.rfile.read(largo) or b"{}")
            if not isinstance(entrada, dict) or not isinstance(
                entrada.get("pedido"), str
            ):
                return self._json(400, {"error": "Petición inválida"})
            pedido = entrada["pedido"].strip()
            if len(pedido) > MAX_PEDIDO:
                return self._json(413, {"error": "Pedido demasiado largo"})
            perfil = (
                entrada.get("perfil") if isinstance(entrada.get("perfil"), dict) else {}
            )
        except (ValueError, json.JSONDecodeError):
            return self._json(400, {"error": "Petición inválida"})
        if not pedido:
            return self._json(400, {"error": "Escribe qué necesitas"})
        try:
            return self._json(200, resolver(perfil, pedido))
        except Exception as e:  # noqa: BLE001 — cualquier falla de la API se reporta igual
            print(f"[mesa] error: {type(e).__name__}: {e}", file=sys.stderr)
            return self._json(
                502, {"error": "La IA no respondió. Intenta de nuevo en un momento."}
            )

    def end_headers(self):
        # Código y datos siempre frescos: el service worker decide el caché.
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--puerto", type=int, default=4190)
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args()
    cargar_env()
    ia = (
        "con IA"
        if os.environ.get("ANTHROPIC_API_KEY")
        else "SIN llave: Mesa en modo sin conexión"
    )
    try:
        servidor = ThreadingHTTPServer((args.host, args.puerto), Manejador)
    except OSError as e:
        if e.errno == errno.EADDRINUSE:
            sys.exit(
                f"El puerto {args.puerto} ya está en uso: Prende ya corre en otra ventana. Ábrela en "
                f"http://localhost:{args.puerto} o usa --puerto 4191."
            )
        raise
    print(f"Prende en http://localhost:{args.puerto} ({ia})")
    servidor.serve_forever()


if __name__ == "__main__":
    main()
