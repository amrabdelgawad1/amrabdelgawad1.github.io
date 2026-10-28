// Talents app: keeps the app's own files on the phone so it opens quickly.
// Pages and data always come fresh from the network when there is one.
// Change VERSION on every release: open apps then show "A new version is ready".
const VERSION = 'talents-v75';
const SHELL = ['./', 'index.html', 'app.css?v=18', 'app.js?v=47', 'account.js?v=10', 'course/marketing/course.js?v=19', 'course-marketing.js?v=3', 'course-marketing-1.js?v=1', 'course-marketing-2.js?v=1', 'course-marketing-3.js?v=2', 'course-marketing-4.js?v=2', 'course-marketing-5.js?v=2', 'learn.js?v=9', 'learn.css?v=4', '../ask.js?v=4', '../ask.css?v=3', '../theme.js?v=2', '../theme-switch.css?v=2', '../daylight-dark.css?v=2', '../brand.css?v=2', '../hub.css?v=4', '../hub-art.js?v=1', 'manifest.webmanifest', 'icon-64.png?v=2', 'icon-180.png?v=2', 'icon-192.png?v=2', 'icon-512.png?v=2', '../tracker/config.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL))); }); // waits until the person taps Update
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase and fonts go straight to the network
  e.respondWith(fetch(e.request).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; }).catch(() => caches.match(e.request)));
});
