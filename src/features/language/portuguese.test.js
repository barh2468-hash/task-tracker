import test from 'node:test';
import assert from 'node:assert/strict';
import i18next from 'i18next';
import { heTranslations, enTranslations, elTranslations, ptTranslations } from './resources.js';
import { languageOptions, supportedLanguages } from './languages.js';
import { localeForLanguage } from './locale.js';

const tokens = (value) => (value.match(/\{\{.*?\}\}/g) || []).sort();

test('Portuguese covers every existing translation with the same interpolation tokens', () => {
  const keys = new Set([...Object.keys(heTranslations), ...Object.keys(enTranslations), ...Object.keys(elTranslations)]);
  for (const key of keys) {
    assert.equal(typeof ptTranslations[key], 'string', `Missing Portuguese key: ${key}`);
    assert.ok(ptTranslations[key].trim(), `Empty Portuguese translation: ${key}`);
    assert.deepEqual(tokens(ptTranslations[key]), tokens(enTranslations[key] || key), key);
    if (key !== 'languageName.he') assert.doesNotMatch(ptTranslations[key], /[\u0590-\u05ff]/, key);
  }
});

test('Portuguese labels, accessibility text, messages and exports resolve without fallback', async () => {
  const instance = i18next.createInstance();
  await instance.init({
    lng: 'pt', fallbackLng: false, keySeparator: false, nsSeparator: false,
    resources: { pt: { translation: ptTranslations } },
    interpolation: { escapeValue: false },
  });
  for (const key of Object.keys(enTranslations)) assert.ok(instance.exists(key), key);
  assert.equal(instance.t('שפה'), 'Idioma');
  assert.equal(instance.t('הסרת איש קשר {{number}}', { number: 2 }), 'Remover contacto 2');
  assert.equal(instance.t('users.deleteSuccess', { name: 'שם מקורי' }), 'O funcionário שם מקורי foi eliminado do sistema.');
  assert.equal(instance.t('דוח-נוכחות-{{worker}}-{{from}}-עד-{{to}}', { worker: 'Maria', from: '01', to: '31' }), 'relatorio-presenca-Maria-01-a-31');
});

test('all language menus offer Portuguese and preserve native language names', () => {
  assert.deepEqual(supportedLanguages, ['he', 'en', 'el', 'pt']);
  for (const resource of [heTranslations, enTranslations, elTranslations, ptTranslations]) {
    assert.deepEqual(languageOptions.map(({ labelKey }) => resource[labelKey]), ['עברית', 'English', 'Ελληνικά', 'Português']);
  }
});

test('Portuguese formatting uses Portugal locale and preserves the workflow time zone', () => {
  assert.equal(localeForLanguage('pt'), 'pt-PT');
  assert.equal(localeForLanguage('he'), 'he-IL');
  assert.equal(localeForLanguage('en'), 'en-GB');
  assert.equal(localeForLanguage('el'), 'el-GR');
  const locale = localeForLanguage('pt');
  assert.equal(new Intl.NumberFormat(locale).format(1234.5), '1234,5');
  assert.equal(new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'Asia/Hebron' }).format(new Date('2026-10-29T10:00:00Z')), 'outubro');
  assert.equal(new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Hebron' }).format(new Date('2026-10-29T10:00:00Z')), '12:00');
});
