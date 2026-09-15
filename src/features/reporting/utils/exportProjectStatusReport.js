import {
  compareProjectsByOrderNumber,
  getProjectOrderNumber,
} from '../../projects/utils/projectOrderNumber.js';

const COLORS = {
  navy: 'FF0B2B53',
  blue: 'FF155E8B',
  teal: 'FF008C99',
  orange: 'FFF47C42',
  ink: 'FF17324D',
  muted: 'FF64748B',
  white: 'FFFFFFFF',
  paleBlue: 'FFEAF4F8',
  paleTeal: 'FFE7F7F6',
  paleOrange: 'FFFFF1E8',
  paleYellow: 'FFFFF7DF',
  stripe: 'FFF7FAFC',
  border: 'FFD8E4EC',
  success: 'FF117A65',
  warning: 'FFB86B00',
};
const FONT = 'Arial';
let excelJsPromise;

function loadExcelJs() {
  excelJsPromise ||= import('exceljs').then((module) => module.default || module);
  return excelJsPromise;
}

function fill(color) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

function borderBottom(color = COLORS.border, style = 'thin') {
  return { bottom: { style, color: { argb: color } } };
}

function styleRowRange(sheet, rowNumber, lastColumn, style) {
  const lastColumnNumber = sheet.getCell(`${lastColumn}${rowNumber}`).col;
  for (let columnNumber = 1; columnNumber <= lastColumnNumber; columnNumber += 1) {
    const cell = sheet.getCell(rowNumber, columnNumber);
    if (style.fill) cell.fill = style.fill;
    if (style.font) cell.font = style.font;
    if (style.border) cell.border = style.border;
  }
}

function excelDate(value) {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function styleHeader(row) {
  row.height = 30;
  row.eachCell((cell) => {
    cell.fill = fill(COLORS.navy);
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: COLORS.white } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      left: { style: 'thin', color: { argb: '55FFFFFF' } },
      bottom: { style: 'medium', color: { argb: COLORS.orange } },
    };
  });
}

function statusStyle(status) {
  if (status === 'הושלם') return { fill: COLORS.paleTeal, font: COLORS.success };
  if (status === 'בעבודה בשטח') return { fill: COLORS.paleOrange, font: COLORS.warning };
  if (status === 'מחכה להיתרים') return { fill: COLORS.paleYellow, font: COLORS.warning };
  return { fill: COLORS.paleBlue, font: COLORS.blue };
}

function styleProjectRows(sheet, startRow, endRow) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = 36;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = { name: FONT, size: 10, color: { argb: COLORS.ink } };
      cell.alignment = {
        horizontal: [2, 5, 6].includes(columnNumber) ? 'right' : 'center',
        vertical: 'middle',
        wrapText: [2, 4, 5, 6].includes(columnNumber),
      };
      cell.border = borderBottom();
      if (rowNumber % 2 === 0) cell.fill = fill(COLORS.stripe);
    });
  }
}

