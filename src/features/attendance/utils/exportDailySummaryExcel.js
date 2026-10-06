import { attendanceTypeLabel } from '../constants.js';
import { durationMinutes, toLocalDateKey } from '../../../utils/format.js';

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
  stripe: 'FFF7FAFC',
  border: 'FFD8E4EC',
  success: 'FF117A65',
  danger: 'FFB42318',
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

function bottomBorder(color = COLORS.border, style = 'thin') {
  return { bottom: { style, color: { argb: color } } };
}

function localDateLabel(dateKey) {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

function safeFilePart(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
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

function configureSheet(sheet, widths, frozenRows = 5, frozenColumns = 1) {
  sheet.views = [
    {
      state: 'frozen',
      xSplit: frozenColumns,
      ySplit: frozenRows,
      rightToLeft: true,
      showGridLines: false,
    },
  ];
  sheet.properties.defaultRowHeight = 20;
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    printTitlesRow: `1:${frozenRows}`,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.headerFooter.oddFooter = '&Rעמוד &P מתוך &N&Lמערכת איתור תשתיות';
}

function addHeading(sheet, title, context, lastColumn) {
  sheet.getCell('A2').value = title;
  sheet.getCell('A2').font = {
    name: FONT,
    size: 16,
    bold: true,
    color: { argb: COLORS.navy },
  };
  sheet.getCell('A2').alignment = { horizontal: 'right', vertical: 'middle' };
  sheet.getRow(2).height = 27;
  sheet.getCell('A3').value = context;
  sheet.mergeCells('A3:C3');
  sheet.getCell('A3').font = {
    name: FONT,
    size: 10,
    italic: true,
    color: { argb: COLORS.muted },
  };
  sheet.getCell('A3').alignment = { horizontal: 'right', vertical: 'middle' };
  styleRowRange(sheet, 3, lastColumn, { border: bottomBorder(COLORS.teal, 'medium') });
}

function styleHeader(row) {
  row.height = 31;
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

function styleBodyRows(sheet, startRow, endRow, wrappedColumns = []) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = wrappedColumns.length ? 34 : 26;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = { name: FONT, size: 10, color: { argb: COLORS.ink } };
      cell.alignment = {
        horizontal: columnNumber === 1 ? 'right' : 'center',
        vertical: 'middle',
        wrapText: wrappedColumns.includes(columnNumber),
      };
      cell.border = bottomBorder();
      if (rowNumber % 2 === 1) cell.fill = fill(COLORS.stripe);
    });
  }
}

function setEmptyState(sheet, rowNumber, message) {
  const cell = sheet.getCell(`A${rowNumber}`);
  cell.value = message;
  cell.font = { name: FONT, size: 10, italic: true, color: { argb: COLORS.muted } };
}

