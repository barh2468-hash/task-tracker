const DEVICE_COLUMNS = [1, 2, 3, 4, 13, 14, 34];

function cleanWorksheetValue(value) {
  const text = String(value ?? '').trim();
  if (/^v$/i.test(text)) return 'קיים';
  if (text === '-') return '';
  return text;
}

function hasDevice(record) {
  return DEVICE_COLUMNS.some((index) => {
    const value = String(record.cells?.[index] ?? '').trim();
    return value && value !== '-' && !/^v$/i.test(value);
  });
}

function columnName(columnNumber) {
  let value = columnNumber;
  let name = '';
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function formatPeriod(period) {
  if (!period) return 'לא הוגדרה';
  const [year, month] = String(period).slice(0, 10).split('-');
  return month && year ? `${month}/${year}` : String(period);
}

function safeFileName(value) {
  return String(value || 'ריכוז ציוד עובדי שטח')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function createEquipmentWorkbook({ equipmentImport, records }) {
  const excelJsModule = await import('exceljs');
  const ExcelJS = excelJsModule.default || excelJsModule;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'מערכת איתור תשתיות';
  workbook.created = new Date();
  workbook.modified = new Date();

  const headers = equipmentImport?.display_headers || [];
  const exportHeaders = ['קבוצה', ...headers, 'פריטים מסומנים'];
  const lastColumn = columnName(exportHeaders.length);
  const worksheet = workbook.addWorksheet('ריכוז ציוד', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 4, rightToLeft: true, showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  worksheet.mergeCells(`A1:${lastColumn}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = equipmentImport?.title || 'ריכוז ציוד עובדי שטח';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'right', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF082D57' } };
  worksheet.getRow(1).height = 34;

  const summary = [
    'תקופת הריכוז',
    formatPeriod(equipmentImport?.source_period),
    'מספר עובדים',
    records.length,
    'עובדים עם מכשירים ומזהים',
    records.filter(hasDevice).length,
    'פריטי ציוד מסומנים',
    records.reduce((total, record) => total + (record.checked_item_count || 0), 0),
  ];
  worksheet.getRow(2).values = summary;
  worksheet.getRow(2).height = 25;
  worksheet.getRow(2).eachCell((cell, index) => {
    const isLabel = index % 2 === 1;
    cell.font = { name: 'Arial', size: 10, bold: isLabel, color: { argb: isLabel ? 'FF47657A' : 'FF082D57' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isLabel ? 'FFF1F6F9' : 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFD8E5EC' } } };
  });

  const sourceCell = worksheet.getCell('A3');
  sourceCell.value = `מקור: ${equipmentImport?.source_file_name || 'האפליקציה'}`;
  sourceCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF7A8E9D' } };
  sourceCell.alignment = { horizontal: 'right', vertical: 'middle' };
  worksheet.mergeCells(`A3:${lastColumn}3`);
  worksheet.getRow(3).height = 22;

  const headerRow = worksheet.getRow(4);
  headerRow.values = exportHeaders;
  headerRow.height = 31;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B668F' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      left: { style: 'thin', color: { argb: 'FF89B6C9' } },
      bottom: { style: 'medium', color: { argb: 'FF063A5B' } },
    };
  });

  records.forEach((record, recordIndex) => {
    const cells = Array.from({ length: headers.length }, (_, index) =>
      cleanWorksheetValue(record.cells?.[index]),
    );
    cells[0] = record.worker_name;
    const row = worksheet.addRow([
      record.section_name || 'ללא קבוצה',
      ...cells,
      record.checked_item_count || 0,
    ]);
    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell, columnIndex) => {
      const value = String(cell.value ?? '');
      const isMarked = value === 'קיים';
      const isGroup = columnIndex === 1;
      const isCount = columnIndex === exportHeaders.length;
      const banded = recordIndex % 2 === 1;
      cell.font = {
        name: 'Arial',
        size: 9,
        bold: isGroup || isCount || isMarked,
        color: { argb: isMarked ? 'FF08715F' : isGroup ? 'FF155A78' : 'FF1A3448' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isMarked ? 'FFE8F7F2' : isGroup ? 'FFEAF5F8' : banded ? 'FFF8FBFC' : 'FFFFFFFF' },
      };
      cell.alignment = {
        horizontal: isCount || isMarked ? 'center' : 'right',
        vertical: 'middle',
        wrapText: false,
      };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE1E9EE' } } };
      cell.numFmt = '@';
    });
    row.getCell(exportHeaders.length).numFmt = '0';
  });

  worksheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: Math.max(4, records.length + 4), column: exportHeaders.length },
  };
  worksheet.columns.forEach((column, index) => {
    const header = exportHeaders[index] || '';
    if (index === 0) column.width = 22;
    else if (index === 1) column.width = 22;
    else if (/הערות|נוספים/.test(header)) column.width = 31;
    else if (/מס"ד|אימות/.test(header)) column.width = 18;
    else if (index === exportHeaders.length - 1) column.width = 15;
    else column.width = 17;
  });
  worksheet.headerFooter.oddFooter = '&Rעמוד &P מתוך &N&Cריכוז ציוד עובדי שטח';

  return workbook;
}

export async function exportEquipmentWorkbook({ equipmentImport, records }) {
  const workbook = await createEquipmentWorkbook({ equipmentImport, records });
  const bytes = await workbook.xlsx.writeBuffer();
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const baseName = safeFileName(equipmentImport?.title);
  const periodToken = equipmentImport?.source_period
    ? formatPeriod(equipmentImport.source_period).replace('/', '-')
    : '';
  const periodSuffix = periodToken && !baseName.includes(periodToken) ? ` ${periodToken}` : '';
  link.href = url;
  link.download = `${baseName}${periodSuffix} - מעודכן.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
