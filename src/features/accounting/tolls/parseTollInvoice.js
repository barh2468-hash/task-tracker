// Reads a Road 6 (דרך ארץ הייווייז) "חשבונית מס" PDF.
//
// Only the invoice header and the per-vehicle summary table (pages 1-2) are
// used — the trip-by-trip pages after them are ignored. Layout:
//  - "חשבונית מס מספר" -> invoice number (e.g. 1266-445754)
//  - "הקצאה מספר" -> tax-authority allocation number (9 digits). Small invoices
//    have none, so it is optional.
//  - "תאריך הפקת החשבונית" -> issue date
//  - totals: "סה"כ סכומים ב-18% מע"מ", "סה"כ מע"מ", "סה"כ כולל מע"מ"
//  - per-vehicle rows: amount before VAT | trips | vehicle number

import { toCents } from '../fuel/parseDelekReport.js';

const DECIMAL_PATTERN = /^-?\d{1,3}(?:,\d{3})*\.\d{2}$|^-?\d+\.\d{2}$/;
const VEHICLE_NUMBER_PATTERN = /^\d{7,8}$/;
const DATE_PATTERN = /(\d{2})\/(\d{2})\/(\d{4})/;

/** Israeli plate, 7 digits as XX-XXX-XX and 8 digits as XXX-XX-XXX. */
export function formatPlate(digits) {
  return digits.length === 7
    ? `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
    : `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

const decimals = (tokens) => tokens.filter((token) => DECIMAL_PATTERN.test(token)).map(toCents);

/** pages: string[][][] from extractPdfLines. Throws a Hebrew message if the layout is not recognised. */
export function parseTollPages(pages) {
  const lines = pages.flatMap((page) => page.map((tokens) => ({ tokens, text: tokens.join(' ') })));

  const invoiceNumber = lines
    .filter((line) => line.text.includes('חשבונית מס מספר'))
    .map((line) => line.tokens.find((token) => /^\d{3,5}-\d{5,7}$/.test(token)))
    .find(Boolean);

  const allocationNumber =
    lines
      .filter((line) => line.text.includes('הקצאה מספר'))
      .map((line) => line.tokens.find((token) => /^\d{9}$/.test(token)))
      .find(Boolean) || '';

  const dateMatch = lines.map((line) => (line.text.includes('תאריך הפקת החשבונית') ? line.text.match(DATE_PATTERN) : null)).find(Boolean);
  const issueDate = dateMatch ? { year: Number(dateMatch[3]), month: Number(dateMatch[2]), day: Number(dateMatch[1]) } : null;

  const firstDecimal = (predicate) => {
    const line = lines.find(predicate);
    return line ? decimals(line.tokens)[0] ?? null : null;
  };
  const taxableCents = firstDecimal((l) => l.text.includes('סכומים') && l.text.includes('18%'));
  const vatCents = firstDecimal(
    (l) => l.text.includes('סה"כ') && l.text.includes('מע"מ') && !l.text.includes('כולל') && !l.text.includes('סכומים'),
  );
  const totalCents = firstDecimal((l) => l.text.includes('סה"כ') && l.text.includes('כולל') && l.text.includes('מע"מ'));

  // Summary rows are exactly: amount, trip count, vehicle number. Trip-detail rows have many more tokens.
  const vehicles = [];
  for (const line of lines) {
    const [amount, trips, vehicle] = line.tokens;
    if (line.tokens.length !== 3 || !DECIMAL_PATTERN.test(amount) || !/^\d{1,4}$/.test(trips) || !VEHICLE_NUMBER_PATTERN.test(vehicle)) continue;
    vehicles.push({ plate: formatPlate(vehicle), plateDigits: vehicle, exVatCents: toCents(amount), trips: Number(trips) });
  }

  const missing = [];
  if (!invoiceNumber) missing.push('מספר חשבונית המס');
  if (!issueDate) missing.push('תאריך הפקת החשבונית');
  if (taxableCents === null) missing.push('סה"כ סכומים ב-18% מע"מ');
  if (vatCents === null) missing.push('סה"כ מע"מ');
  if (totalCents === null) missing.push('סה"כ כולל מע"מ');
  if (!vehicles.length) missing.push('פירוט חיובים לרכב');
  if (missing.length) throw new Error(`הקובץ לא זוהה כחשבונית מס של כביש 6 — לא נמצא: ${missing.join(', ')}.`);

  return { invoiceNumber, allocationNumber, issueDate, taxableCents, vatCents, totalCents, vehicles };
}
