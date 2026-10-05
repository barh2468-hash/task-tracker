const PRECACHE_ENTRIES = self.__WB_MANIFEST;
// index.html references the fingerprinted app bundle, so its revision identifies
// the shell. Older workers must never overwrite a newer release's offline HTML.
const SHELL_REVISION = PRECACHE_ENTRIES.find((entry) => entry.url === 'index.html')?.revision;
const CACHE_NAME = `maya-app-shell-v2-${SHELL_REVISION}`;
const PRECACHE_REQUESTS = PRECACHE_ENTRIES.map(
  (entry) => new Request(new URL(entry.url, self.location.origin), { cache: 'reload' }),
);

// Activate updated push/badge handling immediately. The page no longer reloads
// on controllerchange, so this does not bring back the former login-screen jump.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_REQUESTS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('maya-app-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))),
  ]));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      // Network-first alone can still return Safari's HTTP-cached old HTML.
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy))
                .catch((error) => console.warn('Offline shell cache update failed:', error)),
            );
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match('/index.html')) || cache.match('/');
        }),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        event.waitUntil(
          cache.put(request, response.clone())
            .catch((error) => console.warn('Offline asset cache update failed:', error)),
        );
      }
      return response;
    }),
  );
});

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
