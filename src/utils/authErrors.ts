export function translateAuthError(message: string) {
  if (message.toLowerCase().includes("invalid login credentials"))
    return "מייל או סיסמה לא נכונים.";
  if (message.toLowerCase().includes("email not confirmed"))
    return "המייל עדיין לא מאושר. אשר את המשתמש ב-Supabase תחת Authentication > Users.";
  if (message.toLowerCase().includes("password")) return message;
  return message;
}
