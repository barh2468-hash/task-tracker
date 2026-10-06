import { normalizeCardNumber } from './normalizeAccountingKeys.js';

export const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];
const PLATE_ALIASES = ["מס' רכב", 'מספר רכב', 'מס רכב'];
const CARD_ALIASES = ['כרטיס הנח"ש', 'כרטיס הנחש', 'כרטיס'];
const BALANCE_TRIAL_ALIASES = ['הוצאות מאזן בוחן-קונטו', 'הוצאות מאזן בוחן', 'מאזן בוחן'];
const NOTES_ALIASES = ['הערות', 'פרטים'];
const HEADER_SEARCH_ROWS = 10;
const TOTAL_ROW_MARKER = 'סה"כ';

// Reserved extra_fields keys that carry the source sheet's own row layout,
// so the year-end export can reproduce it exactly (split rows, side notes,
// original cell values) — including when re-exported from saved data.
// sourceRow/continuationRows' row are stored as an OFFSET from the source
// file's own header row (1 = the first data row), not an absolute row
// number — the uploaded file's header can sit anywhere, while the export
// template always has its own fixed number of header rows.
export const LAYOUT_KEYS = {
  sourceRow: '__source_row',
  sourcePlate: '__source_plate',
  primaryMonths: '__primary_months',
  continuationRows: '__continuation_rows',
  sideNotes: '__side_notes',
};

function cleanCell(value) {
  return String(value ?? '').trim();
}

function cellMatchesAlias(cell, aliases) {
  const normalized = cleanCell(cell);
  if (!normalized) return false;
  return aliases.some((alias) => normalized === alias || normalized.includes(alias));
}

function findColumnIndex(headerRow, aliases) {
  return headerRow.findIndex((cell) => cellMatchesAlias(cell, aliases));
}

function isBlankRow(row) {
  return !row || row.every((cell) => cleanCell(cell) === '');
}

function parseAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Columns with no header text (the free-text column after "הוצ' פחת" —
 * "ב-12.8.24 עבר מליסינג למשה סירי…", "רכב חלופי") carry notes about changes
 * during the year. Joined into one side-notes value per row.
 */
function sideNotesFor(row, headerRow, classifiedIndexes) {
  return (row || [])
    .map((cell, index) => (!classifiedIndexes.has(index) && !cleanCell(headerRow[index]) ? cleanCell(cell) : ''))
    .filter(Boolean)
    .join(' | ');
}

function extraFieldsFor(row, extraColumns) {
  const extraFields = {};
  extraColumns.forEach(({ label, index }) => {
    extraFields[label] = cleanCell(row[index]);
  });
  return extraFields;
}

function sourcePlateCell(value) {
  return typeof value === 'number' ? value : cleanCell(value);
}

function detectVehiclePayrollHeader(rows) {
  const searchLimit = Math.min(rows.length, HEADER_SEARCH_ROWS);
  for (let rowIndex = 0; rowIndex < searchLimit; rowIndex += 1) {
    const headerRow = (rows[rowIndex] || []).map(cleanCell);
    const plateIndex = findColumnIndex(headerRow, PLATE_ALIASES);
    const monthIndexes = HEBREW_MONTHS.map((month) => headerRow.indexOf(month));
    if (plateIndex === -1 || monthIndexes.every((index) => index === -1)) continue;

    const classifiedIndexes = new Set([plateIndex, ...monthIndexes.filter((index) => index >= 0)]);
    const cardIndex = findColumnIndex(headerRow, CARD_ALIASES);
    if (cardIndex >= 0) classifiedIndexes.add(cardIndex);
    const balanceTrialIndex = findColumnIndex(headerRow, BALANCE_TRIAL_ALIASES);
    if (balanceTrialIndex >= 0) classifiedIndexes.add(balanceTrialIndex);
    const notesIndex = findColumnIndex(headerRow, NOTES_ALIASES);
    if (notesIndex >= 0) classifiedIndexes.add(notesIndex);

    const extraColumns = headerRow
      .map((label, index) => ({ label, index }))
      .filter(({ label, index }) => label && !classifiedIndexes.has(index));

    return {
      headerRowIndex: rowIndex,
      headerRow,
      classifiedIndexes,
      plateIndex,
      monthIndexes,
      cardIndex,
      balanceTrialIndex,
      notesIndex,
      extraColumns,
    };
  }
  return null;
}

