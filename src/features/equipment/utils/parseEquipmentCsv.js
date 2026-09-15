const DEFAULT_COLUMN_LABELS = [
  'שם העובד',
  'דגם מכשיר 1',
  'מספר סידורי 1',
  'דגם מכשיר 2',
  'מספר סידורי 2',
  'פריט ציוד 01',
  'פריט ציוד 02',
  'פריט ציוד 03',
  'פריט ציוד 04',
  'פריט ציוד 05',
  'פריט ציוד 06',
  'פריט ציוד 07',
  'פריט ציוד 08',
  'מזהה ציוד 1',
  'מזהה ציוד 2',
  'פריט ציוד 09',
  'פריט ציוד 10',
  'פריט ציוד 11',
  'פריט ציוד 12',
  'פריט ציוד 13',
  'פריט ציוד 14',
  'פריט ציוד 15',
  'פריט ציוד 16',
  'פריט ציוד 17',
  'פריט ציוד 18',
  'פריט ציוד 19',
  'פריט ציוד 20',
  'פריט ציוד 21',
  'פריט ציוד 22',
  'פריט ציוד 23',
  'פריט ציוד 24',
  'פריט ציוד 25',
  'פריט ציוד 26',
  'פריט ציוד 27',
  'מחשב / ציוד נוסף',
  'הערות',
  'עדכון תקופתי',
];

