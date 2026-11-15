// Local quote workflow. No command in this module sends mail or writes to Supabase.
export const RESPONSE_OPTIONS = [
  'interested',
  'signatures',
  'developer',
  'undecided',
  'approval',
  'date',
  'other',
  'cancelled',
  'other_vendor',
  'irrelevant',
];
export const OPEN_STATES = ['waiting', 'awaiting_reply', 'snoozed', 'needs_attention', 'paused'];
export const emailValid = (value) =>
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(value || '').trim());
export const normalize = (value) =>
  String(value || '')
    .trim()
    .normalize('NFKC')
    .toLocaleLowerCase('en-US');
export function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}
export function dateValid(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function today(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function addDays(value, days) {
  if (!dateValid(value)) fail('date');
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function initialState() {
  return {
    version: 1,
    clients: [],
    quotes: [],
    messages: [],
    drafts: [],
    settings: {
      provider: 'microsoft365',
      mailbox: '',
      folder: 'Inbox',
      allowedSenders: [],
      firstDelayDays: 14,
      reminderDays: 7,
      maxEmails: 3,
    },
  };
}
function stamp(now) {
  return new Date(now).toISOString();
}
function event(type, data = {}, now = new Date()) {
  return { id: crypto.randomUUID(), type, data, at: stamp(now), actor: 'manual' };
}
function replaceQuote(state, quote) {
  return { ...state, quotes: state.quotes.map((q) => (q.id === quote.id ? quote : q)) };
}
function getQuote(state, id) {
  const quote = state.quotes.find((q) => q.id === id);
  if (!quote) fail('notFound');
  return quote;
}
function getClient(state, id) {
  const client = state.clients.find((c) => c.id === id);
  if (!client) fail('client');
  return client;
}
export function saveClient(state, form, now = new Date()) {
  const name = String(form.name || '').trim();
  if (!name || name.length > 200) fail('client');
  const email = String(form.email || '')
    .trim()
    .toLowerCase();
  if (email && !emailValid(email)) fail('email');
  if (state.clients.some((c) => c.id !== form.id && normalize(c.name) === normalize(name)))
    fail('duplicateClient');
  if (form.id && !state.clients.some((c) => c.id === form.id)) fail('notFound');
  const old = state.clients.find((c) => c.id === form.id);
  if (old && form.updatedAt && form.updatedAt !== old.updatedAt) fail('conflict');
  const client = {
    id: form.id || crypto.randomUUID(),
    name,
    email,
    contact: String(form.contact || '')
      .trim()
      .slice(0, 200),
    phone: String(form.phone || '')
      .trim()
      .slice(0, 60),
    notes: String(form.notes || '')
      .trim()
      .slice(0, 4000),
    optOut: Boolean(form.optOut),
    createdAt: old?.createdAt || stamp(now),
    updatedAt: stamp(now),
  };
  let next = {
    ...state,
    clients: old
      ? state.clients.map((c) => (c.id === old.id ? client : c))
      : [...state.clients, client],
  };
  if (client.optOut && !old?.optOut) {
    next = {
      ...next,
      quotes: next.quotes.map((q) =>
        q.clientId === client.id && q.status === 'open'
          ? {
              ...q,
              tracking: 'paused',
              nextFollowup: '',
              updatedAt: stamp(now),
              events: [event('optOut', {}, now), ...q.events],
            }
          : q,
      ),
    };
  }
  return { state: next, client };
}
export function saveQuote(state, form, now = new Date()) {
  const number = String(form.number || '').trim();
  const title = String(form.title || '').trim();
  if (!number || number.length > 100 || !title || title.length > 500) fail('required');
  if (state.quotes.some((q) => q.id !== form.id && normalize(q.number) === normalize(number)))
    fail('duplicate');
  const client = getClient(state, form.clientId);
  if (!dateValid(form.sentAt)) fail('date');
  const amount = form.amount === '' || form.amount == null ? '' : Number(form.amount);
  if (amount !== '' && (!Number.isFinite(amount) || amount < 0)) fail('amount');
  const old = form.id ? getQuote(state, form.id) : null;
  if (old && form.updatedAt && form.updatedAt !== old.updatedAt) fail('conflict');
  const tracking = old?.tracking || (client.optOut || !client.email ? 'paused' : 'waiting');
  const quote = {
    ...old,
    id: old?.id || crypto.randomUUID(),
    number,
    title,
    clientId: client.id,
    amount,
    sentAt: form.sentAt,
    owner: String(form.owner || '')
      .trim()
      .slice(0, 120),
    notes: String(form.notes || '')
      .trim()
      .slice(0, 4000),
    source: old?.source || form.source || 'manual',
    status: old?.status || 'open',
    tracking,
    nextFollowup: old
      ? old.nextFollowup
      : tracking === 'waiting'
        ? addDays(form.sentAt, state.settings.firstDelayDays)
        : '',
    lastResponse: old?.lastResponse || '',
    reason: old?.reason || '',
    closedAt: old?.closedAt || null,
    projectId: old?.projectId || null,
    createdAt: old?.createdAt || stamp(now),
    updatedAt: stamp(now),
    events: [event(old ? 'edited' : 'created', {}, now), ...(old?.events || [])],
  };
  if (old?.status === 'open' && old.tracking === 'waiting' && old.sentAt !== quote.sentAt)
    quote.nextFollowup = addDays(quote.sentAt, state.settings.firstDelayDays);
  return {
    state: old ? replaceQuote(state, quote) : { ...state, quotes: [...state.quotes, quote] },
    quote,
  };
}
export function respond(
  state,
  id,
  { option, note = '', date = '', source = 'manual' },
  now = new Date(),
) {
  if (
    !RESPONSE_OPTIONS.includes(option) ||
    !['manual', 'mail_review', 'client_link'].includes(source)
  )
    fail('response');
  note = note.trim();
  if (note.length > 1000 || (option === 'other' && !note)) fail('note');
  if (option === 'date' && (!dateValid(date) || date <= today(now))) fail('futureDate');
  const quote = getQuote(state, id);
  const responseEvent = event('response', { option, note, date, source }, now);
  if (quote.status !== 'open')
    return replaceQuote(state, {
      ...quote,
      events: [event('lateResponse', {}, now), responseEvent, ...quote.events],
      updatedAt: stamp(now),
    });
  let patch;
  if (['cancelled', 'other_vendor', 'irrelevant'].includes(option))
    patch = {
      status: 'cancelled',
      tracking: 'paused',
      reason: option,
      closedAt: stamp(now),
      nextFollowup: '',
    };
  else if (['interested', 'other'].includes(option))
    patch = { tracking: 'needs_attention', nextFollowup: '' };
  else
    patch = {
      tracking: 'snoozed',
      nextFollowup:
        option === 'date' ? date : addDays(today(now), option === 'signatures' ? 21 : 14),
    };
  return replaceQuote(state, {
    ...quote,
    ...patch,
    lastResponse: option,
    updatedAt: stamp(now),
    events: [responseEvent, ...quote.events],
  });
}
export function changeTracking(state, id, action, date = '', now = new Date()) {
  const quote = getQuote(state, id);
  if (action === 'reopen') {
    if (quote.status === 'open') return state;
    const client = getClient(state, quote.clientId);
    return replaceQuote(state, {
      ...quote,
      status: 'open',
      tracking: client.optOut || !client.email ? 'paused' : 'waiting',
      closedAt: null,
      projectId: null,
      reason: '',
      nextFollowup:
        client.optOut || !client.email ? '' : addDays(today(now), state.settings.reminderDays),
      events: [event('reopened', {}, now), ...quote.events],
      updatedAt: stamp(now),
    });
  }
  if (quote.status !== 'open') fail('closed');
  let patch;
  if (action === 'won')
    patch = { status: 'won', tracking: 'paused', closedAt: stamp(now), nextFollowup: '' };
  else if (action === 'pause') patch = { tracking: 'paused', nextFollowup: '' };
  else if (action === 'resume' || action === 'snooze') {
    const client = getClient(state, quote.clientId);
    if (client.optOut) fail('optOut');
    if (!client.email) fail('missingEmail');
    if (action === 'snooze' && (!dateValid(date) || date <= today(now))) fail('futureDate');
    patch = {
      tracking: action === 'snooze' ? 'snoozed' : 'waiting',
      nextFollowup: action === 'snooze' ? date : addDays(today(now), state.settings.reminderDays),
    };
  } else fail('response');
  return replaceQuote(state, {
    ...quote,
    ...patch,
    updatedAt: stamp(now),
    events: [event(action, { date }, now), ...quote.events],
  });
}
export function prepareDraft(state, id, now = new Date()) {
  const quote = getQuote(state, id),
    client = getClient(state, quote.clientId);
  if (quote.status !== 'open') fail('closed');
  if (client.optOut) fail('optOut');
  if (!client.email) fail('missingEmail');
  if (state.drafts.some((d) => d.quoteId === id && d.status === 'draft')) fail('draftExists');
  const draft = {
    id: crypto.randomUUID(),
    quoteId: id,
    to: client.email,
    from: state.settings.mailbox,
    status: 'draft',
    createdAt: stamp(now),
  };
  const next = replaceQuote(state, {
    ...quote,
    updatedAt: stamp(now),
    events: [event('draft', {}, now), ...quote.events],
  });
  return { ...next, drafts: [draft, ...next.drafts] };
}
export function saveSettings(state, form) {
  const mailbox = String(form.mailbox || '')
    .trim()
    .toLowerCase();
  if (mailbox && !emailValid(mailbox)) fail('email');
  const allowedSenders = [
    ...new Set(
      String(form.allowedSenders || '')
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map((e) => e.toLowerCase()),
    ),
  ];
  if (allowedSenders.length > 100 || allowedSenders.some((e) => !emailValid(e))) fail('senders');
  const firstDelayDays = Number(form.firstDelayDays),
    reminderDays = Number(form.reminderDays),
    maxEmails = Number(form.maxEmails);
  if (
    ![firstDelayDays, reminderDays].every((n) => Number.isInteger(n) && n >= 1 && n <= 90) ||
    !Number.isInteger(maxEmails) ||
    maxEmails < 1 ||
    maxEmails > 10
  )
    fail('settings');
  const folder = String(form.folder || '').trim();
  if (!folder || folder.length > 200) fail('folder');
  // This is preparation only. Credentials and Graph authorization never belong in browser storage.
  return {
    ...state,
    settings: {
      provider: 'microsoft365',
      mailbox,
      folder,
      allowedSenders,
      firstDelayDays,
      reminderDays,
      maxEmails,
    },
  };
}
export function quotePriority(quote, state, now = new Date()) {
  if (quote.status !== 'open') return 9;
  if (quote.tracking === 'needs_attention') return 0;
  const client = state.clients.find((c) => c.id === quote.clientId);
  if (!client?.email && !client?.optOut) return 1;
  if (quote.nextFollowup && quote.nextFollowup <= today(now)) return 2;
  return 3;
}
export function demoState(now = new Date()) {
  let state = initialState();
  const customers = [
    ['Example Development', 'Alex', 'alex@example.com'],
    ['Example Engineering', 'Dana', 'dana@example.com'],
    ['Example Infrastructure', 'Sam', ''],
  ];
  for (const [name, contact, email] of customers)
    state = saveClient(state, { name, contact, email }, now).state;
  const examples = [
    ['DEMO-101', 24, 'needs_attention', 'interested'],
    ['DEMO-102', 40, 'needs_attention', ''],
    ['DEMO-103', 16, 'snoozed', 'signatures'],
    ['DEMO-104', 15, 'awaiting_reply', ''],
    ['DEMO-105', 5, 'paused', ''],
  ];
  examples.forEach(([number, days, tracking, lastResponse], index) => {
    const result = saveQuote(
      state,
      {
        number,
        title: `Demo Project ${index + 1}`,
        clientId: state.clients[index === 4 ? 2 : index % 2].id,
        sentAt: addDays(today(now), -days),
        amount: '',
        owner: 'Peleg',
      },
      now,
    );
    state = replaceQuote(result.state, {
      ...result.quote,
      tracking,
      lastResponse,
      nextFollowup:
        tracking === 'snoozed'
          ? addDays(today(now), 21)
          : tracking === 'awaiting_reply'
            ? addDays(today(now), 6)
            : '',
      events: [event('sample', {}, now), ...result.quote.events],
    });
  });
  return state;
}
