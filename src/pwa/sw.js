// Ported verbatim from public/sw.js — push-notification-only service worker.
// No offline caching/precaching is added here; that would be a behavior
// change from the original app, not a faithful port.

// Let the browser activate and take control on the next normal navigation.
// skipWaiting() + clients.claim() made a first-time registration reload the
// currently open login screen and looked like a failed connection attempt.
self.addEventListener('install', () => {});
self.addEventListener('activate', () => {});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'MAYA – מערכת איתור תשתיות';
  const options = {
    body: payload.body || 'יש עדכון חדש במערכת',
    icon: '/icon.png',
    badge: '/icon.png',
    lang: 'he',
    dir: 'rtl',
    tag: payload.tag || `maya-${Date.now()}`,
    renotify: Boolean(payload.tag),
    data: {
      url:
        typeof payload.url === 'string' && payload.url.startsWith('/') ? payload.url : '/',
    },
  };

  const badgeCount = Number(payload.badgeCount);
  const updateBadge = Number.isFinite(badgeCount) && badgeCount > 0 && 'setAppBadge' in self.navigator
    ? self.navigator.setAppBadge(Math.min(badgeCount, 99))
    : Promise.resolve();

  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    updateBadge,
  ]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = event.notification.data?.url || '/';
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of windows) {
        if ('navigate' in client) await client.navigate(targetUrl);
        if ('focus' in client) return client.focus();
      }

      return self.clients.openWindow(targetUrl);
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
