import test from 'node:test';
import assert from 'node:assert/strict';
import { startRealtimeRefresh } from './realtimeRefresh.js';

function harness(onRefresh = () => {}) {
  let time = 0;
  let nextId = 0;
  const timers = new Map();
  const win = new EventTarget();
  win.navigator = { onLine: true };
  win.setTimeout = (callback, delay) => { const id = ++nextId; timers.set(id, { at: time + delay, callback }); return id; };
  win.clearTimeout = (id) => timers.delete(id);
  const doc = new EventTarget();
  doc.visibilityState = 'visible';
  const channels = [];
  const removed = [];
  const errors = [];
  const client = {
    channel: () => {
      const channel = { events: [], on(_type, _filter, cb) { this.events.push(cb); return this; },
        subscribe(cb) { this.status = cb; return this; } };
      channels.push(channel);
      return channel;
    },
    removeChannel: async (channel) => { removed.push(channel); },
  };
  let reads = 0;
  const stop = startRealtimeRefresh({ client, channelName: 'test', tables: ['projects', 'project_tasks'],
    onRefresh: () => { reads += 1; return onRefresh(); }, onError: (...args) => errors.push(args),
    pollIntervalMs: 20000, windowTarget: win, documentTarget: doc, now: () => time });
  async function tick(ms) {
    const end = time + ms;
    for (;;) {
      const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      time = due[1].at;
      timers.delete(due[0]);
      void due[1].callback();
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    }
    time = end;
  }
  return { win, doc, channels, removed, errors, timers, stop, tick, get reads() { return reads; } };
}

test('healthy realtime replaces the 20-second poll with one five-minute safety read', async () => {
  const h = harness();
  h.channels[0].status('SUBSCRIBED');
  await h.tick(299999);
  assert.equal(h.reads, 0);
  await h.tick(1);
  assert.equal(h.reads, 1);
  h.channels[0].events[0]();
  h.channels[0].events[1]();
  await h.tick(1000);
  assert.equal(h.reads, 2);
  h.stop();
});

test('unavailable realtime retains fallback polling and reconnect catches missed changes', async () => {
  const h = harness();
  await h.tick(20000);
  assert.equal(h.reads, 1);
  h.channels[0].status('SUBSCRIBED');
  h.channels[0].status('CLOSED');
  await h.tick(2000);
  assert.equal(h.channels.length, 2);
  h.channels[1].status('SUBSCRIBED');
  await h.tick(1);
  assert.equal(h.reads, 2);
  // Late callbacks from the removed channel cannot downgrade the live channel.
  h.channels[0].status('CHANNEL_ERROR');
  await h.tick(20000);
  assert.equal(h.reads, 2);
  h.stop();
});

test('hidden/offline events do not read; focus and visibility coalesce on resume', async () => {
  const h = harness();
  h.channels[0].status('SUBSCRIBED');
  h.doc.visibilityState = 'hidden';
  h.channels[0].events[0]();
  await h.tick(600000);
  assert.equal(h.reads, 0);
  h.doc.visibilityState = 'visible';
  h.win.navigator.onLine = false;
  h.win.dispatchEvent(new Event('focus'));
  await h.tick(1000);
  assert.equal(h.reads, 0);
  h.win.navigator.onLine = true;
  h.win.dispatchEvent(new Event('online'));
  h.doc.dispatchEvent(new Event('visibilitychange'));
  h.win.dispatchEvent(new Event('focus'));
  await h.tick(1);
  assert.equal(h.reads, 1);
  h.stop();
});

test('events during a slow read queue one follow-up without overlapping requests', async () => {
  let release;
  const h = harness(() => new Promise((resolve) => { release = resolve; }));
  h.channels[0].events[0]();
  await h.tick(350);
  assert.equal(h.reads, 1);
  for (let i = 0; i < 10; i += 1) h.channels[0].events[0]();
  await h.tick(40000);
  assert.equal(h.reads, 1);
  release();
  await Promise.resolve();
  await h.tick(350);
  assert.equal(h.reads, 2);
  h.stop();
  release();
  await Promise.resolve();
  await h.tick(400000);
  assert.equal(h.reads, 2);
  assert.equal(h.timers.size, 0);
});

test('refresh errors remain recoverable and cleanup cancels pending reconnects', async () => {
  const h = harness(() => { throw new Error('offline'); });
  h.channels[0].events[0]();
  await h.tick(350);
  assert.equal(h.errors.length, 1);
  await h.tick(20000);
  assert.equal(h.reads, 2);
  h.channels[0].status('CHANNEL_ERROR');
  h.stop();
  await h.tick(400000);
  assert.equal(h.channels.length, 1);
  assert.equal(h.reads, 2);
  assert.equal(h.removed.length, 1);
});
