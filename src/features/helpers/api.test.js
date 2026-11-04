import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { readProjectPages } from '../../services/api/readProjectPages.js';

function fixture({ error = null } = {}) {
  const calls = [];
  const events = [];
  const rows = Array.from({ length: 145 }, (_, i) => ({ id: String(i), name: `Original Ω ${i}`, is_active: i % 2 === 0 }));
  const supabase = { from(table) {
    const call = { table, filters: [] };
    const result = () => ({ data: rows.filter((row) => call.filters.every(([key, value]) => row[key] === value)), error });
    const query = { select() { return this; }, order() { return this; },
      eq(key, value) { call.filters.push([key, value]); return this; },
      insert(payload) { call.insert = payload; return this; }, update(payload) { call.update = payload; return this; },
      async range(from, to) { calls.push(call); const response = result(); return { ...response, data: response.data.slice(from, to + 1) }; },
      async single() { calls.push(call); return { data: { id: 'saved', ...call.insert, ...call.update }, error }; },
    };
    return query;
  } };
  const module = { exports: {} };
  const source = transformSync(readFileSync(new URL('./api.js', import.meta.url), 'utf8'), { format: 'cjs' }).code;
  new Function('require', 'module', 'exports', 'window', source)((name) => name.includes('supabase') ? { supabase } : { readProjectPages }, module, module.exports,
    { dispatchEvent: (event) => events.push(event.type) });
  return { api: module.exports, calls, events };
}

test('helper lists paginate completely, and new-report choices exclude inactive records', async () => {
  const { api } = fixture();
  assert.equal((await api.listHelpers()).length, 145);
  const active = await api.listHelpers({ activeOnly: true });
  assert.equal(active.length, 73);
  assert.ok(active.every((row) => row.is_active));
});
test('directory mutations send only editable fields and signal crew pickers after a confirmed save', async () => {
  const { api, calls, events } = fixture();
  await api.saveHelper(null, { name: '  New Ω  ', role: 'admin', id: 'injected' });
  await api.saveHelper('existing', { name: 'Renamed Ω', is_active: false, created_at: 'injected' });
  assert.deepEqual(calls[0].insert, { name: 'New Ω' });
  assert.deepEqual(calls[1].update, { name: 'Renamed Ω', is_active: false });
  assert.deepEqual(calls[1].filters, [['id', 'existing']]);
  assert.deepEqual(events, ['maya-helpers-changed', 'maya-helpers-changed']);
});
test('failed helper reads and writes are errors, never empty lists or successful updates', async () => {
  const error = { code: '42501' };
  const { api, events } = fixture({ error });
  await assert.rejects(api.listHelpers(), (value) => value === error);
  await assert.rejects(api.saveHelper('existing', { is_active: false }), (value) => value === error);
  assert.deepEqual(events, []);
});
