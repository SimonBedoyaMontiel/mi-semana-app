// Mi Semana — service worker: the app keeps opening without a connection.
// Pages: network first (fresh after each deploy), cache as fallback.
// Hashed build assets: cache first (their names change whenever their content does).
const CACHE = 'mi-semana-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase and others go straight to the network

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put('./', copy))
          return res
        })
        .catch(() => caches.match('./')),
    )
    return
  }

  event.respondWith(
    caches.match(req).then(hit => {
      if (hit && url.pathname.includes('/assets/')) return hit
      const network = fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(req, copy))
        }
        return res
      })
      return hit ? network.catch(() => hit) : network
    }),
  )
})
