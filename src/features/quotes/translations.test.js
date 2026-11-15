import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { heQuotes, enQuotes, elQuotes } from './translations.js';
import { ptQuotes } from './pt.js';
import {
  heTranslations,
  enTranslations,
  elTranslations,
  ptTranslations,
} from '../language/resources.js';
import { RESPONSE_OPTIONS, OPEN_STATES } from './model.js';

const languages = {
  he: [heQuotes, heTranslations],
  en: [enQuotes, enTranslations],
  el: [elQuotes, elTranslations],
  pt: [ptQuotes, ptTranslations],
};
for (const [language, [dictionary, resources]] of Object.entries(languages)) {
  test(`complete ${language} translations are registered and interpolation matches`, () => {
    assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(heQuotes).sort());
    for (const [key, value] of Object.entries(dictionary)) {
      assert.equal(typeof value, 'string', key);
      assert.ok(value.trim(), key);
      assert.equal(resources[key], value, key);
      assert.deepEqual(
        [...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort(),
        [...heQuotes[key].matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort(),
        key,
      );
      if (language !== 'he') assert.doesNotMatch(value, /[\u0590-\u05ff]/, key);
    }
    for (const option of RESPONSE_OPTIONS) assert.ok(dictionary[`quotes.response.${option}`]);
    for (const tracking of OPEN_STATES) assert.ok(dictionary[`quotes.tracking.${tracking}`]);
  });
}
test('new user-facing strings use complete translation keys', () => {
  for (const file of readdirSync(new URL('.', import.meta.url)).filter((name) =>
    /\.jsx$/.test(name),
  )) {
    const code = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(
      code.replace(/t\((['"])[^'"]+\1\)/g, ''),
      /[\u0590-\u05ff]/,
      `${file} contains untranslated Hebrew`,
    );
    for (const match of code.matchAll(/['"](quotes\.[a-zA-Z][a-zA-Z.]+)['"]/g)) {
      for (const [dictionary] of Object.values(languages))
        assert.ok(dictionary[match[1]], `${file}: missing ${match[1]}`);
    }
  }
});
