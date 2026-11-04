// Reads a Carmel Tunnels (מנהרות הכרמל) "חשבונית מס" PDF — monthly tolls per vehicle.
//
// Same shape as the Road 6 invoice, only the date has a 2-digit year. Pages 1-2 matter:
//  - "חשבון לשירותי מנהרות הכרמל" -> identifies the supplier
//  - ["2261-572038","חשבונית מס מספר"] -> invoice number
//  - ["02/11/26","תאריך הפקת החשבונית"] -> issue date (dd/mm/yy)
//  - ["327.31","מע"מ","18%",...,"סה"כ"], ["58.92","מע"מ","סה"כ"], ["386.23",...,"כולל",...] -> totals
//  - summary rows (exactly 3 tokens): amount incl. VAT | trips | vehicle number
//  The trip-by-trip rows on page 2 have many more tokens and are ignored.

import { toCents } from '../fuel/parseDelekReport.js';
import { formatPlate } from '../tolls/parseTollInvoice.js';
import { VAT_RATE_PERCENT } from '../fuel/fuelConfig.js';

const DECIMAL_PATTERN = /^-?\d{1,3}(?:,\d{3})*\.\d{2}$|^-?\d+\.\d{2}$/;
const DATE_PATTERN = /(\d{2})\/(\d{2})\/(\d{2}|\d{4})\b/;
const PLATE_PATTERN = /^\d{7,8}$/;

/** pages: string[][][] from extractPdfLines. Throws a Hebrew message if the layout is not recognised. */
export function parseCarmelPages(pages) {
  const lines = pages.flatMap((page) => page.map((tokens) => ({ tokens, text: tokens.join(' ') })));

  if (!lines.some((line) => line.text.includes('מנהרות הכרמל'))) {
    throw new Error('הקובץ לא זוהה כחשבונית מס של מנהרות הכרמל — לא נמצאה הכותרת "חשבון לשירותי מנהרות הכרמל".');
  }

  const invoiceNumber = lines
    .filter((line) => line.text.includes('חשבונית מס מספר'))
    .map((line) => line.tokens.find((token) => /^\d{3,5}-\d{5,7}$/.test(token)))
    .find(Boolean);

  const dateMatch = lines.map((line) => (line.text.includes('תאריך הפקת החשבונית') ? line.text.match(DATE_PATTERN) : null)).find(Boolean);
  const issueDate = dateMatch
    ? { year: dateMatch[3].length === 2 ? 2000 + Number(dateMatch[3]) : Number(dateMatch[3]), month: Number(dateMatch[2]), day: Number(dateMatch[1]) }
    : null;

  const firstDecimal = (predicate) => {
    const line = lines.find(predicate);
    return line ? line.tokens.find((token) => DECIMAL_PATTERN.test(token)) ?? null : null;
  };
  const taxable = firstDecimal((l) => l.text.includes('סכומים') && l.text.includes('18%'));
  const vat = firstDecimal((l) => l.text.includes('סה"כ') && l.text.includes('מע"מ') && !l.text.includes('כולל') && !l.text.includes('סכומים'));
  const total = firstDecimal((l) => l.text.includes('סה"כ') && l.text.includes('כולל') && l.text.includes('מע"מ'));

  // The per-vehicle amounts on this invoice already include VAT, so they are converted to ex-VAT below.
  const vehicles = [];
  for (const line of lines) {
    const [amount, trips, vehicle] = line.tokens;
    if (line.tokens.length !== 3 || !DECIMAL_PATTERN.test(amount) || !/^\d{1,4}$/.test(trips) || !PLATE_PATTERN.test(vehicle)) continue;
    const inclVatCents = toCents(amount);
    vehicles.push({ plate: formatPlate(vehicle), plateDigits: vehicle, inclVatCents, exVatCents: Math.round((inclVatCents * 100) / (100 + VAT_RATE_PERCENT)), trips: Number(trips) });
  }

  // Per-row rounding can leave the ex-VAT rows a cent or two off the invoice's taxable total:
  // the largest row absorbs the gap (only when the rows add up to the invoice total, so a real mismatch still fails the checks).
  if (vehicles.length && taxable !== null && total !== null && vehicles.reduce((s, v) => s + v.inclVatCents, 0) === toCents(total)) {
    const gap = toCents(taxable) - vehicles.reduce((s, v) => s + v.exVatCents, 0);
    if (Math.abs(gap) <= vehicles.length) {
      const largest = vehicles.reduce((best, v) => (v.exVatCents > best.exVatCents ? v : best), vehicles[0]);
      largest.exVatCents += gap;
    }
  }

  const missing = [];
  if (!invoiceNumber) missing.push('מספר חשבונית המס');
  if (!issueDate) missing.push('תאריך הפקת החשבונית');
  if (taxable === null) missing.push('סה"כ סכומים ב-18% מע"מ');
  if (vat === null) missing.push('סה"כ מע"מ');
  if (total === null) missing.push('סה"כ כולל מע"מ');
  if (!vehicles.length) missing.push('פירוט חיובים לרכב');
  if (missing.length) throw new Error(`הקובץ לא זוהה כחשבונית מס של מנהרות הכרמל — לא נמצא: ${missing.join(', ')}.`);

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
