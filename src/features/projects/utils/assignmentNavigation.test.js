import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentProjectState, assignmentReturnLocation } from './assignmentNavigation.js';

test('opening a worker project retains the exact query, status, archive and list position for return', () => {
  const params = new URLSearchParams({ q: 'רז יצחקי', status: 'עבר לשרטוט', archived: '1' });
  const search = `?${params}`;
  const origin = assignmentReturnLocation(
    assignmentProjectState(search, 932, 'assigned-project-worker-project'),
  );
  assert.equal(origin.pathname, '/app/assignments');
  assert.equal(origin.search, search);
  assert.deepEqual(origin.state.assignmentListRestore, {
    scrollY: 932,
    focusId: 'assigned-project-worker-project',
  });
});

test('the unfiltered worker view still returns to assignments while ordinary project links have no override', () => {
  assert.equal(
    assignmentReturnLocation(assignmentProjectState('', 0, 'button')).pathname,
    '/app/assignments',
  );
  for (const state of [null, undefined, {}, { tab: 'discussion' }, { returnToAssignments: {} }]) {
    assert.equal(assignmentReturnLocation(state), null);
  }
});

test('return state has a fixed local destination and safely handles missing scroll or focus', () => {
  const origin = assignmentReturnLocation({
    returnToAssignments: {
      pathname: 'https://example.com',
      search: '?q=worker',
      scrollY: NaN,
      focusId: 7,
    },
  });
  assert.equal(origin.pathname, '/app/assignments');
  assert.deepEqual(origin.state.assignmentListRestore, { scrollY: 0, focusId: null });
});
