import { t } from '../features/language/LanguageContext.jsx';

export function translateAuthError(message) {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return t('clientLogin.invalidCredentials');
  if (lower.includes('email not confirmed')) {
    return t('המייל עדיין לא מאושר. אשר את המשתמש ב-Supabase תחת Authentication > Users.');
  }
  return message;
}
