import test from 'node:test';
import assert from 'node:assert/strict';
import { heRecovery, enRecovery, elRecovery, ptRecovery } from './recoveryTranslations.js';
import { heTranslations, enTranslations, elTranslations, ptTranslations } from '../language/resources.js';

for (const [language, dictionary, resources] of [
  ['he', heRecovery, heTranslations], ['en', enRecovery, enTranslations],
  ['el', elRecovery, elTranslations], ['pt', ptRecovery, ptTranslations],
]) {
  test(`recovery messages and accessible button names are complete and connected in ${language}`, () => {
    assert.deepEqual(Object.keys(dictionary), Object.keys(heRecovery));
    for (const [key, value] of Object.entries(dictionary)) {
      assert.ok(value.trim(), key);
      assert.equal(resources[key], value, key);
      if (language !== 'he') assert.doesNotMatch(value, /[\u0590-\u05ff]/);
    }
  });
}
