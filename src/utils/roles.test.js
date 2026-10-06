import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdminRole, isManagerRole } from './roles.js';

test('administrators inherit manager capabilities', () => {
  assert.equal(isManagerRole('admin'), true);
  assert.equal(isManagerRole('manager'), true);
  assert.equal(isManagerRole('field_worker'), false);
});

test('administrator-only capabilities stay exclusive to administrators', () => {
  assert.equal(isAdminRole('admin'), true);
  assert.equal(isAdminRole('manager'), false);
});
