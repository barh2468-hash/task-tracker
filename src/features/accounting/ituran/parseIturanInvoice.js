// Reads an Ituran (איתוראן) "חשבונית מס" PDF — monthly subscription invoice.
//
// Page 1 holds everything needed. Layout (tokens left-to-right as pdf.js gives them):
//  - ["מקור","77170701","מס'","חשבונית מס"] -> invoice number
//  - ["28/10/2026","תאריך:"] -> issue date
//  - rows: amount | rate | ₪ | price | ... | "ר" | plate | "דמי מנוי" | service
//  - ["602.31","סה"כ לפני מע"מ"], ["108.42","18.00","מע"מ %"], ["710.73","סה"כ לתשלום"]

import { toCents } from '../fuel/parseDelekReport.js';
import { formatPlate } from '../tolls/parseTollInvoice.js';

const DECIMAL_PATTERN = /^-?\d{1,3}(?:,\d{3})*\.\d{2}$|^-?\d+\.\d{2}$/;
const DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const PLATE_PATTERN = /^\d{7,8}$/;

/** pages: string[][][] from extractPdfLines. Throws a Hebrew message if the layout is not recognised. */
export function parseIturanPages(pages) {
  const lines = pages.flatMap((page) => page.map((tokens) => ({ tokens, text: tokens.join(' ') })));

  const invoiceNumber = lines
    .filter((line) => line.tokens.includes('מקור') && line.text.includes('חשבונית מס'))
    .map((line) => line.tokens.find((token) => /^\d{6,10}$/.test(token)))
    .find(Boolean);

  const issueDate = lines
    .filter((line) => line.tokens.includes('תאריך:'))
    .map((line) => line.tokens.map((token) => token.match(DATE_PATTERN)).find(Boolean))
    .filter(Boolean)
    .map((m) => ({ year: Number(m[3]), month: Number(m[2]), day: Number(m[1]) }))[0];

  const firstDecimal = (predicate) => {
    const line = lines.find(predicate);
    return line ? line.tokens.find((token) => DECIMAL_PATTERN.test(token)) ?? null : null;
  };
  const taxable = firstDecimal((l) => l.text.includes('סה"כ לפני מע"מ'));
  const vat = firstDecimal((l) => l.text.includes('מע"מ %'));
  const total = firstDecimal((l) => l.text.includes('סה"כ לתשלום'));

  // Subscription rows: the amount leads the line, the plate follows the "ר" (מס' רישוי) marker.
  const vehicles = [];
  for (const line of lines) {
    const marker = line.tokens.indexOf('ר');
    if (marker < 1 || !DECIMAL_PATTERN.test(line.tokens[0])) continue;
    const plate = line.tokens[marker + 1];
    if (!PLATE_PATTERN.test(plate)) continue;
    vehicles.push({ plate: formatPlate(plate), plateDigits: plate, exVatCents: toCents(line.tokens[0]) });
  }

  const missing = [];
  if (!invoiceNumber) missing.push('מספר חשבונית המס');
  if (!issueDate) missing.push('תאריך החשבונית');
  if (taxable === null) missing.push('סה"כ לפני מע"מ');
  if (vat === null) missing.push('מע"מ');
  if (total === null) missing.push('סה"כ לתשלום');
  if (!vehicles.length) missing.push('שורות חיוב לפי רכב');
  if (missing.length) throw new Error(`הקובץ לא זוהה כחשבונית מס של איתוראן — לא נמצא: ${missing.join(', ')}.`);

  return {
    invoiceNumber,
    allocationNumber: '',
    issueDate,
    taxableCents: toCents(taxable),
    vatCents: toCents(vat),
    totalCents: toCents(total),
    vehicles,
  };
}
