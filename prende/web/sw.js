const PREFIX = `prende-static:${new URL(self.registration.scope).pathname}:`;
const CACHE = `${PREFIX}v2`;
const scope = self.registration.scope;
const assets = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/tokens.css",
  "css/estilos.css",
  "js/app.js",
  "js/config.js",
  "js/state.js",
  "js/domain.js",
  "js/ui.js",
  "js/views.js",
  "datos/recetas.json",
  "datos/ruta.json",
  "datos/paquetes.json",
  "assets/fuentes/Archivo-VF.woff2",
  "assets/fuentes/DMSans-VF.woff2",
  "assets/img/robot-busto-480.webp",
  "assets/img/robot-cuerpo-600.webp",
  "assets/img/favicon-32.png",
  "assets/img/apple-touch-icon.png",
  "assets/img/icono-512-192.png",
  "assets/img/icono-512-512.png",
  "assets/img/icono-maskable-192.png",
  "assets/img/icono-maskable-512.png",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(
        assets.map(
          (path) => new Request(new URL(path, scope), { cache: "reload" }),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await Promise.all(
        (await caches.keys())
          .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    /\/api(?:\/|$)/.test(url.pathname)
  )
    return;
  if (!url.href.startsWith(scope)) return;
  // Siempre pide la red. Solo recurre a la copia local cuando no hay conexión.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      let response;
      try {
        response = await fetch(event.request);
      } catch {
        return (
          (await cache.match(event.request)) ||
          (event.request.mode === "navigate"
            ? await cache.match(new URL("index.html", scope))
            : undefined) ||
          new Response("Sin conexión y sin copia local", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }
      if (response.ok) {
        try {
          await cache.put(event.request, response.clone());
        } catch {
          /* Sin espacio: la respuesta de red sigue funcionando. */
        }
      }
      return response;
    })(),
  );
});
