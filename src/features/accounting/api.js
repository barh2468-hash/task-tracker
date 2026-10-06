import {
  extractPlateNumbers,
  isVehiclePlate,
  normalizeCardNumber,
  normalizePlateNumber,
} from './utils/normalizeAccountingKeys.js';

// Year-end table, built from two uploaded files.
//
// Both the payroll/vehicle file and the balance-prep file are uploaded
// together each time; the output is built purely from matching those two
// in memory (by card number, falling back to plate number). Nothing is
// written to the database — the result lives in the page until it is
// exported to Excel.

/** Indexes balance rows by every plate number embedded in their label (see extractPlateNumbers). */
function buildPlateIndex(balanceRecords) {
  const index = new Map();
  for (const row of balanceRecords) {
    for (const plate of extractPlateNumbers(row.label)) {
      if (!index.has(plate)) index.set(plate, row);
    }
  }
  return index;
}

/**
 * Matches the freshly parsed payroll rows against the freshly parsed balance
 * rows, by card number, falling back to plate number. Balance rows that no
 * payroll row claims (a bookkeeping card with no vehicle behind it, e.g. a
 * fuel account or a card closed before this year's vehicle file was cut) are
 * appended as their own rows rather than dropped — otherwise those cards
 * never appear anywhere in the year-end table at all.
 */
export function matchPayrollToBalances(payrollRecords, balanceRecords, year) {
  // First occurrence wins: a card repeated further down the balance file
  // must not overwrite the row already indexed (collectMatchWarnings flags it).
  const byCard = new Map();
  for (const row of balanceRecords) {
    const cardNumber = normalizeCardNumber(row.card_number);
    if (!byCard.has(cardNumber)) byCard.set(cardNumber, row);
  }
  const byPlate = buildPlateIndex(balanceRecords);
  const claimedCardNumbers = new Set();

  const matched = payrollRecords.map((record) => {
    const cardNumber = normalizeCardNumber(record.card_number);
    const plateNumber = normalizePlateNumber(record.plate_number);
    const match = (cardNumber && byCard.get(cardNumber)) || (plateNumber && byPlate.get(plateNumber)) || null;
    if (match) claimedCardNumbers.add(normalizeCardNumber(match.card_number));
    return { ...record, link_status: match ? 'linked' : 'unlinked', matchedBalance: match || null };
  });

  const cardOnlyRecords = [...byCard.values()]
    .filter((row) => !claimedCardNumbers.has(normalizeCardNumber(row.card_number)))
    .map((row) => ({
      year: year ?? payrollRecords[0]?.year ?? null,
      plate_number: row.plate_number || `כרטיס ${normalizeCardNumber(row.card_number)}`,
      card_number: normalizeCardNumber(row.card_number),
      driver_assignments: [],
      balance_trial_amount: null,
      extra_fields: {},
      notes: row.notes || '',
      link_status: 'linked',
      linked_card_balance_id: null,
      matchedBalance: row,
    }));

  return [...matched, ...cardOnlyRecords];
}

const AMOUNT_TOLERANCE = 0.005;

function formatAmount(value) {
  return Number(value).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Balance labels end with the driver's first name (e.g. "8182 - רכב 11019704
 * (48)- נהוראי"), after the plate/card numbers and a trailing "(NN)" leasing
 * index. Picks that name out for the driver cross-check below: the last
 * Hebrew-lettered word, skipping the generic "רכב".
 */
function guessDriverHintFromLabel(label) {
  const tokens = String(label ?? '')
    .split(/\s+/)
    .filter((token) => /[א-ת]/.test(token) && token !== 'רכב');
  return tokens[tokens.length - 1] || '';
}

/**
 * The processing log for a year-end match: every place where the two files
 * disagree or the result needed a judgment call. The balance file's amount
 * is always the one used (it's the one tied to the trial balance) — these
 * warnings just make each such case visible instead of silent. Stored with
 * the import's audit row on commit.
 */
export function collectMatchWarnings(matchedRecords, balanceRecords = []) {
  const warnings = [];
  const claimsByCard = new Map();

  (matchedRecords || []).forEach((record) => {
    if (record.link_status === 'ignored') return;
    const balance = record.matchedBalance;
    if (!balance) {
      warnings.push({
        type: 'unmatched_vehicle',
        plate_number: record.plate_number,
        message: `${record.plate_number}: לא נמצא כרטיס יתרה מתאים בקובץ ההיתרות — יש לשייך ידנית לפני הייצוא.`,
      });
      return;
    }
    const cardNumber = normalizeCardNumber(balance.card_number);
    claimsByCard.set(cardNumber, [...(claimsByCard.get(cardNumber) || []), record.plate_number]);

    if (balance.balance_missing) {
      warnings.push({
        type: 'balance_missing',
        card_number: cardNumber,
        plate_number: record.plate_number,
        message: `כרטיס ${cardNumber}: תא היתרה בקובץ היתרות ריק — נרשם 0, יש לבדוק.`,
      });
      return;
    }

    if (isVehiclePlate(record.plate_number) && record.driver_assignments?.length) {
      const driverHint = guessDriverHintFromLabel(balance.label);
      const driverNames = record.driver_assignments.map(({ driver }) => String(driver ?? '').trim()).filter(Boolean);
      if (driverHint && driverNames.length && !driverNames.some((name) => name.includes(driverHint))) {
        warnings.push({
          type: 'driver_mismatch',
          card_number: cardNumber,
          plate_number: record.plate_number,
          message: `רכב ${record.plate_number} (כרטיס ${cardNumber}): קובץ ההיתרות מזהה את הנהג כ"${driverHint}", אך השם לא מופיע בשיוכי הנהגים בקובץ השכר — ייתכן חילוף נהגים בין רכבים, כדאי לבדוק.`,
        });
      }
    }

    const payrollAmount = Number(record.balance_trial_amount);
    const balanceAmount = Number(balance.balance_ils);
    if (
      record.balance_trial_amount !== null &&
      record.balance_trial_amount !== undefined &&
      Number.isFinite(payrollAmount) &&
      Number.isFinite(balanceAmount) &&
      Math.abs(payrollAmount - balanceAmount) > AMOUNT_TOLERANCE
    ) {
      const delta = Math.round((balanceAmount - payrollAmount) * 100) / 100;
      warnings.push({
        type: 'amount_mismatch',
        card_number: cardNumber,
        plate_number: record.plate_number,
        payroll_amount: payrollAmount,
        balance_amount: balanceAmount,
        delta,
        message: `כרטיס ${cardNumber}: בקובץ השכר ${formatAmount(payrollAmount)}, בקובץ היתרות ${formatAmount(balanceAmount)} (הפרש ${formatAmount(delta)}) — עודכן לפי קובץ היתרות.`,
      });
    }
  });

  claimsByCard.forEach((plates, cardNumber) => {
    if (plates.length > 1) {
      warnings.push({
        type: 'duplicate_card_claim',
        card_number: cardNumber,
        plate_numbers: plates,
        message: `כרטיס ${cardNumber} משויך ליותר מרכב אחד: ${plates.join(', ')}.`,
      });
    }
  });

  const seenBalanceCards = new Set();
  (balanceRecords || []).forEach((row) => {
    const cardNumber = normalizeCardNumber(row.card_number);
    if (seenBalanceCards.has(cardNumber)) {
      warnings.push({
        type: 'duplicate_balance_card',
        card_number: cardNumber,
        message: `כרטיס ${cardNumber} מופיע יותר מפעם אחת בקובץ היתרות — נלקחה ההופעה הראשונה.`,
      });
    }
    seenBalanceCards.add(cardNumber);
  });

  return warnings;
}
