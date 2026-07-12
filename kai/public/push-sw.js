/* ============================================================
   THE VOICE (§14.2) — Web Push handler, imported by the generated
   service worker (see vite.config importScripts). Displays the morning
   dispatch and true-alarm interrupts sent by /api/pulse; a tap focuses
   or opens KAI. Plain JS so the precache/offline SW stays untouched.
   ============================================================ */

self.addEventListener('push', (event) => {
  let data = { title: 'KAI', body: '', tag: 'kai' };
  try { if (event.data) data = Object.assign(data, event.data.json()); } catch (e) { /* text or malformed */ }
  event.waitUntil(
    self.registration.showNotification(data.title || 'KAI', {
      body: data.body,
      tag: data.tag || 'kai',
      icon: '/icon.svg',
      badge: '/icon.svg',
      renotify: false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow('/');
  })());
});
