// Acquisitions Playbook: keeps the app's own files on the phone so it opens quickly and installs.
// Pages and files always come fresh from the network when there is one; the copy here is only for offline.
// Course content, progress and images come from Supabase and are never stored here.
// Change VERSION on every release.
const VERSION = 'course-v12';
const SHELL = ['./', 'index.html', 'course.css?v=2', 'hub.css?v=6', '/portal.css?v=3', '/portal-shell.js?v=2', 'md.js?v=1', 'app.js?v=7', 'practice.js?v=3', 'admin.js?v=3', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png', '/guard.js?v=1', '/tracker/config.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('course-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase and fonts go straight to the network
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: url.pathname.endsWith('/') }).then(r => r || caches.match('index.html'))));
});
