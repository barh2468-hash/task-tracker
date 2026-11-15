import { dateValid, initialState, OPEN_STATES } from './model.js';

export function validLocalState(state) {
  if (
    state?.version !== 1 ||
    !['clients', 'quotes', 'messages', 'drafts'].every((key) => Array.isArray(state[key])) ||
    state.settings?.provider !== 'microsoft365'
  )
    return false;
  const clients = new Set(state.clients.map((c) => c?.id));
  const quotes = new Set(state.quotes.map((q) => q?.id));
  const ids = (rows) =>
    rows.every((row) => typeof row?.id === 'string' && row.id) &&
    new Set(rows.map((row) => row.id)).size === rows.length;
  return (
    ['clients', 'quotes', 'messages', 'drafts'].every((key) => ids(state[key])) &&
    state.clients.every((c) =>
      ['name', 'email', 'contact', 'phone', 'notes'].every((key) => typeof c[key] === 'string'),
    ) &&
    state.quotes.every(
      (q) =>
        clients.has(q.clientId) &&
        ['open', 'won', 'cancelled'].includes(q.status) &&
        OPEN_STATES.includes(q.tracking) &&
        dateValid(q.sentAt) &&
        typeof q.number === 'string' &&
        typeof q.title === 'string' &&
        Array.isArray(q.events) &&
        q.events.every(
          (e) => typeof e.type === 'string' && e.data && Number.isFinite(new Date(e.at).getTime()),
        ),
    ) &&
    state.messages.every(
      (m) =>
        ['sender', 'subject', 'body'].every((key) => typeof m[key] === 'string') &&
        ['pending', 'reviewed', 'ignored'].includes(m.status),
    ) &&
    state.drafts.every((d) => quotes.has(d.quoteId) && d.status === 'draft') &&
    typeof state.settings.mailbox === 'string' &&
    typeof state.settings.folder === 'string' &&
    Array.isArray(state.settings.allowedSenders) &&
    ['firstDelayDays', 'reminderDays', 'maxEmails'].every(
      (key) => Number.isInteger(state.settings[key]) && state.settings[key] > 0,
    )
  );
}

export const storageKey = (accountId) =>
  `maya:quotes:local:v1:${encodeURIComponent(accountId || 'preview')}`;
export function readLocalState(storage, accountId) {
  const raw = storage.getItem(storageKey(accountId));
  if (!raw) return initialState();
  const state = JSON.parse(raw);
  if (!validLocalState(state)) throw new Error('storage');
  return state;
}
export function writeLocalState(storage, accountId, state) {
  storage.setItem(storageKey(accountId), JSON.stringify(state));
  return state;
}
