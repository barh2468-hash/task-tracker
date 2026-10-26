import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationLink, phoneLink } from './format.js';

test('navigation opens Waze on the project address', () => {
  assert.equal(
    navigationLink(' הרצל 12, חיפה '),
    `https://waze.com/ul?q=${encodeURIComponent('הרצל 12, חיפה')}&navigate=yes`,
  );
  assert.equal(navigationLink(''), '');
  assert.equal(navigationLink(null), '');
});

test('phone links keep only dialable characters', () => {
  assert.equal(phoneLink('050-123 4567'), 'tel:0501234567');
  assert.equal(phoneLink('+972 (50) 123-4567'), 'tel:+972501234567');
  assert.equal(phoneLink('אין'), '');
  assert.equal(phoneLink(undefined), '');
});
