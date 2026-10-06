import { HEBREW_MONTHS, LAYOUT_KEYS } from './parseVehiclePayrollRows.js';
import { extractPlateNumbers, isVehiclePlate, normalizeCardNumber } from './normalizeAccountingKeys.js';

const THIN_BORDER = { style: 'thin' };
const ALL_SIDES_BORDER = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
const HEADER_FILL = 'FFCCFFFF';
const FIRST_DATA_ROW = 4;

// Column layout of the source payroll sheet ("אחזקת רכבים 2024"), A..Y:
// plate, 12 months, card, trial-balance expense, the value columns, status
// notes, ownership, depreciation, and a header-less side-notes column. Value
// columns are matched against each record's raw extra_fields labels by
// substring, since the source header wording drifts year to year (e.g.
// "שווי רכב לפי רשיון רכב" vs "שווי רכב- בפועל( לפי רשיון רכב)").
const PLATE_COL = 1;
const FIRST_MONTH_COL = 2;
const CARD_COL = FIRST_MONTH_COL + HEBREW_MONTHS.length; // N
const EXPENSE_COL = CARD_COL + 1; // O
const MONTHS_USED_COL = 17; // Q
// The vehicle-value-by-license column (P) is no longer sourced from the
// payroll upload — the office stopped tracking it there, so it's left blank
// on every row (the header still prints; only the per-vehicle values do not).
const ACTUAL_VALUE_COL = 16;
const VALUE_COLUMNS = [
  { col: ACTUAL_VALUE_COL, header: 'שווי רכב- בפועל( לפי רשיון רכב)', match: 'שווי רכב' }, // P
  { col: MONTHS_USED_COL, header: (year) => `חודשי שימוש ב ${year}`, match: 'חודשי שימוש' }, // Q
  { col: 18, header: 'שווי שימוש לכל השנה (לחודש)', match: 'שווי שימוש' }, // R
  { col: 19, header: 'שווי צ"ל', match: 'שווי צ' }, // S
  { col: 20, header: 'נטרול שווי שימוש בכרטיס', match: 'נטרול' }, // T
  { col: 21, header: 'הפרש שווי', match: 'הפרש' }, // U
];
const STATUS_COL = 22; // V
const OWNERSHIP_COL = 23; // W
const DEPRECIATION_COL = 24; // X
const SIDE_NOTES_COL = 25; // Y
// The ownership column's header wording drifts year to year — "בעלות ליסינג/
// מאיה" in some years, plain "ליסינג/ מאיה" (the same wording the balance
// file uses for its own ownership column) in others.
const OWNERSHIP_MATCH = ['בעלות', 'ליסינג/'];
const DEPRECIATION_MATCH = 'פחת';
// Columns the source merges vertically across a vehicle's split rows.
const SPLIT_MERGE_COLS = [PLATE_COL, CARD_COL, EXPENSE_COL, 16, 17, STATUS_COL, OWNERSHIP_COL];
const COLUMN_WIDTHS = [
  19, 11.9, 11.9, 11.6, 11.9, 11.9, 11.6, 11.6, 11.9, 15.1, 11.6, 14.4, 12.3,
  9.7, 12.3, 16, 10.7, 15.9, 15.9, 14.7, 15.9, 27.6, 35.6, 8, 54.3,
];

// The source sheet color-codes its ownership column: a numbered "ליסינג-XX"
// entry is plain, but a person or company holding several cars directly
// gets a background so those cars visually group together. The known
// holders keep the source sheet's colors; any new holder gets the next
// palette color in order of first appearance.
const LEASING_PREFIX = 'ליסינג';
const KNOWN_OWNERSHIP_COLORS = {
  'סירי משה': 'FFDAACF6',
  'סירי עדנה': 'FFADB9CA',
  'מאיה': 'FFC6E0B4',
  'אילנית': 'FFFF0000',
};
const OWNERSHIP_PALETTE = ['FFD9D9D9', 'FFF4CCCC', 'FFCFE2F3', 'FFFFF2CC'];

function companyTitle(year) {
  return `מאיה - מ.י. אתור ומפוי - תשתיות תת קרקעיות בע"מ  אחזקת רכבים ${year}`;
}

function cleanCell(value) {
  return String(value ?? '').trim();
}

