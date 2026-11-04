import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { heTranslations, enTranslations, elTranslations } from '../language/resources.js';
import { heHelpers } from './translations.js';

const require = createRequire(import.meta.url);
const source = transformSync(readFileSync(new URL('./HelperDirectoryStatus.jsx', import.meta.url), 'utf8'), { loader: 'jsx', jsx: 'automatic', format: 'cjs' }).code;
for (const [language, dictionary] of Object.entries({ he: heTranslations, en: enTranslations, el: elTranslations })) {
  test(`helper management labels, confirmations, results and directory states are complete in ${language}`, async () => {
    const instance = i18next.createInstance();
    await instance.init({ lng: language, fallbackLng: false, keySeparator: false, nsSeparator: false, interpolation: { escapeValue: false }, resources: { [language]: { translation: dictionary } } });
    const translate = (key, values) => instance.t(key, values);
    for (const key of Object.keys(heHelpers)) {
      assert.ok(dictionary[key], key);
      const value = translate(key, { name: 'Original Ω', count: '11' });
      assert.doesNotMatch(value, /\{\{/);
      if (language !== 'he') assert.doesNotMatch(value, /[\u0590-\u05ff]/, key);
      if (heHelpers[key].includes('{{name}}')) assert.ok(value.includes('Original Ω'), key);
    }
    const module = { exports: {} };
    new Function('require', 'module', 'exports', source)((name) => {
      if (name === 'react-i18next') return { useTranslation() {} };
      if (name === '../language/LanguageContext.jsx') return { t: translate };
      return require(name);
    }, module, module.exports);
    for (const state of [{ loading: true }, { error: true }, { cached: true }, { helpers: [] }]) {
      const html = renderToStaticMarkup(createElement(module.exports.default, { directory: state }));
      assert.ok(html);
      assert.doesNotMatch(html, /helpers\.[a-zA-Z]/);
      if (state.error) assert.match(html, /role="alert"/);
      if (state.loading) assert.match(html, /role="status"/);
      if (language !== 'he') assert.doesNotMatch(html, /[\u0590-\u05ff]/);
    }
  });
}
