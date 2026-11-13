// Talents app: keeps the app's own files on the phone so it opens quickly.
// Pages and data always come fresh from the network when there is one.
// Change VERSION on every release: open apps then show "A new version is ready".
const VERSION = 'talents-v137';
const SHELL = ['./', 'index.html', 'app.css?v=43', 'app.js?v=69', 'portal-home.js?v=25', 'people.js?v=6', 'logs.js?v=6', 'calls.js?v=5', 'account.js?v=16', 'course/marketing/course.js?v=20', 'psychology/course.js?v=2', 'learn.js?v=14', 'learn.css?v=4', 'review.js?v=7', 'scoring.js?v=3', 'onboarding.js?v=1', 'library.js?v=1', 'review.css?v=1', 'extras.css?v=8', 'extras-core.js?v=3', 'extras-admin.js?v=2', 'i18n.js?v=5', 'nav.js?v=6', 'work.js?v=4', 'team-plus.js?v=1', 'ar-more.js?v=3', 'numbers-plus.js?v=4', 'learn-plus.js?v=6', 'signin.css?v=1', 'signin.js?v=1', '../ask.js?v=5', '../ask.css?v=3', '../hub.css?v=7', '/portal.css?v=10', '/portal-shell.js?v=12', 'manifest.webmanifest', 'icon-64.png?v=2', 'icon-180.png?v=2', 'icon-192.png?v=2', 'icon-512.png?v=2', '../tracker/config.js', 'tool-files.js?v=2', 'docx-fill.js?v=1', 'round5.js?v=3', 'round6.js?v=1'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL))); }); // waits until the person taps Update
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase and fonts go straight to the network
  e.respondWith(fetch(e.request).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; }).catch(() => caches.match(e.request)));
});
// Phone alerts (round 14): a bell from the portal shows as a notification; tapping it opens that page
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (er) { d = { title: e.data ? e.data.text() : 'Talents' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Talents', { body: d.body || '', tag: d.tag, icon: 'icon-192.png', badge: 'icon-64.png', data: { link: d.link || '/app/' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const link = new URL((e.notification.data && e.notification.data.link) || '/app/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.location.origin + '/app/'));
    if (open) { open.focus(); return open.navigate(link).catch(() => {}); }
    return self.clients.openWindow(link);
  }));
});
