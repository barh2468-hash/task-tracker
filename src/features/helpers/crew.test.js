import test from 'node:test';
import assert from 'node:assert/strict';
import { crewEditOptions, helperCrew, sameCrewMember } from './crew.js';

test('managed helper choices retain the crew format accepted by online and offline reporting', () => {
  assert.deepEqual(helperCrew(['יובל', 'Original Ω']), [
    { id: null, name: 'יובל', source: 'helper' }, { id: null, name: 'Original Ω', source: 'helper' },
  ]);
});

test('renamed and inactive helpers stay in historical sessions without leaking into new report choices', () => {
  const original = { id: null, name: 'Old name Ω', source: 'helper' };
  const current = { id: null, name: 'Current name', source: 'helper' };
  const session = { worker_id: 'self', crew_members: [original, current] };
  const helpers = [{ id: 'one', name: 'Current name', is_active: true }, { id: 'two', name: 'Inactive', is_active: false }];
  const options = crewEditOptions([{ id: 'self', full_name: 'Self' }], helpers, session);
  assert.deepEqual(options, [current, original]);
  assert.ok(sameCrewMember(options[1], original));
  assert.deepEqual(session.crew_members, [original, current]);
  assert.deepEqual(crewEditOptions([], helpers, { crew_members: [] }), [current]);
});

test('system employees and helpers with the same name remain distinct', () => {
  const options = crewEditOptions([{ id: 'worker', full_name: 'Shared name' }], [{ name: 'Shared name', is_active: true }], {});
  assert.equal(options.length, 2);
  assert.equal(sameCrewMember(options[0], options[1]), false);
});
