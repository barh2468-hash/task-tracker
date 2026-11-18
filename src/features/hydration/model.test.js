import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowHydrationReminder } from './model.js';
import { heHydration, enHydration, elHydration, ptHydration } from './translations.js';
import { heTranslations, enTranslations, elTranslations, ptTranslations } from '../language/resources.js';

const email = 'eyal@maya-tm.com';
test('only the requested account sees the reminder, regardless of display name', () => {
  const wednesday = new Date('2026-11-18T10:00:00Z');
  assert.equal(shouldShowHydrationReminder(email, wednesday), true);
  assert.equal(shouldShowHydrationReminder(' EYAL@MAYA-TM.COM ', wednesday), true);
  for (const other of [null, undefined, '', 'other@maya-tm.com', 'eyal@other.com', 'eyal@maya-tm.com.invalid']) {
    assert.equal(shouldShowHydrationReminder(other, wednesday), false);
  }
});
test('Wednesday follows Israel midnight in winter and summer, independent of the device timezone', () => {
  for (const [date, expected] of [
    ['2026-11-17T21:59:59Z', false], ['2026-11-17T22:00:00Z', true],
    ['2026-11-18T21:59:59Z', true], ['2026-11-18T22:00:00Z', false],
    ['2026-07-07T20:59:59Z', false], ['2026-07-07T21:00:00Z', true],
    ['2026-07-08T20:59:59Z', true], ['2026-07-08T21:00:00Z', false],
  ]) assert.equal(shouldShowHydrationReminder(email, new Date(date)), expected, date);
});
test('recurs every Wednesday and stays off on the other six days', () => {
  for (let day = 0; day < 21; day++) {
    const date = new Date(Date.UTC(2026, 10, 16 + day, 10));
    assert.equal(shouldShowHydrationReminder(email, date), day % 7 === 2, date.toISOString());
  }
});
for (const [language, dictionary, resources] of [
  ['he', heHydration, heTranslations], ['en', enHydration, enTranslations],
  ['el', elHydration, elTranslations], ['pt', ptHydration, ptTranslations],
]) test('complete and connected hydration copy and accessible labels in ' + language, () => {
  assert.deepEqual(Object.keys(dictionary), Object.keys(heHydration));
  for (const [key, value] of Object.entries(dictionary)) {
    assert.ok(value.trim(), key);
    assert.equal(resources[key], value, key);
    if (language !== 'he') assert.doesNotMatch(value, /[\u0590-\u05ff]/);
    assert.deepEqual(value.match(/{{\w+}}/g), heHydration[key].match(/{{\w+}}/g));
  }
});
