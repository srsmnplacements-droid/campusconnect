// CampusConnect service worker.
// It does NOT store student data. It only shows a friendly page when the phone is offline.
const CACHE = 'campusconnect-offline-v3'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./offline.html', './logo.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  // Only page openings are handled. Everything else (data, files) always goes to the network.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./offline.html')))
  }
})

// ---- phone notifications ----
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = { title: 'CampusConnect', body: event.data ? event.data.text() : '' } }
  event.waitUntil(self.registration.showNotification(data.title || 'CampusConnect', {
    body: data.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/favicon.png',
    tag: data.tag || undefined,
    data: { url: data.url || './' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || './'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          try { if ('navigate' in c) c.navigate(url) } catch (e) { /* ignore */ }
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
