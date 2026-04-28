// ============================================
// SERVICE WORKER — InsightHealth PWA
// ============================================
// Este archivo corre en segundo plano en el navegador.
// Su trabajo: guardar copias de la app para que funcione sin internet.

const CACHE_NAME = "insighthealth-v1";

// Archivos que se guardan en caché al instalar la app
const FILES_TO_CACHE = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// INSTALL: Se ejecuta una sola vez cuando el service worker se instala.
// Abre el caché y guarda los archivos principales.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// ACTIVATE: Limpia cachés viejos cuando hay una versión nueva.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// FETCH: Intercepta cada petición de red.
// Estrategia: "Network first, cache fallback"
// → Intenta descargar desde internet primero.
// → Si no hay conexión, sirve desde el caché guardado.
self.addEventListener("fetch", (event) => {

  // ❌ Ignorar cosas raras (chrome-extension, etc)
  if (!event.request.url.startsWith("http")) return;

  // ❌ No interceptar APIs externas
  if (
    event.request.url.includes("googleapis.com") ||
    event.request.url.includes("generativelanguage") ||
    event.request.url.includes("api.anthropic.com")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {

        // Solo guardar si es válido
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
        }

        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
