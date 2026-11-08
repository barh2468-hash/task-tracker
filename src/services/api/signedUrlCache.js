// Keep signing traffic bounded across all mounted file panels. URLs stay in
// memory only and are discarded when the signed-in account changes.
export function createSignedUrlCache({ sign, now = Date.now, concurrency = 3, maxEntries = 200 }) {
  const entries = new Map();
  const queue = [];
  let running = 0;
  const cancelled = () => ({ data: null, error: new DOMException('Storage request cancelled', 'AbortError') });

  function pump() {
    while (running < concurrency && queue.length) {
      const entry = queue.shift();
      if (entries.get(entry.key) !== entry) {
        entry.resolve(cancelled());
        continue;
      }
      running += 1;
      const started = now();
      Promise.resolve().then(() => sign(...entry.args)).catch((error) => ({ data: null, error }))
        .then((result) => {
          if (entries.get(entry.key) !== entry) {
            entry.resolve(cancelled());
            return;
          }
          if (result?.error || !result?.data?.signedUrl) entries.delete(entry.key);
          else {
            const lifetime = entry.args[2] * 1000;
            entry.expiresAt = started + lifetime - Math.min(30000, lifetime / 10);
            entry.complete = true;
            // Pending work must remain addressable so duplicate calls coalesce.
            for (const [key, value] of entries) {
              if (entries.size <= maxEntries) break;
              if (value.complete) entries.delete(key);
            }
          }
          entry.resolve(entry.complete ? { ...result, expiresAt: entry.expiresAt } : result);
        }).finally(() => { running -= 1; pump(); });
    }
  }

  return {
    get(bucket, path, expiresIn = 3600, options) {
      const key = JSON.stringify([bucket, path, expiresIn, options || null]);
      const existing = entries.get(key);
      if (existing && (!existing.complete || existing.expiresAt > now())) return existing.promise;
      const entry = { key, args: [bucket, path, expiresIn, options] };
      entry.promise = new Promise((resolve) => { entry.resolve = resolve; });
      entries.set(key, entry);
      queue.push(entry);
      pump();
      return entry.promise;
    },
    clear() { entries.clear(); pump(); },
    invalidate(bucket, paths) {
      for (const [key, entry] of entries) {
        if (entry.args[0] === bucket && paths.includes(entry.args[1])) entries.delete(key);
      }
      pump();
    },
  };
}
