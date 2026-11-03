import test from 'node:test';
import assert from 'node:assert/strict';
import { readProjectPages } from './readProjectPages.js';

test('project reads reach past the API cap in bounded pages without losing old linked projects', async () => {
  const rows = Array.from({ length: 1101 }, (_, id) => ({ id: String(id) }));
  const calls = [];
  const result = await readProjectPages(() => ({ range: async (from, to) => {
    calls.push([from, to]);
    return { data: rows.slice(from, to + 1), status: 200 };
  } }));
  assert.deepEqual(result.data, rows);
  assert.equal(result.data.at(-1).id, '1100');
  assert.ok(calls.every(([from, to]) => to - from === 79));
});

test('an unrecoverable later page returns an error instead of a partial authorized list', async () => {
  const result = await readProjectPages(() => ({ range: async (from) => from === 0
    ? { data: Array.from({ length: 80 }, (_, id) => ({ id })) }
    : { data: null, error: { code: '57014' }, status: 500 } }));
  assert.equal(result.data, null);
  assert.equal(result.error.code, '57014');
});

test('temporary server failures retry the same page once; access errors are propagated', async () => {
  let calls = 0;
  const result = await readProjectPages(() => ({ range: async () => ++calls === 1
    ? { error: { code: '57014' }, status: 500 } : { data: [{ id: 'recovered' }], status: 200 } }));
  assert.equal(calls, 2);
  assert.equal(result.data[0].id, 'recovered');
  calls = 0;
  const denied = await readProjectPages(() => ({ range: async () => {
    calls += 1;
    return { error: { code: '42501' }, status: 403 };
  } }));
  assert.equal(calls, 1);
  assert.equal(denied.error.code, '42501');
});

test('light parent reads can use 500 rows per page and still load beyond the API cap', async () => {
  const rows = Array.from({ length: 1101 }, (_, id) => ({ id }));
  const calls = [];
  const result = await readProjectPages(() => ({ range: async (from, to) => {
    calls.push([from,to]);
    return { data: rows.slice(from,to+1) };
  } }), { pageSize: 500 });
  assert.deepEqual(result.data, rows);
  assert.deepEqual(calls, [[0,499],[500,999],[1000,1499]]);
  await assert.rejects(readProjectPages(() => {}, { pageSize: 1001 }), RangeError);
});
