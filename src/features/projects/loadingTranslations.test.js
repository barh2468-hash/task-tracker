import test from 'node:test';
import assert from 'node:assert/strict';
import i18next from 'i18next';
import { heTranslations, enTranslations, elTranslations } from '../language/resources.js';

const keys = ['טעינת הפרויקטים נכשלה', 'לא ניתן לעדכן את רשימת הפרויקטים כרגע.',
  'מוצגים הנתונים האחרונים שנטענו. בדוק את החיבור ונסה שוב.',
  'בדוק את החיבור ונסה שוב. הקישור לפרויקט נשמר.', 'הפרויקט אינו זמין לצפייה',
  'ייתכן שהפרויקט הוסר או שאין לך הרשאה לצפות בו.', 'טוען פרויקטים...', 'טוען...', 'נסה שוב', 'סגירה'];
for (const [language, dictionary] of [['he', heTranslations], ['en', enTranslations], ['el', elTranslations]]) {
  test(`project loading, retry and access messages are complete in ${language}`, async () => {
    const instance = i18next.createInstance();
    await instance.init({ lng: language, keySeparator: false, nsSeparator: false,
      resources: { [language]: { translation: dictionary } } });
    for (const key of keys) {
      const value = instance.t(key, { defaultValue: language === 'he' ? key : '' });
      assert.ok(value, key);
      if (language !== 'he') assert.doesNotMatch(value, /[\u0590-\u05ff]/, key);
    }
  });
}
