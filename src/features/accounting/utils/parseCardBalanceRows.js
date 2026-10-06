import { normalizeCardNumber } from './normalizeAccountingKeys.js';

const CARD_NUMBER_ALIASES = ['כרטיס', 'מספר כרטיס', 'מס כרטיס', "מס' כרטיס", 'כרטיס אשראי'];
const OWNERSHIP_ALIASES = ['ליסינג/ מאיה', 'ליסינג/מאיה', 'סוג רכב', 'בעלות'];
const LABEL_ALIASES = ["כרטיס/ מס' רכב", 'כרטיס/מס רכב', 'כרטיס / מס רכב', 'פרטי כרטיס', 'תיאור'];
const BALANCE_ALIASES = ['יתרה', 'יתרת חובה', 'יתרה לתאריך', 'סכום'];
const NOTES_ALIASES = ['פרטים', 'הערות', 'סטטוס'];
const HEADER_SEARCH_ROWS = 10;
const TOTAL_ROW_MARKER = 'סה"כ';

export class AccountingHeaderDetectionError extends Error {
  constructor(message, candidateHeaderRow, candidateHeaderRowIndex) {
    super(message);
    this.name = 'AccountingHeaderDetectionError';
    this.candidateHeaderRow = candidateHeaderRow;
    this.candidateHeaderRowIndex = candidateHeaderRowIndex;
  }
}

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

/**
 * Some real exports (the "table 2" balance-sheet prep workbook) leave the
 * balance column entirely unlabeled. When no header text matches, guess it
 * structurally instead: the first not-yet-claimed column, among the next
 * few data rows below the header, that actually holds a numeric value
 * (amounts are numbers; every other column in this shape is text).
 */
function guessBalanceColumnByType(rows, headerRowIndex, claimedIndexes) {
  const dataRows = rows.slice(headerRowIndex + 1, headerRowIndex + 4).filter((row) => !isBlankRow(row));
  if (!dataRows.length) return -1;

  const columnCount = Math.max(...dataRows.map((row) => row.length));
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    if (claimedIndexes.has(columnIndex)) continue;
    if (dataRows.every((row) => typeof row[columnIndex] === 'number')) return columnIndex;
  }
  return -1;
}

function detectCardBalanceHeader(rows) {
  const searchLimit = Math.min(rows.length, HEADER_SEARCH_ROWS);
  for (let rowIndex = 0; rowIndex < searchLimit; rowIndex += 1) {
    const headerRow = (rows[rowIndex] || []).map(cleanCell);
    const cardIndex = findColumnIndex(headerRow, CARD_NUMBER_ALIASES);
    if (cardIndex === -1) continue;

    const ownershipIndex = findColumnIndex(headerRow, OWNERSHIP_ALIASES);
    const labelIndex = findColumnIndex(headerRow, LABEL_ALIASES);
    const notesIndex = findColumnIndex(headerRow, NOTES_ALIASES);
    let balanceIndex = findColumnIndex(headerRow, BALANCE_ALIASES);
    if (balanceIndex === -1) {
      balanceIndex = guessBalanceColumnByType(
        rows,
        rowIndex,
        new Set([cardIndex, ownershipIndex, labelIndex, notesIndex].filter((index) => index >= 0)),
      );
    }
    if (balanceIndex === -1) continue;

    return {
      headerRowIndex: rowIndex,
      columns: {
        card_number: cardIndex,
        ownership_type: ownershipIndex,
        label: labelIndex,
        balance_ils: balanceIndex,
        notes: notesIndex,
      },
    };
  }
  return null;
}

function isBlankRow(row) {
  return !row || row.every((cell) => cleanCell(cell) === '');
}

function countPopulatedCells(row) {
  return (row || []).filter((cell) => cleanCell(cell) !== '').length;
}

/**
 * Guesses which row is the real header row when alias-based detection fails
 * — the row with the most populated cells within the search window, since a
 * title row above the header usually only fills one cell (e.g. a merged
 * sheet title), while the header row fills every column.
 */
function guessHeaderRowIndex(rows) {
  const searchLimit = Math.min(rows.length, HEADER_SEARCH_ROWS);
  let bestIndex = 0;
  let bestCount = -1;
  for (let rowIndex = 0; rowIndex < searchLimit; rowIndex += 1) {
    const count = countPopulatedCells(rows[rowIndex]);
    if (count > bestCount) {
      bestCount = count;
      bestIndex = rowIndex;
    }
  }
  return bestIndex;
}

function parseBalanceAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Parses the "table 2" card/balance shape (כרטיס, ליסינג/מאיה, כרטיס/מס' רכב,
 * יתרה, פרטים) from a raw 2D array of cell values.
 *
 * `columns` can be supplied explicitly (manual column mapping from the UI)
 * to bypass auto-detection when the header doesn't match known aliases.
 */
export function parseCardBalanceRows(rows, { year, columns, headerRowIndex } = {}) {
  let resolvedColumns = columns;
  let resolvedHeaderRowIndex = headerRowIndex;

  if (!resolvedColumns) {
    const detected = detectCardBalanceHeader(rows);
    if (!detected) {
      const candidateHeaderRowIndex = guessHeaderRowIndex(rows);
      const candidateHeaderRow = (rows[candidateHeaderRowIndex] || []).map(cleanCell);
      throw new AccountingHeaderDetectionError(
        'לא זוהו עמודות כרטיס/יתרה בקובץ. יש למפות את העמודות ידנית.',
        candidateHeaderRow,
        candidateHeaderRowIndex,
      );
    }
    resolvedColumns = detected.columns;
    resolvedHeaderRowIndex = detected.headerRowIndex;
  }

  // Reads every card row down to the totals row ("סה"כ - אחזקת כלי רכב"),
  // then stops — the to-do notes below it are not data. A card whose
  // balance cell is blank is kept (balance 0, flagged `balance_missing`)
  // rather than ending the read there and silently dropping every card
  // below it. Rows with no numeric card number (stray notes) are skipped.
  const records = [];
  for (let rowIndex = resolvedHeaderRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (isBlankRow(row)) continue;
    if (row.some((cell) => cleanCell(cell).includes(TOTAL_ROW_MARKER))) break;

    const cardNumber = normalizeCardNumber(row[resolvedColumns.card_number]);
    if (!/^\d+$/.test(cardNumber)) continue;
    const balance = parseBalanceAmount(row[resolvedColumns.balance_ils]);

    records.push({
      year,
      card_number: cardNumber,
      ownership_type: resolvedColumns.ownership_type >= 0 ? cleanCell(row[resolvedColumns.ownership_type]) : '',
      label: resolvedColumns.label >= 0 ? cleanCell(row[resolvedColumns.label]) : '',
      balance_ils: balance ?? 0,
      balance_missing: balance === null,
      notes: resolvedColumns.notes >= 0 ? cleanCell(row[resolvedColumns.notes]) : '',
    });
  }

  if (!records.length) throw new Error('לא נמצאו שורות יתרה תקינות בקובץ.');
  return records;
}
