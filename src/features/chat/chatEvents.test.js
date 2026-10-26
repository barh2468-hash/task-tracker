import test from 'node:test';
import assert from 'node:assert/strict';
import i18next from 'i18next';
import { heTranslations, enTranslations, elTranslations } from '../language/resources.js';
import { chatEventNote, chatEventText } from './chatEvents.js';

const events = [
  ['status_changed', { from: 'חדש', to: 'בעבודה בשטח' }],
  ['status_changed', { from: 'בעבודה בשטח', to: 'בעבודה בשטח', note: 'הגענו לאתר' }],
  ['photo_added', { count: 1 }],
  ['photo_added', { count: 4 }],
  ['document_added', { count: 1, file_name: 'plan.pdf' }],
  ['document_added', { count: 3, file_name: 'plan.pdf' }],
  ['task_added', { title: 'בדיקת שוחה' }],
  ['task_completed', { title: 'בדיקת שוחה' }],
];

for (const [language, resource] of Object.entries({
  he: heTranslations,
  en: enTranslations,
  el: elTranslations,
})) {
  test(`project chat events render complete ${language} text`, async () => {
    const i18n = i18next.createInstance();
    await i18n.init({
      lng: language,
      fallbackLng: false,
      keySeparator: false,
      nsSeparator: false,
      interpolation: { escapeValue: false },
      resources: { [language]: { translation: resource } },
    });
    const translate = (key, options) => i18n.t(key, { ...options, defaultValue: key });
    for (const [type, data] of events) {
      const text = chatEventText(type, data, translate);
      assert.ok(text.length > 0, `${type} renders`);
      assert.doesNotMatch(text, /\{\{/, `${type} interpolates every value`);
      if (language !== 'he')
        assert.doesNotMatch(
          text.replace(/plan\.pdf|בדיקת שוחה/g, ''),
          /[֐-׿]/,
          `${type} is translated`,
        );
    }
  });
}

test('counts and names reach the text', () => {
  const translate = (key, options) => key.replace('{{value0}}', options?.value0 ?? '');
  assert.equal(chatEventText('photo_added', { count: 4 }, translate), 'נוספו 4 תמונות');
  assert.equal(
    chatEventText('document_added', { file_name: 'plan.pdf' }, translate),
    'נוסף קובץ: plan.pdf',
  );
  assert.equal(chatEventText('unknown', {}, translate, 'fallback'), 'fallback');
});

test('only status updates carry a note', () => {
  assert.equal(chatEventNote('status_changed', { note: '  הגענו  ' }), 'הגענו');
  assert.equal(chatEventNote('photo_added', { note: 'x' }), '');
});
