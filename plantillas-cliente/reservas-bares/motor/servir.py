"""Sirve un demo de bar sin que el navegador guarde copias viejas del código.

Uso (desde la carpeta demo/ de cada bar):
    python3 motor/servir.py 4230

Igual que `python3 -m http.server`, pero cada respuesta lleva `Cache-Control: no-store`: así, después
de cambiar el motor, una pestaña abierta de antes ya no se queda con el app.js o los estilos viejos.
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class SinCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    servidor = ThreadingHTTPServer(("127.0.0.1", puerto), partial(SinCache, directory="."))
    print(f"Sirviendo en http://localhost:{puerto}")
    servidor.serve_forever()


if __name__ == "__main__":
    main()
