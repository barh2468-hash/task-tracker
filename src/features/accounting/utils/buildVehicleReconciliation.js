import { extractPlateNumbers, isVehiclePlate, normalizeCardNumber } from './normalizeAccountingKeys.js';

export const RECONCILIATION_TITLE = 'אחזקת רכבים שכר מאיה';

const OWNERSHIP_LABEL_PATTERN = 'בעלות';
const USAGE_NOTES_LABEL_PATTERN = 'הערות לגבי';

function cleanCell(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function parseAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function extraFieldByPattern(record, pattern) {
  const label = Object.keys(record.extra_fields || {}).find((key) => key.includes(pattern));
  return label ? cleanCell(record.extra_fields[label]) : '';
}

function isVehicleRecord(record) {
  return isVehiclePlate(record.plate_number);
}

/** Drivers in first-seen month order, each with how many months they held the car. */
function driverMonths(record) {
  const counts = new Map();
  (record.driver_assignments || []).forEach(({ driver }) => {
    const name = cleanCell(driver);
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  });
  return [...counts.entries()].map(([driver, months]) => ({ driver, months }));
}

function resolvePlate(record) {
  const plateLabel = cleanCell(record.plate_number);
  if (isVehicleRecord(record)) return plateLabel;
  return (
    extractPlateNumbers(plateLabel)[0] ||
    extractPlateNumbers(record.matchedBalance?.label)[0] ||
    ''
  );
}

function cardSortKey(cardNumber) {
  const numeric = Number(cardNumber);
  return Number.isFinite(numeric) && cardNumber !== '' ? numeric : Number.POSITIVE_INFINITY;
}

/**
 * Builds the final "אחזקת רכבים שכר מאיה" reconciliation rows — one per
 * bookkeeping card, in the balance-report shape (כרטיס, ליסינג/ מאיה,
 * מס' רכב, פרטים, הוצאה במאזן, הערות) — from matched year-end records
 * (the output of matchPayrollToBalances, or loadYearEndTable for a saved
 * year). The balance file wins wherever both sources carry a value, since
 * it's the one tied to the trial balance; the payroll file fills the gaps.
 *
 * A card claimed by more than one record (e.g. a vehicle row and a
 * card-only row pointing at the same balance) is kept once, preferring the
 * vehicle row, so its expense isn't counted twice in the total.
 */
export function buildReconciliationRows(records) {
  const byCard = new Map();
  const withoutCard = [];

  (records || []).forEach((record) => {
    if (record.link_status === 'ignored') return;
    const balance = record.matchedBalance || null;
    const cardNumber = normalizeCardNumber(balance?.card_number ?? record.card_number);
    const isVehicle = isVehicleRecord(record);
    const drivers = isVehicle ? driverMonths(record) : [];
    const balanceAmount = parseAmount(balance?.balance_ils);
    const trialAmount = parseAmount(record.balance_trial_amount);

    const row = {
      card_number: cardNumber,
      ownership: cleanCell(balance?.ownership_type) || extraFieldByPattern(record, OWNERSHIP_LABEL_PATTERN),
      plate: resolvePlate(record),
      details: drivers.length
        ? drivers.map(({ driver, months }) => `${driver} (${months})`).join(', ')
        : cleanCell(balance?.label),
      months_used: isVehicle ? drivers.reduce((sum, { months }) => sum + months, 0) : null,
      expense: balanceAmount ?? trialAmount ?? 0,
      notes:
        cleanCell(balance?.notes) ||
        extraFieldByPattern(record, USAGE_NOTES_LABEL_PATTERN) ||
        cleanCell(record.notes),
      isVehicle,
    };

    if (!cardNumber) {
      withoutCard.push(row);
      return;
    }
    const existing = byCard.get(cardNumber);
    if (!existing || (!existing.isVehicle && row.isVehicle)) byCard.set(cardNumber, row);
  });

  const rows = [...byCard.values()].sort((a, b) => cardSortKey(a.card_number) - cardSortKey(b.card_number));
  return [...rows, ...withoutCard];
}

/** Total balance-sheet expense across reconciliation rows, rounded to agorot. */
export function sumExpense(rows) {
  return roundCurrency((rows || []).reduce((sum, row) => sum + (Number(row.expense) || 0), 0));
}

