// Classifies toast messages coming back from the API layer as success, info or
// error, so failures are shown in red and don't auto-dismiss (see MessageContext).

// Wording the API layer uses for failures and validation problems. Most API
// results don't carry an explicit flag, so this is the fallback classifier.
const FAILURE_PATTERN =
  /נכשל|שגיאה|אין (לך )?הרשאה|לא ניתן|לא נמצא|יש (לבחור|למלא|לתאר|לצרף|להזין|להשלים|לסיים|להתחבר|להפעיל)|נדרש|חובה|אינו|אינה|אינם|גדול מדי|ריק ולא|כבר קיימ|בוטל/;
const HEBREW_LETTER = /[\u0590-\u05FF]/;
const LATIN_LETTER = /[A-Za-z]/;

// Only meaningful for API-layer messages, which are always untranslated Hebrew.
// Components pass an explicit tone because their text may already be translated.
function inferApiMessageTone(text) {
  if (!text) return 'info';
  // Raw technical errors (Supabase, network) come through in English.
  if (!HEBREW_LETTER.test(text) && LATIN_LETTER.test(text)) return 'error';
  if (FAILURE_PATTERN.test(text)) return 'error';
  // "No connection, saved for sync" notices are neither a failure nor a full success.
  return /אין חיבור/.test(text) ? 'info' : 'success';
}

// Tone for an API result object: explicit flags win, then offline queuing.
export function resultTone(result) {
  if (result?.ok === false || result?.success === false) return 'error';
  if (result?.offline) return 'info';
  if (result?.ok === true || result?.success === true) return 'success';
  return inferApiMessageTone(result?.message);
}

// True when an API result didn't fail, so a form can safely close or reset.
export function isResultOk(result) {
  return Boolean(result) && resultTone(result) !== 'error';
}