function safeFilePart(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function createProjectStatusWorkbook(
  projects,
  { generatedAt = new Date(), filterDescription = 'כל הפרויקטים' } = {},
) {
  const ExcelJS = await loadExcelJs();
  const sortedProjects = [...projects].sort(compareProjectsByOrderNumber);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'מערכת איתור תשתיות';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;

  const sheet = workbook.addWorksheet('מצב פרויקטים', {
    properties: { tabColor: { argb: COLORS.navy } },
    views: [{ state: 'frozen', xSplit: 2, ySplit: 10, rightToLeft: true, showGridLines: false }],
  });
  sheet.properties.defaultRowHeight = 20;
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    printTitlesRow: '1:10',
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  [16, 42, 22, 24, 28, 28, 14, 18, 16].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  sheet.getCell('A2').value = 'תמונת מצב של כל הפרויקטים';
  sheet.getCell('A2').font = { name: FONT, size: 16, bold: true, color: { argb: COLORS.navy } };
  sheet.getCell('A2').alignment = { horizontal: 'right', vertical: 'middle' };
  sheet.getRow(2).height = 27;
  sheet.getCell('A3').value = `${filterDescription} · הופק בתאריך ${generatedAt.toLocaleString('he-IL')}`;
  sheet.mergeCells('A3:D3');
  sheet.getCell('A3').font = { name: FONT, size: 10, italic: true, color: { argb: COLORS.muted } };
  sheet.getCell('A3').alignment = { horizontal: 'right', vertical: 'middle' };
  styleRowRange(sheet, 3, 'I', { border: borderBottom(COLORS.teal, 'medium') });
  sheet.getRow(3).height = 22;

  const assignedCount = sortedProjects.filter((project) => project.assigned_to).length;
  const completedCount = sortedProjects.filter((project) => project.status === 'הושלם').length;
  const archivedCount = sortedProjects.filter((project) => project.is_archived).length;
  sheet.getRow(5).values = ['פרויקטים בדוח', 'עם עובד אחראי', 'פרויקטים שהושלמו', 'בארכיון'];
  sheet.getRow(6).values = [sortedProjects.length, assignedCount, completedCount, archivedCount];
  sheet.getRow(5).height = 28;
  sheet.getRow(6).height = 34;
  sheet.getRow(5).eachCell((cell, index) => {
    cell.fill = fill(index % 2 ? COLORS.navy : COLORS.blue);
    cell.font = { name: FONT, size: 9, bold: true, color: { argb: COLORS.white } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  sheet.getRow(6).eachCell((cell, index) => {
    cell.fill = fill(index === 4 && archivedCount ? COLORS.paleOrange : COLORS.paleBlue);
    cell.font = {
      name: FONT,
      size: 14,
      bold: true,
      color: { argb: index === 4 && archivedCount ? COLORS.warning : COLORS.navy },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderBottom(index % 2 ? COLORS.teal : COLORS.blue, 'medium');
    cell.numFmt = '#,##0';
  });

  sheet.getCell('A8').value = 'פירוט פרויקטים';
  sheet.getCell('A8').font = { name: FONT, size: 13, bold: true, color: { argb: COLORS.navy } };
  sheet.getRow(10).values = [
    'מספר הזמנה',
    'שם הפרויקט',
    'סטטוס נוכחי',
    'עובד שטח אחראי',
    'לקוח',
    'מיקום',
    'התקדמות',
    'עדכון אחרון',
    'מצב ארכיון',
  ];
  styleHeader(sheet.getRow(10));
  sheet.autoFilter = 'A10:I10';

  sortedProjects.forEach((project, index) => {
    const progress = Number(project.progress);
    const row = sheet.getRow(index + 11);
    row.values = [
      getProjectOrderNumber(project) || '-',
      project.name,
      project.status || '-',
      project.profiles?.full_name || 'לא משויך',
      project.client_name || '-',
      project.location || '-',
      Number.isFinite(progress) ? progress / 100 : null,
      excelDate(project.updated_at),
      project.is_archived ? 'בארכיון' : 'פעיל',
    ];
    row.getCell(1).numFmt = '@';
    row.getCell(7).numFmt = '0%';
    row.getCell(8).numFmt = 'dd/mm/yyyy';
  });

  if (sortedProjects.length) {
    styleProjectRows(sheet, 11, sortedProjects.length + 10);
    sortedProjects.forEach((project, index) => {
      const row = sheet.getRow(index + 11);
      const projectStatusStyle = statusStyle(project.status);
      row.getCell(3).fill = fill(projectStatusStyle.fill);
      row.getCell(3).font = {
        name: FONT,
        size: 10,
        bold: true,
        color: { argb: projectStatusStyle.font },
      };
      row.getCell(9).font = {
        name: FONT,
        size: 10,
        bold: true,
        color: { argb: project.is_archived ? COLORS.muted : COLORS.success },
      };
    });
  } else {
    sheet.getCell('A11').value = 'לא נמצאו פרויקטים לפי הסינון שנבחר';
    sheet.getCell('A11').font = { name: FONT, size: 10, italic: true, color: { argb: COLORS.muted } };
  }

  sheet.headerFooter.oddFooter = '&Rעמוד &P מתוך &N&Lמערכת איתור תשתיות';
  return workbook;
}

export async function exportProjectStatusExcel(projects, options = {}) {
  const { setMessage, filterDescription } = options;
  if (!projects.length) {
    setMessage?.('אין פרויקטים לייצוא לפי הסינון שנבחר.');
    return;
  }
  try {
    const generatedAt = new Date();
    const workbook = await createProjectStatusWorkbook(projects, {
      generatedAt,
      filterDescription,
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `דוח-מצב-פרויקטים-${safeFilePart(generatedAt.toISOString().slice(0, 10))}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage?.('קובץ Excel מעוצב יוצא בהצלחה.');
  } catch (error) {
    console.error('Failed to export project status workbook', error);
    setMessage?.('לא ניתן היה לייצא את קובץ ה-Excel. נסו שוב.');
  }
}
