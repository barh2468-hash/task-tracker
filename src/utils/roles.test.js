import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdminRole, isManagerRole, isViewerRole, canViewAllRole } from './roles.js';

test('viewers have global visibility without manager or administrator privileges', () => {
  assert.equal(isViewerRole('viewer'), true);
  assert.equal(canViewAllRole('viewer'), true);
  assert.equal(isManagerRole('viewer'), false);
  assert.equal(isAdminRole('viewer'), false);
  assert.equal(canViewAllRole('demo'), false);
  assert.equal(canViewAllRole('field_worker'), false);
  assert.equal(canViewAllRole(undefined), false);
});

test('administrators inherit manager capabilities', () => {
  assert.equal(isManagerRole('admin'), true);
  assert.equal(isManagerRole('manager'), true);
  assert.equal(isManagerRole('field_worker'), false);
});

test('administrator-only capabilities stay exclusive to administrators', () => {
  assert.equal(isAdminRole('admin'), true);
  assert.equal(isAdminRole('manager'), false);
});
