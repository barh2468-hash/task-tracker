import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPersonalAttendancePage } from './loadPersonalAttendancePage.js';
import { heTranslations, enTranslations, elTranslations, ptTranslations } from '../language/resources.js';
import { heAttendanceRecovery, enAttendanceRecovery, elAttendanceRecovery, ptAttendanceRecovery } from './reportRecoveryTranslations.js';

function browser({ online = true, storageUnavailable = false } = {}) {
  const stored = new Map();
  const state = { reloads: 0 };
  return {
    state, stored,
    navigator: { onLine: online },
    window: {
      location: { href: 'https://maya.example/app/my-attendance?from=2026-11-01', reload: () => { state.reloads++; } },
      sessionStorage: {
        getItem: (key) => stored.get(key) || null,
        setItem: (key, value) => { if (storageUnavailable) throw new Error('Blocked storage'); stored.set(key, value); },
        removeItem: (key) => stored.delete(key),
      },
    },
  };
}

test('a stale desktop report chunk refreshes once across repeated import attempts', async () => {
  const runtime = browser();
  const error = new TypeError('Failed to fetch dynamically imported module: https://maya.example/assets/PersonalAttendancePage-old.js');
  const importPage = async () => { throw error; };
  await assert.rejects(loadPersonalAttendancePage(importPage, runtime), error);
  assert.equal(runtime.state.reloads, 1);
  await assert.rejects(loadPersonalAttendancePage(importPage, runtime), error);
  assert.equal(runtime.state.reloads, 1);
  const module = { default() {} };
  assert.equal(await loadPersonalAttendancePage(async () => module, runtime), module);
  assert.equal(runtime.stored.size, 0);
});

test('offline, ordinary rendering errors and blocked storage never cause automatic refresh loops', async () => {
  for (const [options, message] of [
    [{ online: false }, 'Failed to fetch dynamically imported module: report.js'],
    [{}, 'Invalid time value'],
    [{ storageUnavailable: true }, 'Failed to fetch dynamically imported module: report.js'],
  ]) {
    const runtime = browser(options);
    const error = new Error(message);
    await assert.rejects(loadPersonalAttendancePage(async () => { throw error; }, runtime), error);
    assert.equal(runtime.state.reloads, 0);
  }
});

test('Chrome, Safari, Firefox and missing stylesheet load failures can recover', async () => {
  for (const message of ['Failed to fetch dynamically imported module: report.js', 'Importing a module script failed.',
    'error loading dynamically imported module: report.js', 'Loading chunk 42 failed.', 'Unable to preload CSS for /assets/report.css']) {
    const runtime = browser();
    await assert.rejects(loadPersonalAttendancePage(async () => { throw new Error(message); }, runtime));
    assert.equal(runtime.state.reloads, 1, message);
  }
});

test('report recovery controls have complete translations in every supported language', () => {
  for (const [language, dictionary, recovery] of [
    ['he', heTranslations, heAttendanceRecovery], ['en', enTranslations, enAttendanceRecovery],
    ['el', elTranslations, elAttendanceRecovery], ['pt', ptTranslations, ptAttendanceRecovery],
  ]) {
    for (const [key, value] of Object.entries(recovery)) {
      assert.equal(dictionary[key], value, `${language}: ${key}`);
      if (language !== 'he') assert.doesNotMatch(value, /[\u0590-\u05ff]/);
    }
  }
});
