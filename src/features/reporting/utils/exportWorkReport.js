import { durationMinutes, mapsLink, sessionStartedInRange } from '../../../utils/format.js';
import { attendanceTypeLabel } from '../../attendance/constants.js';
import { buildWorkReportRows } from './buildWorkReportRows.js';

const COLORS = {
  navy: 'FF0B2B53', blue: 'FF155E8B', teal: 'FF008C99', orange: 'FFF47C42',
  ink: 'FF17324D', muted: 'FF64748B', white: 'FFFFFFFF', paleBlue: 'FFEAF4F8',
  paleTeal: 'FFE7F7F6', paleOrange: 'FFFFF1E8', stripe: 'FFF7FAFC',
  border: 'FFD8E4EC', success: 'FF117A65', danger: 'FFB42318',
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

function shortDate(value) {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function shortTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function safeFilePart(value) {
  return String(value || '').trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-');
}

function locationCountLabel(count) {
  return count === 1 ? 'מיקום אחד' : `${count} מיקומים`;
}

function addSheetHeading(sheet, title, context, lastColumn) {
  sheet.getCell('A2').value = title;
  sheet.getCell('A2').font = { name: FONT, size: 16, bold: true, color: { argb: COLORS.navy } };
  sheet.getCell('A2').alignment = { horizontal: 'right', vertical: 'middle' };
  sheet.getRow(2).height = 27;
  sheet.getCell('A3').value = context;
  sheet.mergeCells('A3:C3');
  sheet.getCell('A3').font = { name: FONT, size: 10, italic: true, color: { argb: COLORS.muted } };
  sheet.getCell('A3').alignment = { horizontal: 'right', vertical: 'middle' };
  styleRowRange(sheet, 3, lastColumn, { border: borderBottom(COLORS.teal, 'medium') });
  sheet.getRow(3).height = 22;
}

function configureSheet(sheet, widths, frozenRows = 5, frozenColumns = 2) {
  sheet.views = [{
    state: 'frozen', xSplit: frozenColumns, ySplit: frozenRows,
    rightToLeft: true, showGridLines: false,
  }];
  sheet.properties.defaultRowHeight = 20;
  sheet.pageSetup = {
    orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
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

function styleBodyRows(sheet, startRow, endRow, wrappedColumns = []) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = 26;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = { name: FONT, size: 10, color: { argb: COLORS.ink } };
      cell.alignment = {
        horizontal: columnNumber === 1 ? 'right' : 'center',
        vertical: 'middle', wrapText: wrappedColumns.includes(columnNumber),
      };
      cell.border = borderBottom();
      if (rowNumber % 2 === 1) cell.fill = fill(COLORS.stripe);
    });
  }
}

