import assert from 'node:assert/strict';
import test from 'node:test';
import { isResultOk, resultTone } from './messageTone.js';

test('explicit flags decide the tone', () => {
  assert.equal(resultTone({ message: 'הקובץ הועלה ונשמר בפרויקט.', ok: true }), 'success');
  assert.equal(resultTone({ message: 'הכול טוב', ok: false }), 'error');
  assert.equal(resultTone({ message: 'נשמר', success: false }), 'error');
});

test('offline results are informational', () => {
  assert.equal(resultTone({ message: 'אין חיבור. המשימה נשמרה ותסונכרן אוטומטית.', offline: true }), 'info');
  assert.equal(resultTone({ message: 'אין חיבור. הכניסה נשמרה במכשיר ותסונכרן אוטומטית.' }), 'info');
});

test('unflagged Hebrew failures and raw technical errors are errors', () => {
  assert.equal(resultTone({ message: 'מחיקת התמונה מהאחסון נכשלה: timeout' }), 'error');
  assert.equal(resultTone({ message: 'אין הרשאה למחוק תמונות מהפרויקט הזה.' }), 'error');
  assert.equal(resultTone({ message: 'יש למלא כותרת למשימה.' }), 'error');
  assert.equal(resultTone({ message: 'new row violates row-level security policy' }), 'error');
  assert.equal(resultTone({ message: 'Failed to fetch' }), 'error');
});

test('unflagged Hebrew confirmations are successes', () => {
  assert.equal(resultTone({ message: 'התמונה הועלתה ונשמרה בפרויקט' }), 'success');
  assert.equal(resultTone({ message: 'המשימה עודכנה בהצלחה' }), 'success');
});

test('isResultOk only fails on errors or missing results', () => {
  assert.equal(isResultOk({ message: 'המשימה עודכנה בהצלחה' }), true);
  assert.equal(isResultOk({ message: 'אין חיבור. המשימה נשמרה ותסונכרן אוטומטית.', offline: true }), true);
  assert.equal(isResultOk({ message: 'יש למלא כותרת למשימה.' }), false);
  assert.equal(isResultOk(null), false);
});
