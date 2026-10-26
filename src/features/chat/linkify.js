// Splits message text into plain text, web links and phone numbers so the
// bubble can make links open and numbers dial with one tap.
const URL_SOURCE = String.raw`(?:https?:\/\/|www\.)[^\s<>"']+`;
// Israeli mobile (05x), landline (02-09), VoIP (07x) and +972 forms, with
// optional dashes or spaces; never part of a longer run of digits.
const PHONE_SOURCE = String.raw`(?<![\d+])(?:\+972[-\s]?0?|0)(?:5\d|7\d|[2-489])(?:[-\s]?\d){7}(?!\d)`;
const TOKEN_PATTERN = new RegExp(`(${URL_SOURCE})|(${PHONE_SOURCE})`, 'gi');
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"״׳]+$/;

export function linkifySegments(text) {
  const value = String(text ?? '');
  const segments = [];
  let cursor = 0;
  for (const match of value.matchAll(TOKEN_PATTERN)) {
    let token = match[0];
    let type = match[1] ? 'url' : 'phone';
    if (type === 'url') token = token.replace(TRAILING_PUNCTUATION, '');
    if (!token) continue;
    if (match.index > cursor)
      segments.push({ type: 'text', value: value.slice(cursor, match.index) });
    const href =
      type === 'url'
        ? /^https?:\/\//i.test(token)
          ? token
          : `https://${token}`
        : `tel:${token.replace(/[^\d+]/g, '')}`;
    segments.push({ type, value: token, href });
    cursor = match.index + token.length;
  }
  if (cursor < value.length) segments.push({ type: 'text', value: value.slice(cursor) });
  return segments;
}
