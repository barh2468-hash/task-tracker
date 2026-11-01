import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import i18next from 'i18next';
import { heDemo, enDemo, elDemo, ptDemo } from './translations.js';
import {
  heTranslations,
  enTranslations,
  elTranslations,
  ptTranslations,
} from '../language/resources.js';

for (const [language, dictionary, resources] of [
  ['he', heDemo, heTranslations],
  ['en', enDemo, enTranslations],
  ['el', elDemo, elTranslations],
  ['pt', ptDemo, ptTranslations],
]) {
  test(`demo screens, messages and accessibility text have complete ${language} translations`, async () => {
    assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(heDemo).sort());
    for (const [key, text] of Object.entries(dictionary)) {
      assert.ok(text, key);
      assert.equal(resources[key], text);
      if (language !== 'he') assert.doesNotMatch(text, /[\u0590-\u05ff]/);
      assert.deepEqual(text.match(/\{\{[^}]+\}\}/g), heDemo[key].match(/\{\{[^}]+\}\}/g), key);
    }
    const instance = i18next.createInstance();
    await instance.init({
      lng: language,
      keySeparator: false,
      resources: { [language]: { translation: resources } },
    });
    for (const key of ['demo.viewStudy', 'demo.deleteStudy', 'demo.confirmDelete']) {
      assert.ok(instance.t(key, { title: 'פרויקט לקוח Ω' }).includes('פרויקט לקוח Ω'));
    }
    // Catch untranslated additions in every demo component, including error states.
    for (const name of ['DemoPortal.jsx', 'DemoProjectWorkspace.jsx', 'DemoManagement.jsx', 'CaseStudies.jsx', 'api.js']) {
      const source = readFileSync(new URL(name, import.meta.url), 'utf8');
      for (const [, key] of source.matchAll(/['"](demo\.[A-Za-z]+)['"]/g))
        assert.ok(dictionary[key], key);
    }
  });
}
