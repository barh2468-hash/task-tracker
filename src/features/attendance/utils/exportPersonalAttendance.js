import { attendanceTypeLabel } from '../constants.js';
import { durationMinutes } from '../../../utils/format.js';
import { personalAttendanceRows, reportDate } from './personalReport.js';

const timeParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const excelDate = (key) => new Date(`${key}T00:00:00Z`);
function excelTime(value) {
  if (!value) return null;
  const parts = Object.fromEntries(timeParts.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) / 86400;
}

function addSheet(workbook, name, title, context, exportedAt, headers, widths, rows, totalHours) {
  const sheet = workbook.addWorksheet(name, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 6 }] });
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.mergeCells('A1:G1');
  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2B53' } };
  sheet.getRow(1).height = 34;
  sheet.mergeCells('A2:G2'); sheet.getCell('A2').value = context;
  sheet.mergeCells('A3:G3'); sheet.getCell('A3').value = `מועד הייצוא: ${exportedAt} · משמרות פתוחות מחושבות עד מועד הייצוא.`;
  sheet.getRow(3).height = 30;
  sheet.mergeCells('A4:D4'); sheet.getCell('A4').value = 'סה״כ שעות';
  sheet.getCell('E4').value = rows.length ? { formula: `SUM(E7:E${rows.length + 6})`, result: totalHours } : 0;
  sheet.getCell('E4').numFmt = '0.00'; sheet.getRow(4).font = { name: 'Arial', bold: true };
  sheet.getRow(6).values = headers;
  sheet.getRow(6).height = 32;
  sheet.getRow(6).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2B53' } };
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
  });
  for (const values of rows) {
    const row = sheet.addRow(values);
    row.font = { name: 'Arial', size: 11 };
    row.height = 42;
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    row.getCell(3).numFmt = row.getCell(4).numFmt = 'hh:mm';
    row.getCell(5).numFmt = '0.00';
  }
  if (rows.length) sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: rows.length + 6, column: 7 } };
  else sheet.getCell('A7').value = 'אין רישומים בטווח שנבחר';
  sheet.eachRow((row) => { row.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true }; });
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:6' };
  return sheet;
}

export async function createPersonalAttendanceWorkbook({ attendance, work, userId, workerName, from, to, now = new Date() }) {
  if (!userId || !from || !to || from > to) throw new Error('יש לבחור טווח תאריכים תקין.');
  const rows = personalAttendanceRows(attendance, userId, from, to, now);
  const projectWork = work.filter((item) => item.worker_id === userId && item.ended_at && reportDate(item.started_at) >= from && reportDate(item.started_at) <= to)
    .sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
  if (!rows.length && !projectWork.length) throw new Error('אין נתונים לייצוא בטווח שנבחר.');
  const module = await import('exceljs');
  const ExcelJS = module.default || module;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'קבוצת מאיה'; workbook.created = now; workbook.calcProperties.fullCalcOnLoad = true;
  const dateLabel = (key) => key.split('-').reverse().join('/');
  const context = `${workerName || 'העובד'} · ${dateLabel(from)}–${dateLabel(to)}`;
  const exportedAt = now.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  addSheet(workbook, 'נוכחות אישית', 'דוח הנוכחות שלי', context, exportedAt,
    ['תאריך', 'סוג נוכחות', 'כניסה', 'יציאה', 'משך (שעות)', 'מצב', 'הערת סיום'], [16, 24, 13, 13, 17, 16, 55],
    rows.map((row) => [excelDate(row.date), attendanceTypeLabel[row.attendance_type] || row.attendance_type,
      row.is_all_day ? null : excelTime(row.started_at), row.is_all_day ? null : excelTime(row.ended_at),
      row.is_all_day ? null : row.minutes / 60, row.is_all_day ? 'יום מלא' : row.ended_at ? 'סגור' : 'פתוח', row.end_note || '']),
    rows.reduce((sum, row) => sum + row.minutes / 60, 0));
  addSheet(workbook, 'עבודה בפרויקטים', 'רישומי עבודה סגורים בפרויקטים', `${context} · שעות הפרויקט מוצגות בנפרד משעות הנוכחות.`, exportedAt,
    ['תאריך', 'פרויקט', 'התחלה', 'סיום', 'משך (שעות)', 'עובדים ועוזרים', 'הערת סיום'], [16, 45, 13, 13, 17, 45, 55],
    projectWork.map((item) => [excelDate(reportDate(item.started_at)), item.projects?.name || 'פרויקט', excelTime(item.started_at), excelTime(item.ended_at),
      durationMinutes(item.started_at, item.ended_at) / 60, (item.crew_members || []).map((member) => member.name).join(', '), item.end_note || '']),
    projectWork.reduce((sum, item) => sum + durationMinutes(item.started_at, item.ended_at) / 60, 0));
  return workbook;
}

export async function downloadPersonalAttendanceWorkbook(options) {
  const workbook = await createPersonalAttendanceWorkbook(options);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  const workerName = String(options.workerName || 'שלי').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 80);
  link.href = url; link.download = `דוח-נוכחות-${workerName}-${options.from}-עד-${options.to}.xlsx`;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
