import test from 'node:test';
import assert from 'node:assert/strict';
import { viewerPathBlocked } from './viewerRoutes.js';

test('viewer fleet, GPR, planning and related vehicle reports cannot open via direct links', () => {
  for (const path of ['/app/vehicles', '/app/vehicles/archive', '/app/vehicles/fines',
    '/app/vehicles/example-id', '/app/vehicle-register', '/app/gpr', '/app/work-plan',
    '/app/accounting/year-end', '/app/accounting/fuel', '/app/accounting/cross-north',
    '/APP/VEHICLES/', '/app/%67pr', '/app//work-plan'])
    assert.equal(viewerPathBlocked(path), true, path);
});

test('viewer project, archive, history and other permitted pages remain available', () => {
  for (const path of ['/app/projects', '/app/history', '/app/overview', '/app/report',
    '/app/equipment', '/app/viewer-information', '/app/notifications'])
    assert.equal(viewerPathBlocked(path), false, path);
});
