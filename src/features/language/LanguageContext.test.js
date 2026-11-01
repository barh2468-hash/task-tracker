import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';
import i18next from 'i18next';
import { heTranslations, enTranslations, elTranslations, ptTranslations } from './resources.js';
import { supportedLanguages } from './languages.js';

const require = createRequire(import.meta.url);
const source = transformSync(
  readFileSync(new URL('./LanguageContext.jsx', import.meta.url), 'utf8'),
  { loader: 'jsx', format: 'cjs', jsx: 'automatic' },
).code;
const dictionaries = { heTranslations, enTranslations, elTranslations, ptTranslations };

function loadContext(instance, resources = dictionaries) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'localStorage', source)(
    (name) => {
      if (name === 'i18next') return instance;
      if (name === './resources.js') return resources;
      if (name === './languages.js') return { supportedLanguages };
      return require(name);
    },
    module,
    module.exports,
    { getItem: () => instance.language || 'he' },
  );
  return module.exports;
}

for (const [language, dictionary] of Object.entries({
  he: heTranslations, en: enTranslations, el: elTranslations, pt: ptTranslations,
})) {
  test(`open ${language} sessions receive new and changed translations after a module update`, async () => {
    const instance = i18next.createInstance();
    await instance.init({
      lng: language, fallbackLng: 'he', keySeparator: false,
      resources: { [language]: { translation: { existing: 'preserved' } } },
    });
    assert.equal(instance.t('gpr.title'), 'gpr.title');
    const context = loadContext(instance);
    assert.equal(context.t('gpr.title'), dictionary['gpr.title']);
    assert.equal(context.t('כניסה:'), dictionary['כניסה:']);
    assert.equal(instance.language, language);
    assert.equal(context.t('existing'), 'preserved');

    // Updating a dictionary again must also overwrite an already loaded value.
    instance.addResourceBundle(language, 'translation', { 'gpr.title': 'stale title' }, true, true);
    const updatedContext = loadContext(instance);
    assert.equal(updatedContext.t('gpr.title'), dictionary['gpr.title']);
  });
}

test('a saved Portuguese preference initializes Portuguese and allows switching languages', async () => {
  const instance = i18next.createInstance();
  instance.language = 'pt';
  const context = loadContext(instance);
  assert.equal(instance.language, 'pt');
  assert.equal(context.t('פרויקטים'), 'Projetos');
  assert.equal(context.t('gpr.orderTitle', { number: '123' }), 'Ordem GPR 123');
  assert.equal(context.t('{{count}} פרויקטים', { count: 3 }), '3 projetos');
  assert.equal(context.t('כניסה:'), 'Entrada:');
  for (const [language, expected] of [['he', 'פרויקטים'], ['en', 'Projects'], ['el', 'Έργα'], ['pt', 'Projetos']]) {
    await instance.changeLanguage(language);
    assert.equal(context.t('פרויקטים'), expected);
  }
});
