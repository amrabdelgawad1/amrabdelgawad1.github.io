// Talents app: keeps the app's own files on the phone so it opens quickly.
// Pages and data always come fresh from the network when there is one.
// Change VERSION on every release: open apps then show "A new version is ready".
const VERSION = 'talents-v88';
const SHELL = ['./', 'index.html', 'app.css?v=21', 'app.js?v=56', 'portal-home.js?v=1', 'people.js?v=1', 'account.js?v=12', 'course/marketing/course.js?v=20', 'psychology/course.js?v=1', 'learn.js?v=13', 'learn.css?v=4', 'review.js?v=5', 'review.css?v=1', '../ask.js?v=4', '../ask.css?v=3', '../theme.js?v=2', '../theme-switch.css?v=2', '../daylight-dark.css?v=2', '../brand.css?v=2', '../hub.css?v=6', '../hub-art.js?v=1', '/portal.css?v=3', '/portal-shell.js?v=2', 'manifest.webmanifest', 'icon-64.png?v=2', 'icon-180.png?v=2', 'icon-192.png?v=2', 'icon-512.png?v=2', '../tracker/config.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL))); }); // waits until the person taps Update
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase and fonts go straight to the network
  e.respondWith(fetch(e.request).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; }).catch(() => caches.match(e.request)));
});
