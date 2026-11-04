// Cross-North Highway / Road 6 northern section (כביש 6 חוצה צפון) — monthly invoice.
//
// The data comes from two files that arrive together:
//  - the invoice PDF, page 1 only ("חשבונית חודשית - כביש 6 חוצה צפון בע"מ"):
//      ["926003405253","חשבונית מס:"] -> invoice number
//      ["02/11/2026","תאריך הפקה:"] -> issue date
//      ["₪299.75","סכומים חייבים במע"מ"], [...,"₪53.95",...,"סה"כ מע"מ"], ["₪353.70","סה"כ כולל מע"מ"] -> totals
//  - the summary Excel (…_sum…xlsx): one row per vehicle with the amount EXCLUDING VAT.
//      columns: מספר_חשבונית | מספר_רכב | מספר_נסיעות | סהכ_ללא_מעמ | מספר_הקצאה

import { toCents } from '../fuel/parseDelekReport.js';
import { formatPlate } from '../tolls/parseTollInvoice.js';

const DECIMAL_PATTERN = /^-?\d{1,3}(?:,\d{3})*\.\d{2}$|^-?\d+\.\d{2}$/;
const DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const PLATE_PATTERN = /^\d{7,8}$/;

const money = (token) => token.replace(/^₪/, '');

/** pages: string[][][] from extractPdfLines. Throws a Hebrew message if the layout is not recognised. */
export function parseCrossNorthPages(pages) {
  const lines = (pages[0] || []).map((tokens) => ({ tokens, text: tokens.join(' ') }));

  if (!lines.some((line) => line.text.includes('חוצה צפון'))) {
    throw new Error('הקובץ לא זוהה כחשבונית של כביש 6 חוצה צפון — לא נמצאה הכותרת "חשבונית חודשית - כביש 6 חוצה צפון".');
  }

  const invoiceNumber = lines
    .filter((line) => line.text.includes('חשבונית מס:'))
    .map((line) => line.tokens.find((token) => /^\d{8,15}$/.test(token)))
    .find(Boolean);

  const issueDate = lines
    .filter((line) => line.text.includes('תאריך הפקה'))
    .map((line) => line.tokens.map((token) => token.match(DATE_PATTERN)).find(Boolean))
    .filter(Boolean)
    .map((m) => ({ year: Number(m[3]), month: Number(m[2]), day: Number(m[1]) }))[0];

  const firstDecimal = (predicate) => {
    const line = lines.find(predicate);
    return line ? line.tokens.map(money).find((token) => DECIMAL_PATTERN.test(token)) ?? null : null;
  };
  const taxable = firstDecimal((l) => l.text.includes('סכומים חייבים במע"מ'));
  const vat = firstDecimal((l) => l.text.includes('סה"כ מע"מ') && !l.text.includes('כולל'));
  const total = firstDecimal((l) => l.text.includes('סה"כ כולל מע"מ'));

  const missing = [];
  if (!invoiceNumber) missing.push('מספר חשבונית המס');
  if (!issueDate) missing.push('תאריך הפקה');
  if (taxable === null) missing.push('סכומים חייבים במע"מ');
  if (vat === null) missing.push('סה"כ מע"מ');
  if (total === null) missing.push('סה"כ כולל מע"מ');
  if (missing.length) throw new Error(`הקובץ לא זוהה כחשבונית של כביש 6 חוצה צפון — לא נמצא: ${missing.join(', ')}.`);

  return {
    invoiceNumber,
    allocationNumber: '',
    issueDate,
    taxableCents: toCents(taxable),
    vatCents: toCents(vat),
    totalCents: toCents(total),
  };
}

const normalizeHeader = (value) => String(value ?? '').replace(/[_\s'"׳״]/g, '');

/** Reads the summary Excel. Returns Map<invoiceDigits, vehicle[]> (amounts ex-VAT, in cents). */
export async function parseCrossNorthSummary(file) {
  const xlsxModule = await import('xlsx');
  const XLSX = xlsxModule.default || xlsxModule;
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

  const headerIndex = rows.findIndex((row) => row.some((cell) => normalizeHeader(cell) === 'מספרחשבונית'));
  if (headerIndex < 0) throw new Error('קובץ האקסל לא זוהה כסיכום של כביש 6 חוצה צפון — לא נמצאה עמודת "מספר_חשבונית".');
  const header = rows[headerIndex].map(normalizeHeader);
  const col = {
    invoice: header.indexOf('מספרחשבונית'),
    plate: header.indexOf('מספררכב'),
    trips: header.indexOf('מספרנסיעות'),
    amount: header.indexOf('סהכללאמעמ'),
  };
  if (col.plate < 0 || col.amount < 0) throw new Error('קובץ האקסל לא זוהה כסיכום של כביש 6 חוצה צפון — חסרות העמודות "מספר_רכב" ו"סהכ_ללא_מעמ".');

  const byInvoice = new Map();
  for (const row of rows.slice(headerIndex + 1)) {
    const invoiceDigits = String(row[col.invoice] ?? '').replace(/\D/g, '');
    const plateDigits = String(row[col.plate] ?? '').replace(/\D/g, '');
    const amountText = String(row[col.amount] ?? '').replace(/,/g, '').trim();
    if (!invoiceDigits || !PLATE_PATTERN.test(plateDigits) || !/^-?\d+(\.\d+)?$/.test(amountText)) continue;
    if (!byInvoice.has(invoiceDigits)) byInvoice.set(invoiceDigits, []);
    byInvoice.get(invoiceDigits).push({
      plate: formatPlate(plateDigits),
      plateDigits,
      exVatCents: toCents(amountText),
      trips: col.trips >= 0 ? Number(row[col.trips]) || 0 : 0,
    });
  }
  if (!byInvoice.size) throw new Error('קובץ האקסל ריק — לא נמצאו שורות רכב.');
  return byInvoice;
}

/**
 * Joins the PDF totals with the Excel vehicle rows. Per-row rounding in the Excel can leave the
 * rows a cent off the invoice's taxable total: the largest row absorbs the gap (a real mismatch still fails the checks).
 */
export function combineCrossNorth(invoice, vehicles) {
  const rows = vehicles.map((v) => ({ ...v }));
  const gap = invoice.taxableCents - rows.reduce((sum, v) => sum + v.exVatCents, 0);
  if (gap !== 0 && Math.abs(gap) <= rows.length) {
    const largest = rows.reduce((best, v) => (v.exVatCents > best.exVatCents ? v : best), rows[0]);
    largest.exVatCents += gap;
  }
  return { ...invoice, vehicles: rows };
}
