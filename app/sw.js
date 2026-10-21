// Talents app: keeps the app's own files on the phone so it opens quickly.
// Pages and data always come fresh from the network when there is one.
// Change VERSION on every release: open apps then show "A new version is ready".
const VERSION = 'talents-v33';
const SHELL = ['./', 'index.html', 'app.css?v=15', 'app.js?v=28', 'account.js?v=6', '../ask.js?v=3', '../ask.css?v=2', '../theme.js?v=2', '../theme-switch.css?v=2', '../daylight-dark.css?v=2', '../brand.css?v=2', 'manifest.webmanifest', 'icon-64.png', 'icon-180.png', 'icon-192.png', 'icon-512.png', '../tracker/config.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL))); }); // waits until the person taps Update
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase and fonts go straight to the network
  e.respondWith(fetch(e.request).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; }).catch(() => caches.match(e.request)));
});