function numericOrText(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  const text = cleanCell(value);
  if (text === '') return '';
  const numeric = Number(text.replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric : text;
}

/** Plates that are pure digits in the source (card-only rows) are numbers there; dashed plates stay text. */
function plateCellValue(value) {
  if (typeof value === 'number') return value;
  const text = cleanCell(value);
  return /^\d+$/.test(text) ? Number(text) : text;
}

function findExtraLabel(extraFields, needle) {
  const patterns = Array.isArray(needle) ? needle : [needle];
  return (
    Object.keys(extraFields || {}).find(
      (label) => !label.startsWith('__') && patterns.some((pattern) => label.includes(pattern)),
    ) || null
  );
}

function extraValue(extraFields, needle) {
  const label = findExtraLabel(extraFields, needle);
  return label ? numericOrText(extraFields[label]) : '';
}

function fillCell(cell, argb) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

// The status column marks sold/stolen/inactive with colored text in the
// source sheet — everything else (mainly "קיים") stays plain black.
function notesFont(notes) {
  const text = cleanCell(notes);
  if (text.includes('נגנב')) return { color: { argb: 'FFCC0000' }, bold: true };
  if (text.includes('נמכר')) return { color: { argb: 'FF1155CC' } };
  if (text.startsWith('לא קיים')) return { color: { argb: 'FFCC0000' } };
  return null;
}

/**
 * The balance file's own label carries the leasing agreement's index right
 * after the plate number, e.g. "8181 - רכב 83493903 (46)- רונן" -> "46"
 * (occasionally two agreements, "(20+43)" -> "20+43"). Only meaningful when
 * the label actually is a plain "leasing" entry with no company/status
 * suffix of its own yet.
 */
function leasingIndexFromLabel(label) {
  const match = cleanCell(label).match(/\((\d[\d+]*)\)/);
  return match ? match[1] : null;
}

/**
 * The payroll sheet's own status/ownership cell wins when it has one; a
 * blank cell (common for cards where that column simply isn't filled in for
 * the year) falls back to the balance file, same as the expense amount —
 * the balance file is the one tied to the trial balance. A bare "ליסינג"
 * (no company/status suffix already appended) gets the agreement number
 * from the balance label tacked on, same as the office does by hand.
 */
function ownershipFor(record) {
  const value = cleanCell(extraValue(record.extra_fields, OWNERSHIP_MATCH)) || cleanCell(record.matchedBalance?.ownership_type);
  if (value === LEASING_PREFIX) {
    const index = leasingIndexFromLabel(record.matchedBalance?.label);
    if (index) return `${LEASING_PREFIX}-${index}`;
  }
  return value;
}

function statusFor(record) {
  return cleanCell(record.notes) || cleanCell(record.matchedBalance?.notes);
}

function buildOwnershipColorMap(records) {
  const colors = new Map();
  records.forEach((record) => {
    const value = ownershipFor(record);
    if (!value || value.startsWith(LEASING_PREFIX) || colors.has(value)) return;
    const paletteIndex = [...colors.keys()].filter((key) => !KNOWN_OWNERSHIP_COLORS[key]).length;
    colors.set(value, KNOWN_OWNERSHIP_COLORS[value] || OWNERSHIP_PALETTE[paletteIndex % OWNERSHIP_PALETTE.length]);
  });
  return colors;
}

/**
 * Turns a balance label into the plain description the source sheet uses in
 * its own plate column: strips the "8192 - " card-number prefix and a
 * leading "רכב " word, keeps only the asset-type word(s) that come BEFORE
 * the embedded id number (e.g. "משאית רנו" in "משאית רנו 5664231"), and
 * drops anything AFTER the number (a driver first name, a leasing index
 * like "(15)") — the source sheet never carries that trailing text here.
 * "8192 - נגרר 80366601" -> "נגרר 80366601"; "8206 - רכב 45056502 (15) אופק" -> "45056502".
 */
function descriptionFromBalanceLabel(label) {
  const text = cleanCell(label).replace(/^\d+\s*-\s*/, '').replace(/^רכב\s+/, '').trim();
  if (!text) return '';
  const numberMatch = text.match(/\d{6,}/);
  if (!numberMatch) return text;
  const prefix = text.slice(0, numberMatch.index).replace(/[-/]\s*$/, '').trim();
  return prefix ? `${prefix} ${numberMatch[0]}` : numberMatch[0];
}

/**
 * A card-only row's own plate cell is just the generic "כרטיס NNNN"
 * placeholder (no plate column in that section of the source) — the
 * balance file's label usually carries the real description (a trailer/
 * truck name, or at least an embedded plate number) instead.
 */
function plateFor(record) {
  const extraFields = record.extra_fields || {};
  const rawPlate = LAYOUT_KEYS.sourcePlate in extraFields ? extraFields[LAYOUT_KEYS.sourcePlate] : record.plate_number;
  const plateText = cleanCell(rawPlate);
  if (!plateText.startsWith('כרטיס ')) return plateCellValue(rawPlate);
  return plateCellValue(
    descriptionFromBalanceLabel(record.matchedBalance?.label) ||
      extractPlateNumbers(record.matchedBalance?.label)[0] ||
      plateText,
  );
}

function primaryMonthsFor(record) {
  const months = record.extra_fields?.[LAYOUT_KEYS.primaryMonths];
  if (Array.isArray(months)) return months;
  return HEBREW_MONTHS.map(
    (month) => record.driver_assignments?.find((assignment) => assignment.month === month)?.driver || '',
  );
}

/**
 * "חודשי שימוש" (months of use) is recalculated for real vehicles, from the
 * count of months with any driver entry (merged across split rows, "משרד"
 * included — a car sitting idle some months is still a car the company had
 * for those months), rather than trusted from the source cell: the source
 * leaves it blank on rows whose months came from a continuation row. A
 * card-only row (no plate) keeps whatever the source itself carries there.
 */
function monthsInUseFor(record) {
  if (!isVehiclePlate(record.plate_number)) return null;
  return (record.driver_assignments || []).filter(({ driver }) => cleanCell(driver) !== '').length;
}

/** The balance file's amount wins; the payroll file's own expense is the fallback. */
function expenseFor(record) {
  const balance = record.matchedBalance;
  if (balance && !balance.balance_missing && Number.isFinite(Number(balance.balance_ils))) {
    return Number(balance.balance_ils);
  }
  const trial = Number(record.balance_trial_amount);
  return record.balance_trial_amount !== null && record.balance_trial_amount !== undefined && Number.isFinite(trial)
    ? trial
    : '';
}

function primaryRowValues(record) {
  const values = new Array(SIDE_NOTES_COL).fill('');
  const extraFields = record.extra_fields || {};
  values[PLATE_COL - 1] = plateFor(record);
  primaryMonthsFor(record).forEach((driver, index) => {
    values[FIRST_MONTH_COL - 1 + index] = cleanCell(driver);
  });
  const cardNumber = normalizeCardNumber(record.card_number || record.matchedBalance?.card_number);
  values[CARD_COL - 1] = /^\d+$/.test(cardNumber) ? Number(cardNumber) : cardNumber;
  values[EXPENSE_COL - 1] = expenseFor(record);
  const monthsInUse = monthsInUseFor(record);
  VALUE_COLUMNS.forEach(({ col, match }) => {
    if (col === ACTUAL_VALUE_COL) return;
    values[col - 1] = col === MONTHS_USED_COL && monthsInUse !== null ? monthsInUse : extraValue(extraFields, match);
  });
  values[STATUS_COL - 1] = statusFor(record);
  values[OWNERSHIP_COL - 1] = ownershipFor(record);
  values[DEPRECIATION_COL - 1] = extraValue(extraFields, DEPRECIATION_MATCH);
  values[SIDE_NOTES_COL - 1] = cleanCell(extraFields[LAYOUT_KEYS.sideNotes]);
  return values;
}

function continuationRowValues(continuation) {
  const values = new Array(SIDE_NOTES_COL).fill('');
  (continuation.months || []).forEach((driver, index) => {
    values[FIRST_MONTH_COL - 1 + index] = cleanCell(driver);
  });
  VALUE_COLUMNS.forEach(({ col, match }) => {
    if (col === ACTUAL_VALUE_COL) return;
    values[col - 1] = extraValue(continuation.extra_fields, match);
  });
  values[SIDE_NOTES_COL - 1] = cleanCell(continuation.side_notes);
  return values;
}

/** Converts a source-file row offset (1 = the source's own first data row) to this export's absolute row number. */
function outputRowForOffset(offset) {
  return Number.isFinite(offset) ? FIRST_DATA_ROW - 1 + offset : null;
}

/**
 * Lays records out on sheet rows. A record parsed from the source sheet goes
 * back on its source row (continuation rows on theirs, converted from the
 * source file's own row offset to this export's row numbering — the
 * uploaded file's header doesn't necessarily take up as many rows as this
 * export's fixed title/header block does), so blank spacer rows between the
 * vehicle and card-only sections are reproduced and the totals row lands
 * where it did in the source. Records with no source row (a card that only
 * exists in the balance file, or data saved before layouts were kept) are
 * appended after the last placed row. Rows never collide: each item goes at
 * max(its source row, previous row + 1).
 */
function layoutRows(records) {
  const placed = [];
  const unplaced = [];
  records.forEach((record) => {
    const offset = Number(record.extra_fields?.[LAYOUT_KEYS.sourceRow]);
    const sourceRow = outputRowForOffset(offset);
    (Number.isFinite(offset) && offset >= 1 ? placed : unplaced).push({ record, sourceRow });
  });
  placed.sort((a, b) => a.sourceRow - b.sourceRow);

  const items = [];
  let lastRow = FIRST_DATA_ROW - 1;
  const place = (record, sourceRow) => {
    const primaryRow = Math.max(sourceRow || 0, lastRow + 1);
    lastRow = primaryRow;
    const continuationRows = (record.extra_fields?.[LAYOUT_KEYS.continuationRows] || []).map((continuation) => {
      const continuationRow = outputRowForOffset(Number(continuation.row));
      lastRow = Math.max(continuationRow || 0, lastRow + 1);
      return { row: lastRow, values: continuationRowValues(continuation) };
    });
    items.push({ record, row: primaryRow, values: primaryRowValues(record), continuationRows });
  };
  placed.forEach(({ record, sourceRow }) => place(record, sourceRow));
  unplaced.forEach(({ record }) => place(record, null));
  return { items, lastRow };
}

function styleCell(cell, extra = {}) {
  cell.font = { name: 'Arial', size: 10, ...extra.font };
  cell.border = ALL_SIDES_BORDER;
  if (extra.numFmt) cell.numFmt = extra.numFmt;
}

/**
 * Builds the year-end workbook in the exact layout of the source payroll
 * sheet ("2024.xlsx"): company title in D1 (merged D1:H1), an empty row 2,
 * the 24 source column headers in row 3 (A "מס' רכב" .. X "הוצ' פחת") plus
 * the header-less side-notes column Y, one row per source row — split
 * vehicles keep both their rows, with A/N/O/P/Q/V/W merged across them as
 * in the source — and a totals row whose O cell is a live SUM formula.
 *
 * N and O carry the card and the balance-file amount (the reconciled
 * expense); V the vehicle's status; Y the free-text change notes. The value
 * columns (P..U) are copied from the source untouched. No helper columns
 * are appended.
 */
export async function createYearEndWorkbook({ year, records }) {
  const excelJsModule = await import('exceljs');
  const ExcelJS = excelJsModule.default || excelJsModule;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'מערכת איתור תשתיות';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(String(year), {
    views: [{ rightToLeft: true }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  worksheet.mergeCells(1, 4, 1, 8);
  const titleCell = worksheet.getCell(1, 4);
  titleCell.value = companyTitle(year);
  titleCell.font = { name: 'Arial', size: 12, bold: true, underline: true };
  titleCell.alignment = { horizontal: 'center', wrapText: true, readingOrder: 'rtl' };

  // Two standing editorial notes the source sheet always carries in this
  // corner (unrelated to any vehicle row): a reminder of the two valuation
  // methods, and a note to double check with the office. Static every year.
  worksheet.getCell(1, 16).value = 'שווי לפי מכפל';
  worksheet.getCell(1, 19).value = 'שווי לפי סימולטר מס הכנסה';
  worksheet.getCell(2, 16).value = 'לבקש מנוגה';
  worksheet.getCell(2, 17).value = '↨';
  [
    [1, 16],
    [1, 19],
    [2, 16],
    [2, 17],
  ].forEach(([row, col]) => {
    worksheet.getCell(row, col).font = { name: 'Arial', size: 10 };
  });

  const headerRow = worksheet.getRow(3);
  const headers = new Array(SIDE_NOTES_COL).fill('');
  headers[PLATE_COL - 1] = "מס' רכב";
  HEBREW_MONTHS.forEach((month, index) => {
    headers[FIRST_MONTH_COL - 1 + index] = month;
  });
  headers[CARD_COL - 1] = 'כרטיס הנח"ש';
  headers[EXPENSE_COL - 1] = 'הוצאות מאזן בוחן-קונטו';
  VALUE_COLUMNS.forEach(({ col, header }) => {
    headers[col - 1] = typeof header === 'function' ? header(year) : header;
  });
  headers[STATUS_COL - 1] = 'הערות לגבי תקופת השימוש/שווי';
  headers[OWNERSHIP_COL - 1] = 'בעלות ליסינג/ מאיה';
  headers[DEPRECIATION_COL - 1] = "הוצ' פחת";
  headerRow.values = headers;
  headerRow.height = 39.6;
  for (let col = 1; col <= SIDE_NOTES_COL; col += 1) {
    const cell = headerRow.getCell(col);
    styleCell(cell, { font: { bold: true } });
    fillCell(cell, HEADER_FILL);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rtl' };
  }

  const ownershipColors = buildOwnershipColorMap(records);
  const { items, lastRow } = layoutRows(records);

  // Every row between the header and the totals gets the table border, including blank spacer rows.
  for (let rowNumber = FIRST_DATA_ROW; rowNumber <= lastRow; rowNumber += 1) {
    for (let col = 1; col <= SIDE_NOTES_COL; col += 1) {
      styleCell(worksheet.getCell(rowNumber, col), col === EXPENSE_COL ? { numFmt: '#,##0.00' } : {});
    }
  }

  items.forEach(({ row, values, continuationRows }) => {
    values.forEach((value, index) => {
      worksheet.getCell(row, index + 1).value = value === '' ? null : value;
    });
    continuationRows.forEach((continuation) => {
      continuation.values.forEach((value, index) => {
        worksheet.getCell(continuation.row, index + 1).value = value === '' ? null : value;
      });
    });

    const ownershipColor = ownershipColors.get(cleanCell(values[OWNERSHIP_COL - 1]));
    if (ownershipColor) fillCell(worksheet.getCell(row, OWNERSHIP_COL), ownershipColor);
    const statusStyle = notesFont(values[STATUS_COL - 1]);
    if (statusStyle) worksheet.getCell(row, STATUS_COL).font = { name: 'Arial', size: 10, ...statusStyle };
    worksheet.getCell(row, SIDE_NOTES_COL).alignment = { wrapText: true };

    const lastSplitRow = continuationRows.length ? continuationRows[continuationRows.length - 1].row : row;
    const contiguous = continuationRows.every((continuation, index) => continuation.row === row + index + 1);
    if (lastSplitRow > row && contiguous) {
      SPLIT_MERGE_COLS.forEach((col) => {
        worksheet.mergeCells(row, col, lastSplitRow, col);
        worksheet.getCell(row, col).alignment = { vertical: 'middle', horizontal: 'center' };
      });
    }
  });

  const totalRowNumber = lastRow + 1;
  const expenseLetter = worksheet.getColumn(EXPENSE_COL).letter;
  const totalCell = worksheet.getCell(totalRowNumber, EXPENSE_COL);
  const total = items.reduce((sum, { values }) => sum + (Number(values[EXPENSE_COL - 1]) || 0), 0);
  totalCell.value = {
    formula: `SUM(${expenseLetter}${FIRST_DATA_ROW}:${expenseLetter}${lastRow})`,
    result: Math.round(total * 100) / 100,
  };
  totalCell.font = { name: 'Arial', size: 10 };
  totalCell.numFmt = '#,##0.00';
  fillCell(totalCell, HEADER_FILL);

  COLUMN_WIDTHS.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  worksheet.headerFooter.oddFooter = `&Rעמוד &P מתוך &N&Cאחזקת רכבים ${year}`;

  return workbook;
}

export async function exportYearEndWorkbook({ year, records }) {
  const workbook = await createYearEndWorkbook({ year, records });
  const bytes = await workbook.xlsx.writeBuffer();
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${year}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
