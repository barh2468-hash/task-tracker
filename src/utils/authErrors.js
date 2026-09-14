import { t } from '../features/language/LanguageContext.jsx';

export function translateAuthError(message) {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return t('מייל או סיסמה לא נכונים.');
  if (lower.includes('email not confirmed')) {
    return t('המייל עדיין לא מאושר. אשר את המשתמש ב-Supabase תחת Authentication > Users.');
  }
  return message;
}