function dailyHistory(historyItems, dateKey) {
  return historyItems
    .filter((item) => item.created_at && toLocalDateKey(new Date(item.created_at)) === dateKey)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function addSummarySheet(workbook, data, context) {
  const sheet = workbook.addWorksheet('סיכום יומי', {
    properties: { tabColor: { argb: COLORS.navy } },
  });
  configureSheet(sheet, [25, 34, 20, 20, 20, 20], 10, 1);
  addHeading(sheet, 'סיכום יומי – היום בשטח', context, 'F');

  const attendanceHours = data.todayAttendance.reduce(
    (sum, item) => sum + (item.is_all_day ? 0 : durationMinutes(item.started_at, item.ended_at) / 60),
    0,
  );
  const projectHours = data.todaySessions.reduce(
    (sum, item) => sum + durationMinutes(item.started_at, item.ended_at) / 60,
    0,
  );
  const statusChanges = dailyHistory(data.historyItems, data.dateKey);
  const metrics = [
    ['דיווחי נוכחות', data.todayAttendance.length],
    ['רישומי פרויקט', data.todaySessions.length],
    ['שינויי סטטוס', statusChanges.length],
    ['טרם התחילו', data.notStarted.length],
    ['שעות נוכחות', attendanceHours],
    ['שעות בפרויקטים', projectHours],
  ];
  sheet.getRow(5).values = metrics.map(([label]) => label);
  sheet.getRow(6).values = metrics.map(([, value]) => value);
  sheet.getRow(5).height = 29;
  sheet.getRow(6).height = 36;
  sheet.getRow(5).eachCell((cell, index) => {
    cell.fill = fill(index % 2 ? COLORS.navy : COLORS.blue);
    cell.font = { name: FONT, size: 9, bold: true, color: { argb: COLORS.white } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  sheet.getRow(6).eachCell((cell, index) => {
    const isWarning = index === 4 && data.notStarted.length > 0;
    cell.fill = fill(isWarning ? COLORS.paleOrange : COLORS.paleBlue);
    cell.font = {
      name: FONT,
      size: 14,
      bold: true,
      color: { argb: isWarning ? COLORS.danger : COLORS.navy },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = bottomBorder(index % 2 ? COLORS.teal : COLORS.blue, 'medium');
  });
  sheet.getCell('E6').numFmt = '0.00';
  sheet.getCell('F6').numFmt = '0.00';

  sheet.getCell('A8').value = 'עובדי שטח שטרם התחילו היום';
  sheet.getCell('A8').font = { name: FONT, size: 13, bold: true, color: { argb: COLORS.navy } };
  sheet.getRow(10).values = ['עובד', 'אימייל'];
  styleHeader(sheet.getRow(10));
  sheet.autoFilter = 'A10:B10';
  data.notStarted.forEach((worker, index) => {
    sheet.getRow(index + 11).values = [worker.full_name || 'עובד', worker.email || ''];
  });
  if (data.notStarted.length) styleBodyRows(sheet, 11, data.notStarted.length + 10);
  else setEmptyState(sheet, 11, 'כל עובדי השטח התחילו או שאין עובדים להצגה.');
}

function addAttendanceSheet(workbook, attendance, context) {
  const sheet = workbook.addWorksheet('נוכחות כללית', {
    properties: { tabColor: { argb: COLORS.teal } },
  });
  configureSheet(sheet, [24, 30, 22, 18, 15, 15, 16, 18, 32], 5, 2);
  addHeading(sheet, 'נוכחות כללית היום', context, 'I');
  sheet.getRow(5).values = [
    'עובד',
    'אימייל',
    'סוג דיווח',
    'תאריך',
    'כניסה',
    'יציאה',
    'משך (שעות)',
    'סטטוס',
    'הערה',
  ];
  styleHeader(sheet.getRow(5));
  sheet.autoFilter = 'A5:I5';
  attendance.forEach((item, index) => {
    const row = sheet.getRow(index + 6);
    const duration = item.is_all_day ? null : durationMinutes(item.started_at, item.ended_at) / 60;
    row.values = [
      item.profiles?.full_name || 'עובד',
      item.profiles?.email || '',
      attendanceTypeLabel[item.attendance_type] || 'נוכחות כללית',
      item.attendance_date ? new Date(`${item.attendance_date}T12:00:00`) : new Date(item.started_at),
      item.is_all_day ? null : new Date(item.started_at),
      item.is_all_day || !item.ended_at ? null : new Date(item.ended_at),
      duration,
      item.is_all_day ? 'יום מלא' : item.ended_at ? 'הושלם' : 'פתוח',
      item.end_note || '',
    ];
    row.getCell(4).numFmt = 'dd/mm/yyyy';
    row.getCell(5).numFmt = 'hh:mm';
    row.getCell(6).numFmt = 'hh:mm';
    row.getCell(7).numFmt = '0.00';
  });
  if (attendance.length) {
    styleBodyRows(sheet, 6, attendance.length + 5, [9]);
    attendance.forEach((item, index) => {
      const statusCell = sheet.getRow(index + 6).getCell(8);
      const open = !item.is_all_day && !item.ended_at;
      statusCell.font = {
        name: FONT,
        size: 10,
        bold: true,
        color: { argb: open ? COLORS.danger : COLORS.success },
      };
    });
    const totalRow = attendance.length + 7;
    const totalHours = attendance.reduce(
      (sum, item) => sum + (item.is_all_day ? 0 : durationMinutes(item.started_at, item.ended_at) / 60),
      0,
    );
    sheet.getCell(`A${totalRow}`).value = 'סה״כ שעות';
    sheet.getCell(`G${totalRow}`).value = {
      formula: `SUM(G6:G${attendance.length + 5})`,
      result: totalHours,
    };
    sheet.getCell(`G${totalRow}`).numFmt = '0.00';
    styleRowRange(sheet, totalRow, 'I', {
      fill: fill(COLORS.paleTeal),
      font: { name: FONT, size: 10, bold: true, color: { argb: COLORS.navy } },
      border: bottomBorder(COLORS.teal, 'medium'),
    });
  } else setEmptyState(sheet, 6, 'לא נרשמה נוכחות כללית היום.');
}

function addProjectSessionsSheet(workbook, sessions, context) {
  const sheet = workbook.addWorksheet('עבודה בפרויקטים', {
    properties: { tabColor: { argb: COLORS.orange } },
  });
  configureSheet(sheet, [24, 30, 34, 28, 26, 15, 15, 16, 18, 30], 5, 3);
  addHeading(sheet, 'שעות עבודה לפי פרויקט', context, 'J');
  sheet.getRow(5).values = [
    'עובד',
    'אימייל',
    'פרויקט',
    'לקוח',
    'מיקום',
    'התחלה',
    'סיום',
    'משך (שעות)',
    'צוות נוסף',
    'הערת סיום',
  ];
  styleHeader(sheet.getRow(5));
  sheet.autoFilter = 'A5:J5';
  sessions.forEach((item, index) => {
    const row = sheet.getRow(index + 6);
    row.values = [
      item.profiles?.full_name || 'עובד',
      item.profiles?.email || '',
      item.projects?.name || 'פרויקט',
      item.projects?.client_name || '',
      item.projects?.location || '',
      new Date(item.started_at),
      item.ended_at ? new Date(item.ended_at) : null,
      durationMinutes(item.started_at, item.ended_at) / 60,
      (item.crew_members || []).map((member) => member.name).filter(Boolean).join(', '),
      item.end_note || '',
    ];
    row.getCell(6).numFmt = 'dd/mm/yyyy hh:mm';
    row.getCell(7).numFmt = 'dd/mm/yyyy hh:mm';
    row.getCell(8).numFmt = '0.00';
  });
  if (sessions.length) {
    styleBodyRows(sheet, 6, sessions.length + 5, [3, 4, 5, 9, 10]);
    const totalRow = sessions.length + 7;
    const totalHours = sessions.reduce(
      (sum, item) => sum + durationMinutes(item.started_at, item.ended_at) / 60,
      0,
    );
    sheet.getCell(`A${totalRow}`).value = 'סה״כ שעות';
    sheet.getCell(`H${totalRow}`).value = {
      formula: `SUM(H6:H${sessions.length + 5})`,
      result: totalHours,
    };
    sheet.getCell(`H${totalRow}`).numFmt = '0.00';
    styleRowRange(sheet, totalRow, 'J', {
      fill: fill(COLORS.paleTeal),
      font: { name: FONT, size: 10, bold: true, color: { argb: COLORS.navy } },
      border: bottomBorder(COLORS.teal, 'medium'),
    });
  } else setEmptyState(sheet, 6, 'לא נרשמו שעות עבודה בפרויקטים היום.');
}

function addStatusSheet(workbook, historyItems, projects, dateKey, context) {
  const history = dailyHistory(historyItems, dateKey);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const sheet = workbook.addWorksheet('שינויי סטטוס', {
    properties: { tabColor: { argb: COLORS.blue } },
  });
  configureSheet(sheet, [34, 27, 27, 24, 20, 42], 5, 2);
  addHeading(sheet, 'עדכונים ושינויי סטטוס', context, 'F');
  sheet.getRow(5).values = [
    'פרויקט',
    'סטטוס קודם',
    'סטטוס חדש',
    'עודכן על ידי',
    'מועד',
    'הערה',
  ];
  styleHeader(sheet.getRow(5));
  sheet.autoFilter = 'A5:F5';
  history.forEach((item, index) => {
    const project = item.projects || projectById.get(item.project_id);
    const row = sheet.getRow(index + 6);
    row.values = [
      project?.name || 'פרויקט',
      item.old_status || '',
      item.new_status || '',
      item.profiles?.full_name || 'משתמש',
      new Date(item.created_at),
      item.note || '',
    ];
    row.getCell(5).numFmt = 'dd/mm/yyyy hh:mm';
  });
  if (history.length) styleBodyRows(sheet, 6, history.length + 5, [1, 2, 3, 6]);
  else setEmptyState(sheet, 6, 'לא נרשמו שינויי סטטוס היום.');
}

export async function createDailySummaryWorkbook({
  todaySessions,
  todayAttendance,
  notStarted,
  historyItems,
  projects,
  dateKey = toLocalDateKey(),
  generatedAt = new Date(),
}) {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'מערכת איתור תשתיות';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;
  const context = `תאריך ${localDateLabel(dateKey)} · הופק ${generatedAt.toLocaleString('he-IL')}`;
  const data = { todaySessions, todayAttendance, notStarted, historyItems, projects, dateKey };
  addSummarySheet(workbook, data, context);
  addAttendanceSheet(workbook, todayAttendance, context);
  addProjectSessionsSheet(workbook, todaySessions, context);
  addStatusSheet(workbook, historyItems, projects, dateKey, context);
  return workbook;
}

export async function exportDailySummaryExcel(data, setMessage) {
  try {
    const dateKey = data.dateKey || toLocalDateKey();
    const workbook = await createDailySummaryWorkbook({ ...data, dateKey });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `סיכום-יומי-${safeFilePart(dateKey)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage?.('קובץ Excel מעוצב של הסיכום היומי יוצא בהצלחה.');
    return true;
  } catch (error) {
    console.error('Failed to export daily summary workbook', error);
    setMessage?.('ייצוא הסיכום היומי ל-Excel נכשל. נסו שוב.');
    return false;
  }
}
