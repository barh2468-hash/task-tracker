import test from 'node:test';
import assert from 'node:assert/strict';
import { dalkanRequired, declarationErrorMessage, takesVehicle, validateDeclaration } from './declarationRules.js';

const base = {
  action: 'received', vehicleId: 'v1', returnedVehicleId: '', use: 'permanent',
  odometer: '1000', returnedOdometer: '', checklist: {}, liabilityAck: true, signature: 'data:image/png;base64,AAA',
};

test('taking a permanent vehicle needs the liability acknowledgement and a signature', () => {
  assert.deepEqual(validateDeclaration(base), []);
  assert.match(validateDeclaration({ ...base, liabilityAck: false }).join(), /הצהרת האחריות/);
  assert.match(validateDeclaration({ ...base, signature: '' }).join(), /לחתום/);
});

test('the Dalkan card must be removed or blocked only when a temporary vehicle is taken', () => {
  assert.equal(dalkanRequired('received', 'temporary'), true);
  assert.equal(dalkanRequired('swapped', 'temporary'), true);
  assert.equal(dalkanRequired('received', 'permanent'), false);
  assert.equal(dalkanRequired('returned', 'temporary'), false);
  assert.match(validateDeclaration({ ...base, use: 'temporary' }).join(), /הדלקן/);
  assert.deepEqual(validateDeclaration({ ...base, use: 'temporary', checklist: { dalkan_blocked: true } }), []);
});

test('a swap needs a different vehicle to give back', () => {
  const swap = { ...base, action: 'swapped', returnedVehicleId: 'v2' };
  assert.deepEqual(validateDeclaration(swap), []);
  assert.match(validateDeclaration({ ...swap, returnedVehicleId: '' }).join(), /שמחזירים/);
  assert.match(validateDeclaration({ ...swap, returnedVehicleId: 'v1' }).join(), /זהים/);
});

test('returning needs the return odometer and no signature or liability', () => {
  const back = { ...base, action: 'returned', liabilityAck: false, signature: '' };
  assert.deepEqual(validateDeclaration(back), []);
  assert.match(validateDeclaration({ ...back, odometer: '' }).join(), /ק"מ החזרה/);
  assert.equal(takesVehicle('returned'), false);
});

test('odometer must be a whole non-negative number and the time cannot be in the future', () => {
  assert.match(validateDeclaration({ ...base, odometer: '12.5' }).join(), /מספר שלם/);
  assert.match(validateDeclaration({ ...base, odometer: '-1' }).join(), /מספר שלם/);
  const now = new Date('2026-10-26T10:00:00Z');
  assert.match(validateDeclaration({ ...base, happenedAt: '2026-10-26T11:00:00Z' }, now).join(), /עתידי/);
  assert.deepEqual(validateDeclaration({ ...base, happenedAt: '2026-10-26T09:00:00Z' }, now), []);
});

test('server error codes become messages for the worker', () => {
  assert.match(declarationErrorMessage({ message: 'odometer_lower' }), /נמוך/);
  assert.match(declarationErrorMessage({ message: 'dalkan_required' }), /דלקן/);
  assert.equal(declarationErrorMessage({ message: 'something else' }), '');
});
