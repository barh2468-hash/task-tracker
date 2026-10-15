import test from 'node:test';
import assert from 'node:assert/strict';
import { filterVehicles, getVehiclePlateKey, parseVehicleMileage, parseVehicleRows, toVehiclePayload, VEHICLE_EXPORT_FIELDS, VEHICLE_FIELDS } from './vehicleRegister.js';

test('plate identity ignores separators and supplementary codes, and rejects invalid plates', () => {
  assert.equal(getVehiclePlateKey(' 621-31-603\r\n*2323 '), '62131603');
  assert.equal(getVehiclePlateKey('56-642-31'), '5664231');
  assert.equal(getVehiclePlateKey('62131603'), '62131603');
  assert.equal(getVehiclePlateKey('car62131603'), '');
  assert.equal(getVehiclePlateKey('621316'), '');
});

test('mixed source values are preserved and blank fields do not become zero', () => {
  const row = ['621-31-603\n*2323', 'רכב', 'גדולה -גבי', new Date('2024-09-09T00:00:00Z'), 'בביטול', 604785682, null, new Date('2024-09-09T00:00:00Z'), 'V', '09-11-202', 'מאיה', 'מקיף\nחובה', null, null, 'נהג'];
  const headers = VEHICLE_FIELDS.map(({ label }) => label);
  headers[7] = 'כיבש 6 -תאריך עדכון פסקל ';
  const [record] = parseVehicleRows([headers, row]);
  assert.equal(record.plate_number, '621-31-603\n*2323');
  assert.equal(record.manufacture_year, 'גדולה -גבי');
  assert.equal(record.entered_on, '2024-09-09');
  assert.equal(record.paskal, '604785682');
  assert.equal(record.paskal_number, '');
  assert.equal(record.cross_north, '09-11-202');
  assert.equal(record.insurance_agent, 'מקיף\nחובה');
  assert.equal(record.driver_age, '');
});

test('imports accept reordered columns, reject missing columns and duplicate plate identities', () => {
  const headers = VEHICLE_FIELDS.map(({ label }) => label);
  const row = VEHICLE_FIELDS.map(({ key }) => key === 'plate_number' ? '621-31-603' : key === 'driver_name' ? 'נהג' : '');
  assert.equal(parseVehicleRows([[...headers].reverse(), [...row].reverse()])[0].driver_name, 'נהג');
  assert.throws(() => parseVehicleRows([headers.slice(0, -1), row]), /חסרה עמודה/);
  const duplicate = [...row];
  duplicate[0] = '62131603\n*2323';
  assert.throws(() => parseVehicleRows([headers, row, duplicate]), /כפול/);
});

test('search and filters combine without treating cancellation or a blank as active fuel cards', () => {
  const records = [
    { plate_number: '621-31-603\n*2323', driver_name: 'עדן', ownership: 'מאיה', fuel_card: 'V' },
    { plate_number: '5664231', driver_name: 'גבי', ownership: 'מאיה', fuel_card: 'בביטול' },
    { plate_number: '87446603', driver_name: 'עדן', ownership: 'ליסינג', fuel_card: '' },
  ];
  assert.equal(filterVehicles(records, { search: '62131603' }).length, 1);
  assert.equal(filterVehicles(records, { search: 'עדן', ownership: 'מאיה', fuel: 'yes' }).length, 1);
  assert.equal(filterVehicles(records, { fuel: 'no' }).length, 2);
  assert.equal(filterVehicles(records, { search: '*2323' }).length, 1);
  assert.equal(toVehiclePayload({ plate_number: '5664231', id: 'server-id' }).id, undefined);
});

test('mileage preserves zero, allows clearing and rejects negative or fractional readings', () => {
  assert.equal(parseVehicleMileage(''), null);
  assert.equal(parseVehicleMileage(null), null);
  assert.equal(parseVehicleMileage('0'), 0);
  assert.equal(parseVehicleMileage('128450'), 128450);
  for (const value of ['-1', '12.5', 'NaN', '2147483648']) assert.throws(() => parseVehicleMileage(value));
  assert.equal(toVehiclePayload({ plate_number: '5664231', current_mileage: 0 }).current_mileage, 0);
});

test('original Excel imports omit mileage so they preserve saved readings; extended imports include it', () => {
  const row = VEHICLE_FIELDS.map(({ key }) => key === 'plate_number' ? '621-31-603' : '');
  const [original] = parseVehicleRows([VEHICLE_FIELDS.map(({ label }) => label), row]);
  assert.equal(Object.hasOwn(original, 'current_mileage'), false);
  assert.equal(Object.hasOwn(toVehiclePayload(original), 'current_mileage'), false);
  const extendedHeaders = VEHICLE_EXPORT_FIELDS.map(({ label }) => label);
  assert.equal(parseVehicleRows([extendedHeaders, [...row, 128450]])[0].current_mileage, 128450);
  assert.equal(parseVehicleRows([extendedHeaders, [...row, 0]])[0].current_mileage, 0);
  assert.equal(parseVehicleRows([extendedHeaders, [...row, '']])[0].current_mileage, null);
});
