// Talents app: keeps the app's own files on the phone so it opens quickly.
// Pages and data always come fresh from the network when there is one.
// Change VERSION on every release: open apps then show "A new version is ready".
const VERSION = 'talents-v222';
const SHELL = ['./', 'index.html', 'app.css?v=44', 'app.js?v=83', 'portal-home.js?v=32', 'people.js?v=10', 'logs.js?v=8', 'calls.js?v=5', 'account.js?v=19', 'course/marketing/course.js?v=20', 'psychology/course.js?v=2', 'learn.js?v=16', 'learn.css?v=4', 'review.js?v=8', 'scoring.js?v=4', 'onboarding.js?v=1', 'library.js?v=1', 'review.css?v=1', 'extras.css?v=11', 'r17.css?v=5', 'extras-core.js?v=5', 'extras-admin.js?v=5', '/media.js?v=3', '/course/md.js?v=6', 'voice-studio.js?v=24', 'voice-studio.css?v=14', 'i18n.js?v=12', 'nav.js?v=17', 'work.js?v=6', 'team-plus.js?v=9', 'ar-more.js?v=41', 'numbers-plus.js?v=5', 'learn-plus.js?v=6', 'r38.css?v=1', 'r38-auto.js?v=1', 'r39.css?v=1', 'r39-home.js?v=1', 'signin.css?v=1', 'r33-rtl.css?v=2', 'signin.js?v=1', '../ask.js?v=5', '../ask.css?v=3', '../hub.css?v=8', '/portal.css?v=13', '/portal-shell.js?v=16', 'manifest.webmanifest', 'icon-64.png?v=2', 'icon-180.png?v=2', 'icon-192.png?v=2', 'icon-512.png?v=2', '../tracker/config.js?v=4', 'tool-files.js?v=3', 'docx-fill.js?v=2', 'round5.js?v=4', 'round6.js?v=4', 'r17-work.js?v=4', 'r17-hours.js?v=1', 'r17-lists.js?v=1', 'r17-learn.js?v=2', 'r17-status.js?v=1', 'r17-files.js?v=2', 'r20.css?v=2', 'r20-safety.js?v=1', 'r20-reps.js?v=5', 'r19-pay.js?v=3', 'r21-me.js?v=2', 'r21.css?v=1', 'r23.css?v=1', 'r23-settings.js?v=1', 'r23-ar.js?v=2', '/portal-ui.js?v=2', '/portal-ui.css?v=1', 'r22-alerts.js?v=4', 'r22.css?v=1', 'p20-clients.js?v=4', 'p20.css?v=1', 'r29.css?v=1', 'r29-learn.js?v=1', 'r28.css?v=1', 'r28-calls.js?v=2', 'r28-calc.js?v=2', 'r33.css?v=2', 'r33-help.js?v=1', 'r35.css?v=1', 'r35-site.js?v=1', 'r34.css?v=1', 'r36.css?v=1', 'r34-hire.js?v=1', 'r36-client.js?v=1', 'r30.css?v=1', 'r30-builder.js?v=11', '/lesson-fold.js?v=1', '/lesson-fold.css?v=1', 'r31.css?v=2', 'r31-course.js?v=1', '/course/narrate.js?v=4', 'psychology/narrate.js?v=1'];
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
