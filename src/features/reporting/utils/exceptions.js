const COLORS = {
  navy: 'FF0B2B53',
  blue: 'FF155E8B',
  teal: 'FF008C99',
  orange: 'FFF47C42',
  ink: 'FF17324D',
  muted: 'FF64748B',
  white: 'FFFFFFFF',
  paleBlue: 'FFEAF4F8',
  paleOrange: 'FFFFF1E8',
  paleRed: 'FFFFE9E7',
  paleYellow: 'FFFFF7DF',
  stripe: 'FFF7FAFC',
  border: 'FFD8E4EC',
  danger: 'FFB42318',
  warning: 'FFB86B00',
  success: 'FF117A65',
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

function safeFilePart(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function severityLabel(severity) {
  return { high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' }[severity] || severity;
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

function styleExceptionRows(sheet, startRow, endRow) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.height = 42;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = { name: FONT, size: 10, color: { argb: COLORS.ink } };
      cell.alignment = {
        horizontal: columnNumber === 8 ? 'right' : 'center',
        vertical: 'middle',
        wrapText: [2, 3, 4, 5, 6, 7, 8].includes(columnNumber),
      };
      cell.border = borderBottom();
      if (rowNumber % 2 === 0) cell.fill = fill(COLORS.stripe);
    });
  }
}

