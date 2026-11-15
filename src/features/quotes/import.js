import {
  addDays,
  dateValid,
  emailValid,
  fail,
  normalize,
  saveClient,
  saveQuote,
  today,
} from './model.js';

const aliases = {
  number: [
    'quote number',
    'quotation number',
    'document number',
    'docnum',
    'מספר הצעה',
    'מספר הצעת מחיר',
    'מספר מסמך',
    'αριθμός προσφοράς',
  ],
  client: [
    'client',
    'client name',
    'customer',
    'customer name',
    'cardname',
    'לקוח',
    'שם לקוח',
    'πελάτης',
  ],
  title: [
    'title',
    'description',
    'project',
    'project name',
    'תיאור',
    'שם פרויקט',
    'פרויקט',
    'τίτλος',
    'περιγραφή',
  ],
  email: [
    'email',
    'e-mail',
    'contact email',
    'מייל',
    'דוא״ל',
    'דואל',
    'כתובת מייל',
    'email πελάτη',
  ],
  sentAt: [
    'sent date',
    'sent at',
    'date',
    'docdate',
    'תאריך שליחה',
    'תאריך הצעה',
    'תאריך',
    'ημερομηνία αποστολής',
  ],
  amount: ['amount', 'total', 'doctotal', 'סכום', 'סכום לפני מעמ', 'ποσό'],
  contact: ['contact', 'contact name', 'איש קשר', 'איש קשר לקוח', 'επαφή'],
};
const headerKey = (value) =>
  normalize(value).replace(/[_-]/g, ' ').replace(/[.:]/g, '').replace(/\s+/g, ' ');
export function parseDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime()))
    return value.toISOString().slice(0, 10);
  const text = String(value || '').trim();
  if (dateValid(text)) return text;
  const match = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (match) {
    const date = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    if (dateValid(date)) return date;
  }
  return '';
}
export function parseImportRows(rows, state) {
  const headerIndex = rows
    .slice(0, 15)
    .findIndex((row) => aliases.number.some((a) => row.some((v) => headerKey(v) === headerKey(a))));
  if (headerIndex < 0) fail('headers');
  const header = rows[headerIndex];
  const mapping = Object.fromEntries(
    Object.entries(aliases).map(([key, names]) => [
      key,
      header.findIndex((v) => names.some((a) => headerKey(v) === headerKey(a))),
    ]),
  );
  if (['number', 'client', 'title', 'sentAt'].some((key) => mapping[key] < 0)) fail('headers');
  if (
    rows.slice(headerIndex + 1).filter((row) => row.some((v) => String(v ?? '').trim())).length >
    5000
  )
    fail('tooManyRows');
  const seen = new Set();
  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((v) => String(v ?? '').trim()))
    .map((row, index) => {
      const read = (key) => (mapping[key] < 0 ? '' : String(row[mapping[key]] ?? '').trim());
      const number = read('number'),
        client = read('client'),
        title = read('title'),
        email = read('email').toLowerCase();
      const sentAt = parseDate(row[mapping.sentAt]);
      const amountText = read('amount').replace(/[,\s₪€$]/g, '');
      const amount = amountText ? Number(amountText) : '';
      const existing = state.quotes.find((q) => normalize(q.number) === normalize(number));
      const existingClient = state.clients.find((c) => normalize(c.name) === normalize(client));
      let error = '';
      if (!number || !client || !title) error = 'required';
      else if (!sentAt) error = 'date';
      else if (email && !emailValid(email)) error = 'email';
      else if (amount !== '' && (!Number.isFinite(amount) || amount < 0)) error = 'amount';
      else if (seen.has(normalize(number))) error = 'duplicateInFile';
      else if (
        existing &&
        normalize(state.clients.find((c) => c.id === existing.clientId)?.name) !== normalize(client)
      )
        error = 'clientMismatch';
      seen.add(normalize(number));
      return {
        row: headerIndex + index + 2,
        number,
        client,
        title,
        email,
        sentAt,
        amount,
        contact: read('contact'),
        existingId: existing?.id || '',
        warning: !email && !existingClient?.email ? 'missingEmail' : '',
        error,
      };
    });
}
export function applyImport(state, rows, source, now = new Date()) {
  if (!['sap', 'excel'].includes(source) || !rows.length || rows.some((row) => row.error))
    fail('importInvalid');
  // Revalidate against the current state; a preview is not authorization to overwrite another client.
  let next = state;
  let added = 0,
    updated = 0;
  for (const row of rows) {
    let client = next.clients.find((c) => normalize(c.name) === normalize(row.client));
    if (!client) {
      const result = saveClient(
        next,
        { name: row.client, email: row.email, contact: row.contact },
        now,
      );
      next = result.state;
      client = result.client;
    } else if (!client.email && row.email) {
      const result = saveClient(next, { ...client, email: row.email }, now);
      next = result.state;
      client = result.client;
    }
    const existing = next.quotes.find((q) => normalize(q.number) === normalize(row.number));
    if (existing && existing.clientId !== client.id) fail('clientMismatch');
    const result = saveQuote(
      next,
      {
        ...existing,
        number: row.number,
        title: row.title,
        clientId: client.id,
        sentAt: row.sentAt,
        amount: row.amount,
        source,
      },
      now,
    );
    next = result.state;
    if (existing) updated++;
    else added++;
  }
  return { state: next, added, updated };
}
export async function readImportFile(file, state) {
  if (file.size > 8 * 1024 * 1024) fail('fileSize');
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) fail('fileType');
  const module = await import('xlsx');
  const XLSX = module.default || module;
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    cellDates: true,
    cellFormula: false,
    sheetRows: 5016,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) fail('headers');
  return parseImportRows(
    XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }),
    state,
  );
}
export function importExampleRows(now = new Date()) {
  return [
    ['Quote number', 'Client', 'Title', 'Email', 'Sent date', 'Amount'],
    [
      'SAP-EXAMPLE-001',
      'Example Customer',
      'Example Project',
      'contact@example.com',
      addDays(today(now), -10),
      15000,
    ],
  ];
}
