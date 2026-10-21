import test from 'node:test';
import assert from 'node:assert/strict';
import i18next from 'i18next';
import { heTranslations, enTranslations, elTranslations } from '../language/resources.js';
import { notificationText } from './notificationText.js';

const name = '2260519 דרך היער';
const actor = "רוג'אן";
const notification = { type: 'project_review_approved', projects: { name }, profiles: { full_name: actor } };

for (const [language, resource] of Object.entries({ he: heTranslations, en: enTranslations, el: elTranslations })) {
  test(`review approval notification renders complete ${language} messages and preserves names`, async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: language, fallbackLng: false, keySeparator: false, interpolation: { escapeValue: false },
      resources: { [language]: { translation: resource } } });
    const t = (key, values) => i18n.t(key, { defaultValue: key, ...values });
    const result = notificationText(notification, t);
    assert.ok(result.title.includes(name));
    assert.ok(result.body.includes(actor));
    assert.doesNotMatch(result.title + result.body, /\{\{/);
    const fallback = notificationText({ type: notification.type }, t);
    if (language !== 'he') {
      for (const value of [result.title.replace(name, ''), result.body.replace(actor, ''), fallback.title, fallback.body]) {
        assert.doesNotMatch(value, /[\u0590-\u05ff]/);
      }
    }
    assert.notEqual(fallback.title, undefined);
    assert.notEqual(fallback.body, undefined);
  });
}

test('existing and user-entered notification content is preserved', () => {
  const original = { type: 'other', title: 'Custom title', body: 'Custom notes' };
  assert.deepEqual(notificationText(original, () => { throw new Error('Unexpected translation'); }),
    { title: original.title, body: original.body });
});
