import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import i18next from 'i18next';
import { heTranslations, enTranslations, elTranslations } from '../language/resources.js';

// Check the actual dialog keys, including alerts, placeholders and accessibility labels.
const source = readFileSync(
  new URL('./components/ContinuationReportDialog.jsx', import.meta.url),
  'utf8',
);
const keys = [...source.matchAll(/t\('([^']+)'/g)].map((match) => match[1]);
keys.push(
  'שליחת הדיווח נכשלה. הפרטים והקבצים נשארו בחלון.',
  'הקבצים שנותרו ברשימה לא הועלו. בדוק את החיבור ואת הקבצים ונסה שוב. ניתן להעלות PDF או תמונה עד 20MB.',
  'מנה {{number}} נשמרה, אך {{count}} קבצים לא הועלו. נסה שוב באותה מנה.',
  'מנה {{number}} נשמרה והקבצים שנבחרו הועלו בהצלחה.',
  'הקובץ {{name}} אינו תקין.',
  'שמירת מנת השרטוט נכשלה: {{message}}',
  'קבצים למנת השרטוט',
  'אין עדיין קבצים במנה',
  'צפייה',
  'הורדה',
  'העלאת קובץ',
  'טוען את הקובץ...',
  'אין לך הרשאה לדווח המשך עבודה בפרויקט הזה.',
  'נדרש חיבור לאינטרנט כדי לשלוח דיווח המשך עבודה לשרטוט.',
  'יש לתאר בקצרה מה בוצע ומה צריך להעביר לשרטוט.',
  'חלק מפרטי הדיווח אינם תקינים. יש לבדוק את השדות ולנסות שוב.',
);

for (const [language, dictionary] of [
  ['he', heTranslations],
  ['en', enTranslations],
  ['el', elTranslations],
]) {
  test(`drawing upload, retry and file actions have complete ${language} translations`, async () => {
    const instance = i18next.createInstance();
    await instance.init({
      lng: language,
      keySeparator: false,
      nsSeparator: false,
      resources: { [language]: { translation: dictionary } },
    });
    for (const key of keys) {
      if (language !== 'he') assert.ok(Object.hasOwn(dictionary, key), key);
      const text = instance.t(key, {
        defaultValue: language === 'he' ? key : '',
        name: 'User file.pdf',
        number: '1',
        count: '2',
        status: 'Status',
        message: 'Network failed',
      });
      assert.ok(text, key);
      assert.doesNotMatch(text, /{{/, key);
      if (language !== 'he') assert.doesNotMatch(text, /[\u0590-\u05ff]/, key);
    }
  });
}
