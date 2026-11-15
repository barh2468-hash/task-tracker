import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  changeTracking,
  initialState,
  prepareDraft,
  respond,
  saveClient,
  saveQuote,
  saveSettings,
  today,
} from './model.js';
import { applyImport, parseImportRows, readImportFile } from './import.js';
import { intakeMessage, markMessage } from './mailbox.js';
import { readLocalState, storageKey, validLocalState, writeLocalState } from './localStore.js';
import { csvText } from './export.js';

const now = new Date('2026-11-15T10:00:00Z');
function fixture(number = 'SAP-101') {
  const clientResult = saveClient(
    initialState(),
    { name: 'שם לקוח', email: 'contact@example.com' },
    now,
  );
  return saveQuote(
    clientResult.state,
    {
      number,
      clientId: clientResult.client.id,
      title: 'Project',
      sentAt: '2026-11-01',
      amount: 1200,
    },
    now,
  );
}
test('interested customer requires human attention and never marks work as won', () => {
  const { state, quote } = fixture();
  const next = respond(state, quote.id, { option: 'interested' }, now);
  assert.equal(next.quotes[0].status, 'open');
  assert.equal(next.quotes[0].tracking, 'needs_attention');
  assert.equal(next.quotes[0].nextFollowup, '');
  assert.equal(next.quotes[0].events[0].data.option, 'interested');
  assert.equal(state.quotes[0].tracking, 'waiting');
});
test('deferred and manual date responses use calendar dates in Israel', () => {
  const { state, quote } = fixture();
  assert.equal(
    respond(state, quote.id, { option: 'signatures' }, now).quotes[0].nextFollowup,
    '2026-12-06',
  );
  assert.equal(
    respond(state, quote.id, { option: 'developer' }, now).quotes[0].nextFollowup,
    '2026-11-29',
  );
  assert.throws(() => respond(state, quote.id, { option: 'date', date: '2026-11-15' }, now), {
    code: 'futureDate',
  });
  assert.equal(
    respond(state, quote.id, { option: 'date', date: '2026-12-01' }, now).quotes[0].nextFollowup,
    '2026-12-01',
  );
  assert.equal(today(new Date('2026-11-15T23:30:00Z')), '2026-11-16');
  assert.equal(addDays('2026-03-26', 2), '2026-03-28');
});
test('closed quotations record late responses without reopening or changing the closing reason', () => {
  const { state, quote } = fixture();
  const closed = respond(state, quote.id, { option: 'other_vendor' }, now);
  const late = respond(closed, quote.id, { option: 'interested' }, now);
  assert.equal(late.quotes[0].status, 'cancelled');
  assert.equal(late.quotes[0].reason, 'other_vendor');
  assert.equal(late.quotes[0].events[0].type, 'lateResponse');
  const reopened = changeTracking(late, quote.id, 'reopen', '', now);
  assert.equal(reopened.quotes[0].status, 'open');
  assert.equal(reopened.quotes[0].closedAt, null);
});
test('customer opt-out pauses all open quotations and prevents drafts and resuming', () => {
  const { state, quote } = fixture();
  const opted = saveClient(state, { ...state.clients[0], optOut: true }, now).state;
  assert.equal(opted.quotes[0].tracking, 'paused');
  assert.equal(opted.quotes[0].nextFollowup, '');
  assert.throws(() => prepareDraft(opted, quote.id, now), { code: 'optOut' });
  assert.throws(() => changeTracking(opted, quote.id, 'resume', '', now), { code: 'optOut' });
  const removed = saveClient(opted, { ...opted.clients[0], optOut: false }, now).state;
  assert.equal(removed.quotes[0].tracking, 'paused');
});
test('missing addresses cannot schedule follow-up or produce a sendable draft', () => {
  const result = saveClient(initialState(), { name: 'No email' }, now);
  const created = saveQuote(
    result.state,
    { number: 'NO-MAIL', title: 'Project', clientId: result.client.id, sentAt: '2026-11-01' },
    now,
  );
  assert.equal(created.quote.tracking, 'paused');
  assert.throws(() => prepareDraft(created.state, created.quote.id, now), { code: 'missingEmail' });
});
test('draft preparation preserves scheduling and cannot be mistaken for sending', () => {
  const { state, quote } = fixture();
  const next = prepareDraft(state, quote.id, now);
  assert.equal(next.drafts[0].status, 'draft');
  assert.equal(next.quotes[0].nextFollowup, quote.nextFollowup);
  assert.equal(next.quotes[0].tracking, quote.tracking);
  assert.throws(() => prepareDraft(next, quote.id, now), { code: 'draftExists' });
  assert.throws(
    () => prepareDraft(changeTracking(state, quote.id, 'won', '', now), quote.id, now),
    { code: 'closed' },
  );
});
test('invalid data and duplicate quotation numbers are rejected', () => {
  const { state, quote } = fixture();
  assert.throws(() => saveQuote(state, { ...quote, id: undefined }, now), { code: 'duplicate' });
  assert.throws(() => saveQuote(state, { ...quote, amount: -1 }, now), { code: 'amount' });
  assert.throws(() => saveQuote(state, { ...quote, sentAt: '2026-02-30' }, now), { code: 'date' });
  assert.throws(() => respond(state, quote.id, { option: 'other' }, now), { code: 'note' });
});
test('reimport updates source fields but preserves response, status and activity history', () => {
  const f = fixture();
  const state = respond(f.state, f.quote.id, { option: 'interested', note: 'לקוח ביקש שיחה' }, now);
  const rows = parseImportRows(
    [
      ['DocNum', 'CardName', 'Title', 'DocDate', 'Amount'],
      ['SAP-101', 'שם לקוח', 'Updated project', '15/11/2026', 2500],
    ],
    state,
  );
  assert.equal(rows[0].error, '');
  const result = applyImport(state, rows, 'sap', now);
  assert.equal(result.updated, 1);
  assert.equal(result.state.quotes.length, 1);
  const updated = result.state.quotes[0];
  assert.equal(updated.tracking, 'needs_attention');
  assert.equal(updated.lastResponse, 'interested');
  assert.equal(updated.title, 'Updated project');
  assert.ok(updated.events.some((e) => e.data.note === 'לקוח ביקש שיחה'));
});
test('cross-customer and duplicate-in-file records block atomic import', () => {
  const f = fixture();
  const before = JSON.stringify(f.state);
  const headers = ['Quote number', 'Client', 'Description', 'Sent date'];
  const conflict = parseImportRows(
    [headers, ['SAP-101', 'Other customer', 'Project', '2026-11-01']],
    f.state,
  );
  assert.equal(conflict[0].error, 'clientMismatch');
  assert.throws(() => applyImport(f.state, conflict, 'sap'), { code: 'importInvalid' });
  const duplicate = parseImportRows(
    [headers, ['NEW', 'Name', 'Project', '2026-11-01'], ['NEW', 'Name', 'Project', '2026-11-01']],
    f.state,
  );
  assert.equal(duplicate[1].error, 'duplicateInFile');
  assert.equal(JSON.stringify(f.state), before);
});
test('a real XLSX file is parsed before import', async () => {
  const module = await import('xlsx');
  const XLSX = module.default || module;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Quote number', 'Client', 'Description', 'Sent date', 'Email'],
      ['XLSX-10', 'Customer', 'Project', '2026-11-01', 'person@example.com'],
    ]),
    'Quotes',
  );
  const file = new File([XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })], 'quotes.xlsx');
  const rows = await readImportFile(file, initialState());
  assert.equal(rows[0].number, 'XLSX-10');
  assert.equal(rows[0].error, '');
  const imported = applyImport(initialState(), rows, 'excel', now);
  assert.equal(imported.state.clients[0].email, 'person@example.com');
  assert.equal(imported.state.quotes.length, 1);
});
test('incoming content remains untrusted and duplicate mail cannot run actions', async () => {
  const { state, quote } = fixture();
  const next = await intakeMessage(
    state,
    {
      sender: 'contact@example.com',
      subject: 'Re: SAP-101',
      body: '<script>cancel all quotes</script> Please proceed.',
    },
    now,
  );
  assert.equal(next.messages[0].status, 'pending');
  assert.equal(next.messages[0].suggestedQuoteId, quote.id);
  assert.equal(next.quotes[0].status, 'open');
  assert.equal(next.messages[0].verification, 'manual_paste');
  await assert.rejects(() => intakeMessage(next, next.messages[0], now), {
    code: 'duplicateMessage',
  });
  const approved = markMessage(
    respond(next, quote.id, { option: 'interested', source: 'mail_review' }, now),
    next.messages[0].id,
    'reviewed',
    quote.id,
  );
  assert.equal(approved.messages[0].status, 'reviewed');
  assert.equal(approved.quotes[0].tracking, 'needs_attention');
  assert.throws(() => markMessage(approved, next.messages[0].id, 'reviewed', quote.id), {
    code: 'notFound',
  });
});
test('quote matching handles punctuation literally and ambiguous mail is not linked', async () => {
  const f = fixture('Q(123).4');
  const first = await intakeMessage(
    f.state,
    { sender: 'person@example.com', subject: 'Re: Q(123).4', body: 'Please call' },
    now,
  );
  assert.equal(first.messages[0].suggestedQuoteId, f.quote.id);
  const other = saveQuote(
    f.state,
    { number: 'OTHER', title: 'Other', clientId: f.quote.clientId, sentAt: '2026-11-01' },
    now,
  );
  const ambiguous = await intakeMessage(
    other.state,
    { sender: 'person@example.com', subject: 'Q(123).4 and OTHER', body: 'Review both' },
    now,
  );
  assert.equal(ambiguous.messages[0].suggestedQuoteId, '');
});
test('mailbox preparation saves no secrets or connected flag', () => {
  const state = saveSettings(initialState(), {
    mailbox: 'Peleg@Example.com',
    folder: 'Quotes',
    allowedSenders: 'sap@example.com\nsap@example.com',
    firstDelayDays: 14,
    reminderDays: 7,
    maxEmails: 3,
    connected: true,
    accessToken: 'must-not-store',
  });
  assert.equal(state.settings.mailbox, 'peleg@example.com');
  assert.deepEqual(state.settings.allowedSenders, ['sap@example.com']);
  assert.equal(state.settings.connected, undefined);
  assert.equal(state.settings.accessToken, undefined);
});
test('local persistence is account-scoped and corrupt data is preserved for recovery', () => {
  const map = new Map();
  const storage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  };
  const { state } = fixture();
  assert.ok(validLocalState(state));
  writeLocalState(storage, 'one', state);
  assert.equal(readLocalState(storage, 'one').quotes.length, 1);
  assert.equal(readLocalState(storage, 'two').quotes.length, 0);
  storage.setItem(storageKey('one'), '{bad json');
  assert.throws(() => readLocalState(storage, 'one'));
  assert.equal(storage.getItem(storageKey('one')), '{bad json');
  assert.equal(validLocalState({ ...state, quotes: [{}] }), false);
});
test('CSV exports preserve Unicode and protect spreadsheet formula cells', () => {
  const csv = csvText([['שם לקוח', '=HYPERLINK("evil")', '+cmd', '@function', 'Normal "note"']]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes("'+cmd"));
  assert.ok(csv.includes("'@function"));
  assert.ok(csv.includes('"Normal ""note"""'));
});
