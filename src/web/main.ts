import { createWebApi } from './api'

window.api = createWebApi()

// Offline support: the service worker caches the app shell after the first visit.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js'))
}

// The shared UI reads window.api while loading, so it is imported only after the API exists.
void import('../renderer/src/main')
