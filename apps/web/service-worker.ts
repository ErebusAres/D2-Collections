const CORE_CACHE = "guardian-nexus-core-v2";
const RUNTIME_CACHE = "guardian-nexus-runtime-v1";
const CACHE_PREFIX = "guardian-nexus-";
const RUNTIME_LIMIT = 300;
const worker = self as unknown as ServiceWorkerGlobalScope;

worker.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then((cache) => cache.addAll(["/", "/index.html", "/manifest.webmanifest", "/favicon.svg"]))
      .then(() => worker.skipWaiting()),
  );
});

worker.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CORE_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => worker.clients.claim()),
  );
});

worker.addEventListener("fetch", (event: FetchEvent) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === worker.location.origin && url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseForCache = response.clone();
            event.waitUntil(
              caches.open(CORE_CACHE)
                .then((cache) => cache.put("/index.html", responseForCache))
                .catch(() => undefined),
            );
          }
          return response;
        })
        .catch(async () => (await caches.match("/index.html")) || Response.error()),
    );
    return;
  }

  const isLocalAsset = url.origin === worker.location.origin
    && (/^\/assets\//.test(url.pathname)
      || /^\/data\//.test(url.pathname)
      || /\.(?:js|css|woff2?|png|jpe?g|svg|webp|ico|webmanifest)$/.test(url.pathname));
  const isBungieImage = url.hostname.endsWith("bungie.net")
    && /\/common\/destiny2_content\//.test(url.pathname);
  if (isLocalAsset || isBungieImage) event.respondWith(staleWhileRevalidate(request));
});

async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok || response.type === "opaque") {
        await cache.put(request, response.clone());
        await trimCache(cache, RUNTIME_LIMIT);
      }
      return response;
    })
    .catch(() => cached || Response.error());
  return cached || refresh;
}

async function trimCache(cache: Cache, limit: number): Promise<void> {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
}