function styleHyperlink(cell, color = COLORS.blue) {
  cell.font = { name: FONT, size: 10, color: { argb: color }, underline: true };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

function createMapEntries(filteredAttendance, filteredSessions) {
  const entries = [];
  const seen = new Set();
  const add = (entry) => {
    const key = `${entry.groupKey}_${entry.kind}_${entry.url}`;
    if (!entry.url || seen.has(key)) return;
    seen.add(key);
    entries.push(entry);
  };
  filteredAttendance.forEach((item) => {
    if (item.is_all_day) return;
    const base = {
      groupKey: `attendance_${item.id}`,
      worker: item.profiles?.full_name || 'עובד',
      date: item.attendance_date || item.started_at.slice(0, 10),
      source: 'נוכחות כללית',
      assignment: attendanceTypeLabel[item.attendance_type] || 'נוכחות כללית',
    };
    add({ ...base, kind: 'כניסה', url: mapsLink(item.started_lat, item.started_lng) });
    add({ ...base, kind: 'יציאה', url: mapsLink(item.ended_lat, item.ended_lng) });
  });
  filteredSessions.forEach((item) => {
    const base = {
      worker: item.profiles?.full_name || 'עובד',
      date: item.started_at.slice(0, 10), source: 'שעות פרויקט',
      assignment: item.projects?.name || 'פרויקט',
    };
    add({ ...base, groupKey: `${item.worker_id}_${item.project_id}_start`, kind: 'כניסה', url: mapsLink(item.started_lat, item.started_lng) });
    add({ ...base, groupKey: `${item.worker_id}_${item.project_id}_end`, kind: 'יציאה', url: mapsLink(item.ended_lat, item.ended_lng) });
  });
  return entries;
}

function firstMapRows(entries) {
  const firstRowByGroup = new Map();
  entries.forEach((entry, index) => {
    if (!firstRowByGroup.has(entry.groupKey)) firstRowByGroup.set(entry.groupKey, index + 6);
  });
  return firstRowByGroup;
}

function addMapSheet(workbook, entries, context) {
  const sheet = workbook.addWorksheet('קישורי מפה', {
    properties: { tabColor: { argb: COLORS.blue } },
  });
  configureSheet(sheet, [23, 15, 18, 26, 13, 20], 5, 2);
  addSheetHeading(sheet, 'קישורי מיקום', context, 'F');
  sheet.getRow(5).values = ['עובד', 'תאריך', 'מקור דיווח', 'פרויקט / סוג דיווח', 'סוג מיקום', 'קישור'];
  styleHeader(sheet.getRow(5));
  sheet.autoFilter = 'A5:F5';
  entries.forEach((entry, index) => {
    const rowNumber = index + 6;
    const row = sheet.getRow(rowNumber);
    row.values = [entry.worker, excelDate(entry.date), entry.source, entry.assignment, entry.kind,
      { text: 'פתיחה במפה', hyperlink: entry.url, tooltip: 'פתיחת המיקום במפה' }];
    row.getCell(2).numFmt = 'dd/mm/yyyy';
  });
  if (entries.length) {
    styleBodyRows(sheet, 6, entries.length + 5, [4]);
    entries.forEach((_, index) => styleHyperlink(sheet.getRow(index + 6).getCell(6)));
  } else {
    sheet.getCell('A6').value = 'אין קישורי מיקום בדוח זה';
    sheet.getCell('A6').font = { name: FONT, italic: true, color: { argb: COLORS.muted } };
  }
}

function addAttendanceSheet(workbook, attendance, context) {
  const sheet = workbook.addWorksheet('נוכחות כללית', {
    properties: { tabColor: { argb: COLORS.teal } },
  });
  configureSheet(sheet, [23, 30, 14, 20, 11, 11, 14, 15, 18, 18, 25, 30], 5, 2);
  addSheetHeading(sheet, 'נוכחות כללית', context, 'L');
  sheet.getRow(5).values = ['עובד', 'אימייל', 'תאריך', 'סוג דיווח', 'כניסה', 'יציאה', 'משך (שעות)', 'סטטוס', 'מיקום כניסה', 'מיקום יציאה', 'אישור מחלה', 'הערה'];
  styleHeader(sheet.getRow(5));
  sheet.autoFilter = 'A5:L5';
  attendance.forEach((item, index) => {
    const minutes = item.is_all_day ? null : durationMinutes(item.started_at, item.ended_at);
    const status = item.is_all_day ? 'יום מלא' : item.ended_at ? 'הושלם' : 'פתוח';
    const startLink = mapsLink(item.started_lat, item.started_lng);
    const endLink = mapsLink(item.ended_lat, item.ended_lng);
    const row = sheet.getRow(index + 6);
    row.values = [
      item.profiles?.full_name || 'עובד', item.profiles?.email || '',
      excelDate(item.attendance_date || item.started_at.slice(0, 10)),
      attendanceTypeLabel[item.attendance_type] || 'נוכחות כללית',
      item.is_all_day ? '-' : shortTime(item.started_at),
      item.is_all_day ? '-' : item.ended_at ? shortTime(item.ended_at) : 'פתוח',
      minutes === null ? null : minutes / 60, status,
      item.is_all_day || !startLink ? '-' : { text: 'פתיחה במפה', hyperlink: startLink },
      item.is_all_day || !endLink ? '-' : { text: 'פתיחה במפה', hyperlink: endLink },
      item.attendance_type === 'sick'
        ? item.sick_certificate?.file_path
          ? item.sick_certificate.original_name || 'צורף אישור'
          : 'לא צורף'
        : '-',
      item.end_note || '-',
    ];
    row.getCell(3).numFmt = 'dd/mm/yyyy';
    row.getCell(7).numFmt = '0.00';
  });
  if (attendance.length) {
    styleBodyRows(sheet, 6, attendance.length + 5, [11, 12]);
    attendance.forEach((item, index) => {
      const row = sheet.getRow(index + 6);
      if (typeof row.getCell(9).value === 'object') styleHyperlink(row.getCell(9));
      if (typeof row.getCell(10).value === 'object') styleHyperlink(row.getCell(10));
      const isOpen = !item.is_all_day && !item.ended_at;
      row.getCell(8).font = { name: FONT, size: 10, bold: true, color: { argb: isOpen ? COLORS.danger : COLORS.success } };
    });
    const totalRow = attendance.length + 7;
    const totalHours = attendance.reduce((sum, item) => sum + (item.is_all_day ? 0 : durationMinutes(item.started_at, item.ended_at) / 60), 0);
    sheet.getCell(`A${totalRow}`).value = 'סה״כ שעות';
    sheet.getCell(`G${totalRow}`).value = { formula: `SUM(G6:G${attendance.length + 5})`, result: totalHours };
    sheet.getCell(`G${totalRow}`).numFmt = '0.00';
    styleRowRange(sheet, totalRow, 'L', {
      fill: fill(COLORS.paleTeal),
      font: { name: FONT, size: 10, bold: true, color: { argb: COLORS.navy } },
      border: borderBottom(COLORS.teal, 'medium'),
    });
  } else {
    sheet.getCell('A6').value = 'אין נתוני נוכחות כללית בטווח שנבחר';
    sheet.getCell('A6').font = { name: FONT, italic: true, color: { argb: COLORS.muted } };
  }
}

function addProjectSheet(workbook, rows, context, firstMapRowByGroup) {
  const sheet = workbook.addWorksheet('שעות לפי פרויקט', {
    properties: { tabColor: { argb: COLORS.orange } },
  });
  configureSheet(sheet, [23, 30, 28, 25, 27, 28, 28, 12, 15, 15, 18, 18], 5, 3);
  addSheetHeading(sheet, 'שעות לפי פרויקט', context, 'L');
  sheet.getRow(5).values = ['עובד', 'אימייל', 'פרויקט', 'לקוח', 'מיקום', 'עובדים ועוזרים נוספים', 'תאריכי עבודה', 'ימים', 'סה״כ שעות', 'כניסות פתוחות', 'מיקומי התחלה', 'מיקומי סיום'];
  styleHeader(sheet.getRow(5));
  sheet.autoFilter = 'A5:L5';
  rows.forEach((item, index) => {
    const startMapRow = firstMapRowByGroup.get(`${item.workerId}_${item.projectId}_start`);
    const endMapRow = firstMapRowByGroup.get(`${item.workerId}_${item.projectId}_end`);
    const row = sheet.getRow(index + 6);
    row.values = [
      item.workerName, item.email, item.projectName, item.clientName || '-', item.location || '-',
      item.crewNames.join(', ') || '-', item.workDates.map(shortDate).join(', ') || '-',
      item.days, item.totalMinutes / 60, item.openSessions,
      startMapRow ? { text: locationCountLabel(item.startMapLinks.length), hyperlink: `#'קישורי מפה'!A${startMapRow}`, tooltip: 'מעבר לרשימת מיקומי ההתחלה' } : '-',
      endMapRow ? { text: locationCountLabel(item.endMapLinks.length), hyperlink: `#'קישורי מפה'!A${endMapRow}`, tooltip: 'מעבר לרשימת מיקומי הסיום' } : '-',
    ];
    row.getCell(8).numFmt = '0';
    row.getCell(9).numFmt = '0.00';
    row.getCell(10).numFmt = '0';
  });
  if (rows.length) {
    styleBodyRows(sheet, 6, rows.length + 5, [3, 4, 5, 6, 7]);
    rows.forEach((_, index) => {
      const row = sheet.getRow(index + 6);
      if (typeof row.getCell(11).value === 'object') styleHyperlink(row.getCell(11));
      if (typeof row.getCell(12).value === 'object') styleHyperlink(row.getCell(12));
      row.height = 34;
    });
    const totalRow = rows.length + 7;
    const totalDays = rows.reduce((sum, item) => sum + item.days, 0);
    const totalHours = rows.reduce((sum, item) => sum + item.totalMinutes / 60, 0);
    const totalOpen = rows.reduce((sum, item) => sum + item.openSessions, 0);
    sheet.getCell(`A${totalRow}`).value = 'סה״כ';
    sheet.getCell(`H${totalRow}`).value = { formula: `SUM(H6:H${rows.length + 5})`, result: totalDays };
    sheet.getCell(`I${totalRow}`).value = { formula: `SUM(I6:I${rows.length + 5})`, result: totalHours };
    sheet.getCell(`J${totalRow}`).value = { formula: `SUM(J6:J${rows.length + 5})`, result: totalOpen };
    sheet.getCell(`H${totalRow}`).numFmt = '0';
    sheet.getCell(`I${totalRow}`).numFmt = '0.00';
    sheet.getCell(`J${totalRow}`).numFmt = '0';
    styleRowRange(sheet, totalRow, 'L', {
      fill: fill(COLORS.paleTeal),
      font: { name: FONT, size: 10, bold: true, color: { argb: COLORS.navy } },
      border: borderBottom(COLORS.teal, 'medium'),
    });
  } else {
    sheet.getCell('A6').value = 'אין שעות משויכות לפרויקטים בטווח שנבחר';
    sheet.getCell('A6').font = { name: FONT, italic: true, color: { argb: COLORS.muted } };
  }
}

function buildWorkerSummary(attendance, projectRows) {
  const summaries = new Map();
  const getSummary = (key, name, email) => {
    if (!summaries.has(key)) summaries.set(key, {
      name, email, attendanceCount: 0, attendanceHours: 0,
      projects: new Set(), projectDays: 0, projectHours: 0,
    });
    return summaries.get(key);
  };
  attendance.forEach((item) => {
    const email = item.profiles?.email || '';
    const summary = getSummary(item.worker_id || email, item.profiles?.full_name || 'עובד', email);
    summary.attendanceCount += 1;
    if (!item.is_all_day) summary.attendanceHours += durationMinutes(item.started_at, item.ended_at) / 60;
  });
  projectRows.forEach((item) => {
    const summary = getSummary(item.workerId || item.email, item.workerName, item.email);
    summary.projects.add(item.projectId || item.projectName);
    summary.projectDays += item.days;
    summary.projectHours += item.totalMinutes / 60;
  });
  return Array.from(summaries.values()).sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

function addSummarySheet(workbook, attendance, projectRows, context) {
  const sheet = workbook.addWorksheet('סיכום', { properties: { tabColor: { argb: COLORS.navy } } });
  configureSheet(sheet, [24, 30, 20, 18, 18, 18, 18], 10, 2);
  addSheetHeading(sheet, 'דוח שעות עובדים', context, 'G');
  const attendanceHours = attendance.reduce((sum, item) => sum + (item.is_all_day ? 0 : durationMinutes(item.started_at, item.ended_at) / 60), 0);
  const projectHours = projectRows.reduce((sum, item) => sum + item.totalMinutes / 60, 0);
  const projectDays = projectRows.reduce((sum, item) => sum + item.days, 0);
  const openEntries = projectRows.reduce((sum, item) => sum + item.openSessions, 0);
  const employeeCount = new Set([
    ...attendance.map((item) => item.worker_id || item.profiles?.email),
    ...projectRows.map((item) => item.workerId || item.email),
  ]).size;
  const projectCount = new Set(projectRows.map((item) => item.projectId || item.projectName)).size;
  sheet.getRow(5).values = ['עובדים בדוח', 'דיווחי נוכחות', 'שעות נוכחות', 'פרויקטים', 'ימי פרויקט', 'שעות פרויקט', 'כניסות פתוחות'];
  sheet.getRow(6).values = [employeeCount, attendance.length, attendanceHours, projectCount, projectDays, projectHours, openEntries];
  sheet.getRow(5).height = 28;
  sheet.getRow(6).height = 34;
  sheet.getRow(5).eachCell((cell, index) => {
    cell.fill = fill(index % 2 ? COLORS.navy : COLORS.blue);
    cell.font = { name: FONT, size: 9, bold: true, color: { argb: COLORS.white } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  sheet.getRow(6).eachCell((cell, index) => {
    cell.fill = fill(index === 7 && openEntries ? COLORS.paleOrange : COLORS.paleBlue);
    cell.font = { name: FONT, size: 14, bold: true, color: { argb: index === 7 && openEntries ? COLORS.danger : COLORS.navy } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderBottom(index % 2 ? COLORS.teal : COLORS.blue, 'medium');
  });
  sheet.getCell('C6').numFmt = '0.00';
  sheet.getCell('F6').numFmt = '0.00';
  sheet.getCell('A8').value = 'פירוט לפי עובד';
  sheet.getCell('A8').font = { name: FONT, size: 13, bold: true, color: { argb: COLORS.navy } };
  sheet.getRow(10).values = ['עובד', 'אימייל', 'דיווחי נוכחות', 'שעות נוכחות', 'פרויקטים', 'ימי פרויקט', 'שעות פרויקט'];
  styleHeader(sheet.getRow(10));
  sheet.autoFilter = 'A10:G10';
  const summaries = buildWorkerSummary(attendance, projectRows);
  summaries.forEach((item, index) => {
    const row = sheet.getRow(index + 11);
    row.values = [item.name, item.email, item.attendanceCount, item.attendanceHours, item.projects.size, item.projectDays, item.projectHours];
    row.getCell(3).numFmt = '0';
    row.getCell(4).numFmt = '0.00';
    row.getCell(5).numFmt = '0';
    row.getCell(6).numFmt = '0';
    row.getCell(7).numFmt = '0.00';
  });
  if (summaries.length) styleBodyRows(sheet, 11, summaries.length + 10);
  else {
    sheet.getCell('A11').value = 'אין נתונים בטווח שנבחר';
    sheet.getCell('A11').font = { name: FONT, italic: true, color: { argb: COLORS.muted } };
  }
}

export async function createWorkReportWorkbook({ filteredSessions, filteredAttendance, selectedWorkerName, fromDate, toDate }) {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'מערכת איתור תשתיות';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const projectRows = buildWorkReportRows(filteredSessions);
  const period = `${fromDate ? shortDate(fromDate) : 'ללא תאריך התחלה'} עד ${toDate ? shortDate(toDate) : 'ללא תאריך סיום'}`;
  const context = `${selectedWorkerName || 'כל העובדים'} · ${period}`;
  const mapEntries = createMapEntries(filteredAttendance, filteredSessions);
  const firstMapRowByGroup = firstMapRows(mapEntries);
  addSummarySheet(workbook, filteredAttendance, projectRows, context);
  addAttendanceSheet(workbook, filteredAttendance, context);
  addProjectSheet(workbook, projectRows, context, firstMapRowByGroup);
  addMapSheet(workbook, mapEntries, context);
  return workbook;
}

export async function exportWorkReport({ workSessions, attendanceSessions, workers, workerId, fromDate, toDate, setMessage }) {
  const filteredSessions = workSessions
    .filter((item) => workerId === 'all' || item.worker_id === workerId)
    .filter((item) => sessionStartedInRange(item, fromDate, toDate));
  const filteredAttendance = attendanceSessions
    .filter((item) => workerId === 'all' || item.worker_id === workerId)
    .filter((item) => {
      const date = item.attendance_date || item.started_at.slice(0, 10);
      return (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
    });
  if (!filteredSessions.length && !filteredAttendance.length) {
    setMessage(workerId === 'all' ? 'אין נתוני שעות לייצוא בטווח התאריכים שנבחר.' : 'אין נתוני שעות לעובד שנבחר בטווח התאריכים.');
    return;
  }
  try {
    const selectedWorker = workers.find((worker) => worker.id === workerId);
    const workbook = await createWorkReportWorkbook({
      filteredSessions, filteredAttendance, selectedWorkerName: selectedWorker?.full_name,
      fromDate, toDate,
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const workerPart = selectedWorker ? `-${safeFilePart(selectedWorker.full_name)}` : '-כל-העובדים';
    const rangePart = `${fromDate || 'ללא-התחלה'}-עד-${toDate || 'ללא-סיום'}`;
    anchor.download = `דוח-שעות-עובדים${workerPart}-${rangePart}.xlsx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage('קובץ Excel מעוצב יוצא בהצלחה.');
  } catch (error) {
    console.error('Failed to export work report workbook', error);
    setMessage('לא ניתן היה לייצא את קובץ ה-Excel. נסו שוב.');
  }
}
