export function translateAuthError(message) {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'מייל או סיסמה לא נכונים.';
  if (lower.includes('email not confirmed')) {
    return 'המייל עדיין לא מאושר. אשר את המשתמש ב-Supabase תחת Authentication > Users.';
  }
  return message;
}