/**
 * Parses the payroll/vehicle-hub shape (מס' רכב, 12 month driver columns,
 * כרטיס הנח"ש, הוצאות מאזן בוחן-קונטו, plus columns that grow year to year)
 * from a raw 2D array of cell values.
 *
 * The sheet is two sections stacked with blank spacer rows between them: the
 * plated vehicles first, then card-only rows (trailers, trucks, parking,
 * fuel refunds — no plate, just a card and a balance), ending in a totals
 * row that repeats the balance-trial column's sum with no card or plate at
 * all. A blank row is therefore not "end of table" — only a row with
 * neither a plate label nor a card number is dropped, and even then only
 * when it carries no month data either (the totals row, or genuine stray
 * blank padding) — a keyless row that DOES carry month data is the same
 * vehicle's driver history spilling onto a second row (a mid-year driver
 * change that didn't fit the single row above it).
 *
 * That continuation row is kept as its own row in the record's layout
 * (LAYOUT_KEYS.continuationRows) so the export reproduces the split exactly;
 * its drivers also fill the record's empty months in `driver_assignments`,
 * which is what matching and per-driver summaries read.
 *
 * Every other cell is kept as-is from the source — the value columns
 * (שווי רכב, חודשי שימוש, שווי צ"ל, נטרול, הפרש) are never recalculated or
 * cleared, and header-less columns are kept as side notes.
 */
export function parseVehiclePayrollRows(rows, { year } = {}) {
  const header = detectVehiclePayrollHeader(rows);
  if (!header) throw new Error('לא זוהו עמודות רכב/כרטיס בקובץ טבלת השכר.');

  const records = [];
  for (let rowIndex = header.headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (isBlankRow(row)) continue;
    if (row.some((cell) => cleanCell(cell).includes(TOTAL_ROW_MARKER))) break;

    const plateLabel = cleanCell(row[header.plateIndex]);
    const cardNumber = header.cardIndex >= 0 ? normalizeCardNumber(row[header.cardIndex]) || null : null;
    const monthValues = header.monthIndexes.map((index) => (index >= 0 ? cleanCell(row[index]) : ''));
    const sideNotes = sideNotesFor(row, header.headerRow, header.classifiedIndexes);

    if (!plateLabel && !cardNumber) {
      const previous = records[records.length - 1];
      const rowExtraFields = extraFieldsFor(row, header.extraColumns);
      const hasMonthData = monthValues.some((value) => value !== '');
      // A row with no plate/card and no drivers can still carry a stray value
      // in one of the source's own columns (e.g. a leftover "0" in a spacer
      // row) — kept as a continuation row so the export reproduces it,
      // without merging into the vehicle above (nothing to merge: no drivers).
      const hasStrayData = Object.values(rowExtraFields).some((value) => value !== '') || sideNotes !== '';
      if (previous && (hasMonthData || hasStrayData)) {
        if (hasMonthData) {
          previous.driver_assignments = previous.driver_assignments.map((assignment, index) =>
            assignment.driver ? assignment : { ...assignment, driver: monthValues[index] },
          );
        }
        previous.extra_fields[LAYOUT_KEYS.continuationRows].push({
          row: rowIndex - header.headerRowIndex,
          months: monthValues,
          extra_fields: rowExtraFields,
          side_notes: sideNotes,
        });
      }
      continue;
    }

    const driverAssignments = HEBREW_MONTHS.map((month, index) => ({ month, driver: monthValues[index] }));

    const extraFields = {
      ...extraFieldsFor(row, header.extraColumns),
      [LAYOUT_KEYS.sourceRow]: rowIndex - header.headerRowIndex,
      [LAYOUT_KEYS.sourcePlate]: sourcePlateCell(row[header.plateIndex]),
      [LAYOUT_KEYS.primaryMonths]: monthValues,
      [LAYOUT_KEYS.continuationRows]: [],
      [LAYOUT_KEYS.sideNotes]: sideNotes,
    };

    records.push({
      year,
      plate_number: plateLabel || `כרטיס ${cardNumber}`,
      card_number: cardNumber,
      driver_assignments: driverAssignments,
      balance_trial_amount: header.balanceTrialIndex >= 0 ? parseAmount(row[header.balanceTrialIndex]) : null,
      extra_fields: extraFields,
      notes: header.notesIndex >= 0 ? cleanCell(row[header.notesIndex]) : '',
      link_status: 'unlinked',
      linked_card_balance_id: null,
    });
  }

  if (!records.length) throw new Error('לא נמצאו שורות רכב תקינות בקובץ.');
  return records;
}
