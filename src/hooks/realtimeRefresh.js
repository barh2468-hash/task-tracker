const RECONNECT_STATUSES = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);

// Realtime handles normal updates. Polling is a safety net, not a second
// continuous source of the same reads. Keep at most one refresh in flight.
export function startRealtimeRefresh({
  client, channelName, tables, onRefresh, onError = console.warn,
  debounceMs = 350, pollIntervalMs = 30000, safetyIntervalMs = 300000,
  windowTarget = window, documentTarget = document, now = Date.now,
}) {
  let stopped = false;
  let subscribed = false;
  let everSubscribed = false;
  let channel = null;
  let refreshTimer = null;
  let pollTimer = null;
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let running = false;
  let pending = false;
  let lastStarted = -Infinity;
  const canRefresh = () => !stopped && documentTarget.visibilityState === 'visible'
    && windowTarget.navigator?.onLine !== false;

  function scheduleRefresh(delay = debounceMs) {
    if (!pending || running || refreshTimer !== null || !canRefresh()) return;
    refreshTimer = windowTarget.setTimeout(async () => {
      refreshTimer = null;
      if (!canRefresh()) return;
      pending = false;
      running = true;
      lastStarted = now();
      try {
        await onRefresh();
      } catch (error) {
        onError(`${channelName} refresh failed:`, error instanceof Error ? error.message : error);
      } finally {
        running = false;
        scheduleRefresh();
      }
    }, Math.max(delay, 1000 - (now() - lastStarted)));
  }

  function requestRefresh(delay = debounceMs) {
    if (stopped) return;
    pending = true;
    scheduleRefresh(delay);
  }

  function schedulePoll() {
    windowTarget.clearTimeout(pollTimer);
    if (stopped) return;
    pollTimer = windowTarget.setTimeout(() => {
      if (canRefresh()) requestRefresh(0);
      schedulePoll();
    }, subscribed ? Math.max(safetyIntervalMs, pollIntervalMs) : pollIntervalMs);
  }

  function connect() {
    if (stopped) return;
    const nextChannel = client.channel(`${channelName}-${now()}`);
    for (const table of tables) {
      nextChannel.on('postgres_changes', { event: '*', schema: 'public', table }, () => requestRefresh());
    }
    channel = nextChannel;
    nextChannel.subscribe((status) => {
      if (stopped || channel !== nextChannel) return;
      if (status === 'SUBSCRIBED') {
        const reconnected = everSubscribed && !subscribed;
        everSubscribed = true;
        subscribed = true;
        reconnectAttempt = 0;
        windowTarget.clearTimeout(reconnectTimer);
        reconnectTimer = null;
        schedulePoll();
        if (reconnected) requestRefresh(0);
        return;
      }
      if (!RECONNECT_STATUSES.has(status)) return;
      if (subscribed) {
        subscribed = false;
        schedulePoll();
      }
      if (reconnectTimer !== null) return;
      reconnectAttempt += 1;
      reconnectTimer = windowTarget.setTimeout(async () => {
        reconnectTimer = null;
        if (stopped) return;
        const staleChannel = channel;
        channel = null;
        try {
          if (staleChannel) await client.removeChannel(staleChannel);
        } catch (error) {
          onError(`${channelName} channel cleanup failed:`, error);
        }
        if (stopped) return;
        connect();
      }, Math.min(15000, 1000 * (2 ** Math.min(reconnectAttempt, 4))));
    });
  }

  const resume = () => { if (canRefresh()) requestRefresh(0); };
  connect();
  schedulePoll();
  documentTarget.addEventListener('visibilitychange', resume);
  windowTarget.addEventListener('focus', resume);
  windowTarget.addEventListener('online', resume);

  return () => {
    stopped = true;
    windowTarget.clearTimeout(refreshTimer);
    windowTarget.clearTimeout(pollTimer);
    windowTarget.clearTimeout(reconnectTimer);
    documentTarget.removeEventListener('visibilitychange', resume);
    windowTarget.removeEventListener('focus', resume);
    windowTarget.removeEventListener('online', resume);
    if (channel) void Promise.resolve(client.removeChannel(channel)).catch(() => {});
  };
}
