import { emailValid, fail } from './model.js';

export function validateMessage(form) {
  const sender = String(form.sender || '')
    .trim()
    .toLowerCase();
  const subject = String(form.subject || '').trim();
  const body = String(form.body || '').trim();
  if (!emailValid(sender)) fail('email');
  if (!subject || subject.length > 500 || !body || body.length > 100000) fail('message');
  return { sender, subject, body };
}
export async function intakeMessage(state, form, now = new Date()) {
  const value = validateMessage(form);
  const canonical = [value.sender, value.subject, value.body].join('\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const fingerprint = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (state.messages.some((m) => m.fingerprint === fingerprint)) fail('duplicateMessage');
  // Pasted headers and content are unverified data, even when the address is allowlisted.
  const candidates = state.quotes.filter((q) => {
    const escaped = q.number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(
      `${value.subject}\n${value.body}`,
    );
  });
  const message = {
    ...value,
    id: crypto.randomUUID(),
    fingerprint,
    receivedAt: now.toISOString(),
    status: 'pending',
    suggestedQuoteId: candidates.length === 1 ? candidates[0].id : '',
    quoteId: '',
    verification: 'manual_paste',
  };
  return { ...state, messages: [message, ...state.messages] };
}
export function markMessage(state, id, status, quoteId = '') {
  if (!['reviewed', 'ignored'].includes(status)) fail('response');
  const message = state.messages.find((m) => m.id === id);
  if (!message || message.status !== 'pending') fail('notFound');
  if (status === 'reviewed' && !state.quotes.some((q) => q.id === quoteId)) fail('notFound');
  return {
    ...state,
    messages: state.messages.map((m) => (m.id === id ? { ...m, status, quoteId } : m)),
  };
}
