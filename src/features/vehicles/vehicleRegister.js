export const VEHICLE_FIELDS = [
  ['plate_number', 'מספר רכב'],
  ['vehicle_type', 'סוג רכב'],
  ['manufacture_year', 'שנת יצור'],
  ['entered_on', 'נכנס בתאריך'],
  ['fuel_card', 'דלקן'],
  ['paskal', 'פסקל'],
  ['paskal_number', 'מס׳ פסקל'],
  ['route6_updated_on', 'כביש 6 - תאריך עדכון פסקל'],
  ['carmel_tunnels', 'מנהרות הכרמל'],
  ['cross_north', 'חוצה צפון'],
  ['ownership', 'בעלות רכב'],
  ['insurance_agent', 'סוכן ביטוח'],
  ['driver_age', 'גיל נהג'],
  ['driving_seniority', 'וותק נהיגה בשנים'],
  ['driver_name', 'שם נהג'],
].map(([key, label]) => ({ key, label }));

export const MILEAGE_FIELD = { key: 'current_mileage', label: 'קילומטראז׳ עדכני' };
export const VEHICLE_EXPORT_FIELDS = [...VEHICLE_FIELDS, MILEAGE_FIELD];

export function parseVehicleMileage(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (!/^\d+$/.test(text) || Number(text) > 2147483647) {
    throw new Error('יש להזין קילומטראז׳ במספר שלם שאינו שלילי.');
  }
  return Number(text);
}

export function cleanVehicleCell(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

export function getVehiclePlateKey(value) {
  const firstLine = cleanVehicleCell(value).split('\n')[0].trim();
  if (!/^[0-9 -]+$/.test(firstLine)) return '';
  const key = firstLine.replace(/[^0-9]/g, '');
  return /^\d{7,8}$/.test(key) ? key : '';
}

export function toVehiclePayload(record) {
  const payload = Object.fromEntries(VEHICLE_FIELDS.map(({ key }) => [key, cleanVehicleCell(record[key])]));
  if (!getVehiclePlateKey(payload.plate_number)) throw new Error('יש להזין מספר רכב בן 7 או 8 ספרות בשורה הראשונה.');
  if (Object.hasOwn(record, 'current_mileage')) payload.current_mileage = parseVehicleMileage(record.current_mileage);
  return payload;
}

export function hasFuelCard(value) {
  return /^(v|✓|כן|קיים)$/i.test(cleanVehicleCell(value));
}

export function formatVehicleValue(value) {
  const text = cleanVehicleCell(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.split('-').reverse().join('/');
  return text || '—';
}

export function filterVehicles(records, { search = '', ownership = '', fuel = '' } = {}) {
  const query = search.trim().toLocaleLowerCase();
  const plateQuery = /^[\d\s-]+$/.test(query) ? query.replace(/[^0-9]/g, '') : '';
  return records.filter((record) => {
    if (ownership && record.ownership !== ownership) return false;
    if (fuel && hasFuelCard(record.fuel_card) !== (fuel === 'yes')) return false;
    if (!query) return true;
    return VEHICLE_FIELDS.some(({ key }) => cleanVehicleCell(record[key]).toLocaleLowerCase().includes(query)) ||
      (plateQuery && getVehiclePlateKey(record.plate_number).includes(plateQuery));
  });
}

function headerKey(value) {
  return cleanVehicleCell(value).replace(/[\s'"׳״־-]/g, '');
}

export function parseVehicleRows(rows) {
  const headerIndex = rows.findIndex((row) => row.some((value) => headerKey(value) === 'מספררכב'));
  if (headerIndex < 0) throw new Error('לא נמצאה טבלת רכבים בקובץ.');
  const headers = rows[headerIndex].map(headerKey);
  const mileageIndex = headers.indexOf(headerKey(MILEAGE_FIELD.label));
  const columns = VEHICLE_FIELDS.map(({ key, label }) => {
    const aliases = key === 'route6_updated_on'
      ? [headerKey(label), headerKey('כיבש 6 -תאריך עדכון פסקל')]
      : [headerKey(label)];
    const index = headers.findIndex((header) => aliases.includes(header));
    if (index < 0) throw new Error(`חסרה עמודה בקובץ: ${label}`);
    return index;
  });
  const seen = new Set();
  const records = [];
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (!row.some((value) => cleanVehicleCell(value))) return;
    const record = toVehiclePayload(Object.fromEntries(VEHICLE_FIELDS.map(({ key }, index) => [key, row[columns[index]]])));
    if (mileageIndex >= 0) record.current_mileage = parseVehicleMileage(row[mileageIndex]);
    const plateKey = getVehiclePlateKey(record.plate_number);
    if (seen.has(plateKey)) throw new Error(`מספר רכב כפול בקובץ בשורה ${headerIndex + offset + 2}: ${record.plate_number}`);
    seen.add(plateKey);
    records.push(record);
  });
  if (!records.length) throw new Error('הקובץ אינו מכיל רכבים.');
  if (records.length > 1000) throw new Error('ניתן לייבא עד 1,000 רכבים בכל קובץ.');
  return records;
}
