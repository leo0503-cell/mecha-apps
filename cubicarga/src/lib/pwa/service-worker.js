/* Solo archivos públicos y shells anónimos; nunca cachea API, auth o enlaces. */
let version = "cubicarga-build";
const publicas = [
  "/",
  "/calculadora",
  "/herramientas",
  "/catalogos",
  "/catalogos/materiales",
  "/catalogos/equipos",
  "/catalogos/tarimas",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/logo-cubo.svg",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const r = await fetch("/offline-assets.json", { cache: "no-store" });
      if (!r.ok) throw new Error("Assets offline no disponibles");
      const data = await r.json();
      version = "cubicarga-" + data.version;
      const cache = await caches.open(version);
      const urls = [...publicas, ...data.assets];
      await Promise.all(
        urls.map(async (url) => {
          const response = await fetch(url, { credentials: "omit" });
          if (!response.ok) throw new Error("No se pudo cachear " + url);
          await cache.put(url, response);
        }),
      );
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      const propios = nombres.filter((n) => n.startsWith("cubicarga-"));
      if (version === "cubicarga-v1" && propios.length)
        version = propios[propios.length - 1];
      await Promise.all(
        propios
          .filter(
            (n) =>
              n !== version && n !== propios.filter((x) => x !== version).pop(),
          )
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
      const clients = await self.clients.matchAll();
      clients.forEach((c) => c.postMessage({ tipo: "OFFLINE_LISTO" }));
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/p/") ||
    request.headers.get("rsc")
  )
    return;
  const shell = publicas.includes(url.pathname),
    asset =
      url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/img/") ||
      url.pathname.startsWith("/ilustraciones/");
  if (!shell && !asset) return;
  event.respondWith(
    (async () => {
      const cacheActual = await caches.open(version);
      const hit =
        (await cacheActual.match(request)) ||
        (await cacheActual.match(url.pathname)) ||
        (await caches.match(request));
      if (asset && hit) {
        // Una respuesta reconstruida conserva la URL solicitada, incluidos
        // los params del bootstrap Worker de Turbopack.
        const headers = new Headers(hit.headers);
        headers.delete("content-encoding");
        headers.delete("content-length");
        return new Response(hit.body, { status: hit.status, headers });
      }
      try {
        const response = await fetch(request);
        if (response.ok) {
          const names = await caches.keys();
          const name = names.filter((n) => n.startsWith("cubicarga-")).pop();
          if (name && (asset || shell))
            await (await caches.open(name)).put(request, response.clone());
        }
        return response;
      } catch {
        if (hit) return hit;
        return new Response(
          "Sin conexión: abre la calculadora cuando tengas red para preparar el uso offline",
          {
            status: 503,
            headers: { "Content-Type": "text/plain;charset=utf-8" },
          },
        );
      }
    })(),
  );
});
