const REQUEST_TIMEOUT_MS = 7000;
const GPR_SYNC_TIMEOUT_MS = 90000;

function timeoutForRequest(input, init, method) {
  try {
    const target = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    if (
      method === 'POST' &&
      target.pathname === '/functions/v1/gpr-microsoft' &&
      typeof init.body === 'string' &&
      JSON.parse(init.body)?.action === 'sync'
    ) {
      return GPR_SYNC_TIMEOUT_MS;
    }
  } catch {
    /* Other requests retain the normal timeout. */
  }
  return REQUEST_TIMEOUT_MS;
}

export async function fetchWithTimeout(input, init = {}) {
  const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const maxAttempts = method === 'GET' || method === 'HEAD' ? 2 : 1;
  const requestTimeout = timeoutForRequest(input, init, method);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const onAbort = () => controller.abort(init.signal?.reason);
    if (init.signal) {
      if (init.signal.aborted) onAbort();
      else init.signal.addEventListener('abort', onAbort, { once: true });
    }
    const timeout = setTimeout(
      () => controller.abort(new Error('Request timed out')),
      requestTimeout,
    );
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      const canRetry = attempt < maxAttempts && !init.signal?.aborted;
      if (!canRetry) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300));
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener('abort', onAbort);
    }
  }
  throw new Error('Network request failed');
}