export function daysBetween(dateText) {
  if (!dateText) return 0;
  const date = new Date(dateText);
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export function buildProjectExceptions(projects) {
  const exceptions = [];
  for (const project of projects) {
    if (!project.assigned_to) {
      exceptions.push({
        project,
        type: 'unassigned',
        title: 'פרויקט ללא שיוך לעובד',
        description: 'הפרויקט קיים במערכת אך עדיין לא שויך לעובד שטח.',
        descriptionKey: 'הפרויקט קיים במערכת אך עדיין לא שויך לעובד שטח.',
        severity: 'high',
      });
    }
    const openSessions = (project.work_sessions || []).filter(
      (session) => !session.ended_at,
    );
    for (const session of openSessions) {
      const hours =
        Math.round(
          ((Date.now() - new Date(session.started_at).getTime()) / 3600000) *
            10,
        ) / 10;
      exceptions.push({
        project,
        type: 'open_work',
        title: 'עבודה פתוחה ללא סיום',
        description: `קיימת שעת התחלה פתוחה כבר ${hours} שעות. מומלץ לוודא שהעובד סיים עבודה.`,
        descriptionKey: 'קיימת שעת התחלה פתוחה כבר {{hours}} שעות. מומלץ לוודא שהעובד סיים עבודה.',
        descriptionValues: { hours },
        severity: hours >= 10 ? 'high' : 'medium',
      });
    }
    const staleDays = daysBetween(project.updated_at);
    if (project.status !== 'הושלם' && staleDays >= 4) {
      exceptions.push({
        project,
        type: 'stale_project',
        title: 'פרויקט ללא עדכון מספר ימים',
        description: `הפרויקט לא עודכן כבר ${staleDays} ימים.`,
        descriptionKey: 'הפרויקט לא עודכן כבר {{days}} ימים.',
        descriptionValues: { days: staleDays },
        severity: staleDays >= 7 ? 'high' : 'medium',
      });
    }
    if (project.status === 'מחכה להיתרים' && staleDays >= 7) {
      exceptions.push({
        project,
        type: 'permits_wait',
        title: 'מחכה להיתרים זמן ממושך',
        description: `הפרויקט בסטטוס מחכה להיתרים כבר ${staleDays} ימים מאז העדכון האחרון.`,
        descriptionKey: 'הפרויקט בסטטוס מחכה להיתרים כבר {{days}} ימים מאז העדכון האחרון.',
        descriptionValues: { days: staleDays },
        severity: 'medium',
      });
    }
    for (const task of project.project_tasks || []) {
      const taskDays = daysBetween(task.created_at);
      if (!task.is_done && taskDays >= 7) {
        exceptions.push({
          project,
          type: 'old_task',
          title: 'משימה פתוחה יותר מדי זמן',
          description: `המשימה "${task.title}" פתוחה כבר ${taskDays} ימים.`,
          descriptionKey: 'המשימה "{{title}}" פתוחה כבר {{days}} ימים.',
          descriptionValues: { title: task.title, days: taskDays },
          severity: taskDays >= 14 ? 'high' : 'low',
        });
      }
    }
  }
  return exceptions;
}

export async function createExceptionsWorkbook(exceptions, { generatedAt = new Date() } = {}) {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'מערכת איתור תשתיות';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;

  const sheet = workbook.addWorksheet('דוח חריגות', {
    properties: { tabColor: { argb: COLORS.orange } },
    views: [{ state: 'frozen', xSplit: 2, ySplit: 10, rightToLeft: true, showGridLines: false }],
  });
  sheet.properties.defaultRowHeight = 20;
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  [13, 28, 36, 25, 25, 24, 20, 58, 17].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  sheet.getCell('A2').value = 'דוח חריגות יומי';
  sheet.getCell('A2').font = { name: FONT, size: 16, bold: true, color: { argb: COLORS.navy } };
  sheet.getCell('A2').alignment = { horizontal: 'right', vertical: 'middle' };
  sheet.getRow(2).height = 27;
  sheet.getCell('A3').value = `כל הפרויקטים הפעילים · הופק בתאריך ${generatedAt.toLocaleString('he-IL')}`;
  sheet.mergeCells('A3:D3');
  sheet.getCell('A3').font = { name: FONT, size: 10, italic: true, color: { argb: COLORS.muted } };
  sheet.getCell('A3').alignment = { horizontal: 'right', vertical: 'middle' };
  styleRowRange(sheet, 3, 'I', { border: borderBottom(COLORS.teal, 'medium') });
  sheet.getRow(3).height = 22;

  const severityCounts = exceptions.reduce(
    (counts, item) => ({ ...counts, [item.severity]: (counts[item.severity] || 0) + 1 }),
    { high: 0, medium: 0, low: 0 },
  );
  sheet.getRow(5).values = ['סה״כ חריגות', 'חומרה גבוהה', 'חומרה בינונית', 'חומרה נמוכה'];
  sheet.getRow(6).values = [exceptions.length, severityCounts.high, severityCounts.medium, severityCounts.low];
  sheet.getRow(5).height = 28;
  sheet.getRow(6).height = 34;
  sheet.getRow(5).eachCell((cell, index) => {
    cell.fill = fill(index % 2 ? COLORS.navy : COLORS.blue);
    cell.font = { name: FONT, size: 9, bold: true, color: { argb: COLORS.white } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  const summaryFills = [COLORS.paleBlue, COLORS.paleRed, COLORS.paleYellow, COLORS.paleBlue];
  const summaryFonts = [COLORS.navy, COLORS.danger, COLORS.warning, COLORS.success];
  sheet.getRow(6).eachCell((cell, index) => {
    cell.fill = fill(summaryFills[index - 1]);
    cell.font = { name: FONT, size: 14, bold: true, color: { argb: summaryFonts[index - 1] } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderBottom(index % 2 ? COLORS.teal : COLORS.blue, 'medium');
    cell.numFmt = '#,##0';
  });

  sheet.getCell('A8').value = 'פירוט חריגות';
  sheet.getCell('A8').font = { name: FONT, size: 13, bold: true, color: { argb: COLORS.navy } };
  sheet.getRow(10).values = [
    'חומרה',
    'סוג חריגה',
    'פרויקט',
    'לקוח',
    'מיקום',
    'עובד אחראי',
    'סטטוס פרויקט',
    'תיאור',
    'עדכון אחרון',
  ];
  styleHeader(sheet.getRow(10));
  sheet.autoFilter = 'A10:I10';

  exceptions.forEach((item, index) => {
    const row = sheet.getRow(index + 11);
    row.values = [
      severityLabel(item.severity),
      item.title,
      item.project.name,
      item.project.client_name || '-',
      item.project.location || '-',
      item.project.profiles?.full_name || 'לא משויך',
      item.project.status || '-',
      item.description,
      excelDate(item.project.updated_at),
    ];
    row.getCell(9).numFmt = 'dd/mm/yyyy';
  });

  if (exceptions.length) {
    styleExceptionRows(sheet, 11, exceptions.length + 10);
    exceptions.forEach((item, index) => {
      const severityCell = sheet.getRow(index + 11).getCell(1);
      const severityStyle = {
        high: { fill: COLORS.paleRed, font: COLORS.danger },
        medium: { fill: COLORS.paleYellow, font: COLORS.warning },
        low: { fill: COLORS.paleBlue, font: COLORS.success },
      }[item.severity] || { fill: COLORS.paleBlue, font: COLORS.navy };
      severityCell.fill = fill(severityStyle.fill);
      severityCell.font = { name: FONT, size: 10, bold: true, color: { argb: severityStyle.font } };
    });
  } else {
    sheet.getCell('A11').value = 'אין חריגות כרגע';
    sheet.getCell('A11').font = { name: FONT, size: 10, italic: true, color: { argb: COLORS.muted } };
  }

  sheet.headerFooter.oddFooter = '&Rעמוד &P מתוך &N&Lמערכת איתור תשתיות';
  sheet.pageSetup.printTitlesRow = '1:10';
  return workbook;
}

export async function exportExceptionsExcel(exceptions, setMessage) {
  if (!exceptions.length) {
    setMessage?.('אין חריגות לייצוא כרגע.');
    return;
  }
  try {
    const generatedAt = new Date();
    const workbook = await createExceptionsWorkbook(exceptions, { generatedAt });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `דוח-חריגות-${safeFilePart(generatedAt.toISOString().slice(0, 10))}.xlsx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage?.('קובץ Excel מעוצב יוצא בהצלחה.');
  } catch (error) {
    console.error('Failed to export exceptions workbook', error);
    setMessage?.('לא ניתן היה לייצא את קובץ ה-Excel. נסו שוב.');
  }
}
