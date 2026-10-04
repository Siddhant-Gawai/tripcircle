const CACHE = "tripcircle-public-v2";
const base = new URL("./", self.location.href);
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new URL("offline.html", base).href)),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("tripcircle-public-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== base.origin ||
    !url.pathname.startsWith(base.pathname) ||
    url.search ||
    request.headers.has("Authorization")
  )
    return;
  const relative = url.pathname.slice(base.pathname.length);
  const isPage = request.mode === "navigate";
  const isStatic = /^(assets|photos|icons)\//.test(relative);
  if (!isPage && !isStatic) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
          const keys = await cache.keys();
          if (keys.length > 80)
            await cache.delete(
              keys.find((key) => !key.url.endsWith("offline.html")),
            );
        }
        return response;
      } catch {
        return (
          (await cache.match(request)) ||
          (isPage
            ? await cache.match(new URL("offline.html", base).href)
            : Response.error())
        );
      }
    })(),
  );
});
