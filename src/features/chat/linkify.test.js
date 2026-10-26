import test from 'node:test';
import assert from 'node:assert/strict';
import { linkifySegments } from './linkify.js';

const links = (text) => linkifySegments(text).filter((segment) => segment.type !== 'text');

test('plain text stays one segment', () => {
  assert.deepEqual(linkifySegments('הגענו לאתר'), [{ type: 'text', value: 'הגענו לאתר' }]);
  assert.deepEqual(linkifySegments(''), []);
});

test('web links open, with trailing punctuation left out', () => {
  assert.deepEqual(links('ראו https://maya-tm.com/plan.pdf.'), [
    { type: 'url', value: 'https://maya-tm.com/plan.pdf', href: 'https://maya-tm.com/plan.pdf' },
  ]);
  assert.deepEqual(links('(www.waze.com)'), [
    { type: 'url', value: 'www.waze.com', href: 'https://www.waze.com' },
  ]);
});

test('Israeli phone numbers dial', () => {
  assert.deepEqual(
    links('תתקשר ל-050-123-4567 או 03 1234567 או +972 54 765 4321').map((s) => s.href),
    ['tel:0501234567', 'tel:031234567', 'tel:+972547654321'],
  );
  assert.equal(links('072-2345678')[0].href, 'tel:0722345678');
});

test('project numbers and long digit runs are not phone numbers', () => {
  assert.deepEqual(links('פרויקט 2260414'), []);
  assert.deepEqual(links('0501234567890'), []);
  assert.deepEqual(links('WBO-253'), []);
});

test('text around links is kept in order', () => {
  assert.deepEqual(
    linkifySegments('א 0501234567 ב').map((s) => s.value),
    ['א ', '0501234567', ' ב'],
  );
});