function cleanCell(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

export function isUnreadableEquipmentText(value) {
  const text = cleanCell(value);
  if (!text.includes('?')) return false;
  const compact = text.replace(/\s/g, '');
  const questionMarks = (compact.match(/\?/g) || []).length;
  return questionMarks / compact.length >= 0.35;
}

export function parseCsvRows(csvText) {
  const text = String(csvText ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cleanCell(value));
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cleanCell(value));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  row.push(cleanCell(value));
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function uniqueHeaders(headers) {
  const used = new Map();
  return headers.map((header, index) => {
    const base = header || DEFAULT_COLUMN_LABELS[index] || `עמודה ${index + 1}`;
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

function normalizeRow(row, columnCount) {
  return Array.from({ length: columnCount }, (_, index) => cleanCell(row[index]));
}

function extractPeriod(fileName) {
  const match = String(fileName || '').match(/(?:^|\D)(0?[1-9]|1[0-2])[-_.](20\d{2})(?:\D|$)/);
  if (!match) return null;
  return `${match[2]}-${String(match[1]).padStart(2, '0')}-01`;
}

export function parseEquipmentRows(rows, fileName = '') {
  if (rows.length < 2) throw new Error('הקובץ אינו מכיל רשומות ציוד.');

  const gprTableStart = rows.findIndex(
    (row, index) => index > 0 && /^\s*מחלקת\s+GPR\s*$/i.test(cleanCell(row[0])),
  );
  const workerRows = gprTableStart >= 0 ? rows.slice(0, gprTableStart) : rows;

  const columnCount = Math.max(...workerRows.map((row) => row.length));
  const rawHeaders = normalizeRow(workerRows[0], columnCount);
  const unreadableHeaders = rawHeaders.filter(
    (header) => header && isUnreadableEquipmentText(header),
  ).length;
  const nonEmptyHeaders = rawHeaders.filter(Boolean).length;
  const encodingWarning = nonEmptyHeaders > 0 && unreadableHeaders / nonEmptyHeaders >= 0.35;
  const displayHeaders = uniqueHeaders(
    rawHeaders.map((header, index) =>
      !header || isUnreadableEquipmentText(header)
        ? DEFAULT_COLUMN_LABELS[index] || `עמודה ${index + 1}`
        : header,
    ),
  );

  const records = [];
  let sourceSection = '';
  let sectionNumber = 0;
  let displaySection = 'ללא קבוצה';

  workerRows.slice(1).forEach((sourceRow, sourceIndex) => {
    const cells = normalizeRow(sourceRow, columnCount);
    const populated = cells.filter(Boolean);
    if (!populated.length) return;

    if (populated.length === 1 && cells[0]) {
      sourceSection = cells[0];
      sectionNumber += 1;
      const readableSection = sourceSection.replace(/[?\s'"]+/g, ' ').trim();
      displaySection = isUnreadableEquipmentText(sourceSection)
        ? `קבוצה ${sectionNumber}${readableSection ? ` · ${readableSection}` : ''}`
        : sourceSection;
      return;
    }

    const rawWorkerName = cells[0];
    if (!rawWorkerName) return;

    const sourceNameUnreadable = !rawWorkerName || isUnreadableEquipmentText(rawWorkerName);
    const workerNumber = records.length + 1;
    const workerName = sourceNameUnreadable ? `עובד ${workerNumber}` : rawWorkerName;
    const checkedItemCount = cells.slice(5, 34).filter((cell) => /^v$/i.test(cell)).length;

    records.push({
      source_row_number: sourceIndex + 2,
      worker_name: workerName,
      source_name_unreadable: sourceNameUnreadable,
      section_name: displaySection,
      source_section: sourceSection,
      checked_item_count: checkedItemCount,
      cells,
    });
  });

  if (!records.length) throw new Error('לא נמצאו שורות עובדים בקובץ.');

  return {
    title: fileName.replace(/\.(csv|xlsx)$/i, '') || 'ריכוז ציוד עובדי שטח',
    sourceFileName: fileName || 'equipment.xlsx',
    sourcePeriod: extractPeriod(fileName),
    rawHeaders,
    displayHeaders,
    encodingWarning,
    records,
  };
}

export function parseEquipmentCsv(csvText, fileName = '') {
  return parseEquipmentRows(parseCsvRows(csvText), fileName);
}

async function readEquipmentCsvFile(file) {
  const bytes = await file.arrayBuffer();
  const utf8Text = new TextDecoder('utf-8').decode(bytes);
  const replacementCount = (utf8Text.match(/\uFFFD/g) || []).length;
  const hebrewCount = (utf8Text.match(/[\u0590-\u05FF]/g) || []).length;

  if (replacementCount > 0 && hebrewCount === 0) {
    try {
      return new TextDecoder('windows-1255').decode(bytes);
    } catch {
      return utf8Text;
    }
  }
  return utf8Text;
}

function readWorkbookCell(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
  if (value.result !== undefined && value.result !== null) return readWorkbookCell(value.result);
  if (value.text !== undefined && value.text !== null) return value.text;
  if (value.hyperlink) return value.hyperlink;
  return '';
}

function findEquipmentWorksheet(workbook) {
  const namedSheet = workbook.getWorksheet('עובדים 2025');
  if (namedSheet) return namedSheet;

  return workbook.worksheets.find((worksheet) => {
    const firstRow = worksheet.getRow(1).values.slice(1).map(readWorkbookCell).map(cleanCell);
    return firstRow.includes('שם') && firstRow.includes('משדר') && firstRow.length >= 10;
  });
}

async function parseEquipmentWorkbook(file) {
  const excelJsModule = await import('exceljs');
  const ExcelJS = excelJsModule.default || excelJsModule;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = findEquipmentWorksheet(workbook);
  if (!worksheet) throw new Error('לא נמצא גיליון ציוד עובדים בקובץ ה־Excel.');

  const rows = Array.from({ length: worksheet.rowCount }, (_, rowIndex) =>
    Array.from({ length: worksheet.columnCount }, (_, columnIndex) =>
      readWorkbookCell(worksheet.getCell(rowIndex + 1, columnIndex + 1).value),
    ),
  );
  return parseEquipmentRows(rows, file.name);
}

export async function parseEquipmentFile(file) {
  if (/\.xlsx$/i.test(file.name)) return parseEquipmentWorkbook(file);
  if (/\.csv$/i.test(file.name)) {
    return parseEquipmentCsv(await readEquipmentCsvFile(file), file.name);
  }
  throw new Error('יש לבחור קובץ Excel או CSV.');
}
