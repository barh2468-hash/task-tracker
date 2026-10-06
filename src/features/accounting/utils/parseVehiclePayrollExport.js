import { parseVehiclePayrollRows } from './parseVehiclePayrollRows.js';
import { pickYearSheet } from './pickYearSheet.js';

function sheetToRows(XLSX, worksheet) {
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });
}

/**
 * Reads a payroll/vehicle-hub export (.xls or .xlsx) and parses it into
 * table-3-shaped records for the given year.
 */
export async function parseVehiclePayrollExport(file, year) {
  if (!/\.(xls|xlsx)$/i.test(file.name)) {
    throw new Error('יש לבחור קובץ Excel (.xls או .xlsx).');
  }

  const xlsxModule = await import('xlsx');
  const XLSX = xlsxModule.default || xlsxModule;
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const { sheet: worksheet, matchedYear } = pickYearSheet(workbook, year);
  if (!worksheet) throw new Error('לא נמצא גיליון נתונים בקובץ.');
  if (matchedYear !== null && matchedYear !== year) {
    throw new Error(`בקובץ אין גיליון לשנת ${year} — הגיליון הזמין הקרוב ביותר הוא ${matchedYear}. יש לבדוק את שדה השנה או להעלות את הקובץ הנכון.`);
  }

  const rows = sheetToRows(XLSX, worksheet);
  return parseVehiclePayrollRows(rows, { year });
}
