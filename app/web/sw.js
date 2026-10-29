// Service worker de la app Mecha: guarda la app y la última edición para verla sin conexión.
// Sube VERSION cuando cambie la lista APP (el código se pide a la red primero; no hace falta en cada cambio).

const PREFIJO = `mecha-app:${new URL(self.registration.scope).pathname}:`;
const VERSION = `${PREFIJO}v5`;
const APP = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/tokens.css",
  "css/app.css",
  "js/app.js",
  "js/datos.js",
  "js/util.js",
  "js/respuestas.js",
  "js/vistas/hoy.js",
  "js/vistas/radar.js",
  "js/vistas/chats.js",
  "js/vistas/contenido.js",
  "js/vistas/web.js",
  "assets/fuentes/Archivo-VF.woff2",
  "assets/fuentes/DMSans-VF.woff2",
  "assets/img/robot-busto-480.webp",
  "assets/img/robot-cuerpo-600.webp",
  "assets/img/favicon-32.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(APP))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(
          claves
            .filter((k) => k.startsWith(PREFIJO) && k !== VERSION)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // Video: directo a la red (las peticiones por rangos no se guardan bien en caché).
  if (url.pathname.endsWith(".mp4")) return;

  // Las navegaciones (?c=<cliente>, #/radar…) se guardan siempre bajo la misma clave: la página sin query.
  const clave =
    e.request.mode === "navigate"
      ? new Request(new URL("./", self.registration.scope))
      : e.request;

  // Fuentes e imágenes casi no cambian: lo guardado primero.
  if (/\.(woff2|png|webp|jpg|svg)$/.test(url.pathname)) {
    e.respondWith(
      caches
        .open(VERSION)
        .then((c) => c.match(clave))
        .then((guardado) => guardado || deLaRed(e, clave)),
    );
    return;
  }

  // Código y datos: primero la red. La copia de esta app se usa sin conexión.
  e.respondWith(
    deLaRed(e, clave).catch(() =>
      caches.open(VERSION).then((c) => c.match(clave, { ignoreSearch: true })),
    ),
  );
});

function deLaRed(e, clave) {
  return fetch(e.request).then((r) => {
    if (r.ok && r.type === "basic") {
      const copia = r.clone();
      e.waitUntil(caches.open(VERSION).then((c) => c.put(clave, copia)));
    }
    return r;
  });
}
