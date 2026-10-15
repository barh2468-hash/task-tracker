import { parseVehicleRows, VEHICLE_EXPORT_FIELDS } from './vehicleRegister.js';

function cellValue(value) {
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  if (value.richText) return value.richText.map((part) => part.text).join('');
  if (value.result !== undefined) return cellValue(value.result);
  return value.text || '';
}

export async function readVehicleWorkbook(file) {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('יש לבחור קובץ Excel מסוג xlsx.');
  const module = await import('exceljs');
  const ExcelJS = module.default || module;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  for (const sheet of workbook.worksheets) {
    const rows = [];
    sheet.eachRow({ includeEmpty: true }, (row) => rows.push(row.values.slice(1).map(cellValue)));
    if (rows.some((row) => row.some((value) => String(value || '').trim() === 'מספר רכב'))) return parseVehicleRows(rows);
  }
  throw new Error('לא נמצאה טבלת רכבים בקובץ.');
}

export async function downloadVehicleWorkbook(records) {
  const module = await import('exceljs');
  const ExcelJS = module.default || module;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('רכבים', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
  sheet.columns = VEHICLE_EXPORT_FIELDS.map(({ key, label }) => ({ key, header: label, width: key === 'insurance_agent' ? 38 : 25 }));
  records.forEach((record) => sheet.addRow(Object.fromEntries(VEHICLE_EXPORT_FIELDS.map(({ key }) => [key, record[key] ?? '']))));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF082D57' } };
  sheet.eachRow((row) => { row.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true }; row.height = 42; });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: records.length + 1, column: VEHICLE_EXPORT_FIELDS.length } };
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'רכבים.xlsx';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
