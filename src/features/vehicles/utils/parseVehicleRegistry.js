// Reads the secretary's vehicle table (one row per vehicle, Hebrew headers,
// free-text cells) into register rows plus toll subscriptions. The source is
// hand-maintained, so every cell is read defensively and anything doubtful is
// reported as a warning for the preview step instead of being guessed at.

const HEADERS = {
  plate: (h) => h.includes('מספר רכב'),
  model: (h) => h.includes('סוג רכב'),
  year: (h) => h.includes('שנת יצור'),
  entered: (h) => h.includes('נכנס בתאריך'),
  dalkan: (h) => h === 'דלקן',
  pangoFlag: (h) => h === 'פסקל' || h === 'פנגו',
  pangoNumber: (h) => h.startsWith("מס' פסקל") || h.startsWith("מס' פנגו"),
  kvish6: (h) => h.startsWith('כיבש 6') || h.startsWith('כביש 6'),
  carmel: (h) => h.includes('מנהרות הכרמל'),
  hatzut: (h) => h.includes('חוצה צפון'),
  ownership: (h) => h.includes('בעלות'),
  agent: (h) => h.includes('סוכן ביטוח'),
  driver: (h) => h.includes('שם נהג'),
};

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const isEmpty = (value) => !clean(value) || clean(value) === '-';

export function excelSerialToIso(serial) {
  const date = new Date(Math.round((Number(serial) - 25569) * 86400000));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/** Excel serial, dd-mm-yyyy / dd/mm/yyyy text, or ISO text → 'YYYY-MM-DD' (or null). */
export function parseDateCell(value) {
  if (typeof value === 'number' && value > 20000 && value < 70000) return excelSerialToIso(value);
  const text = clean(value);
  const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return null;
}

function parsePlate(value) {
  const text = String(value ?? '');
  const match = text.match(/\d{2,3}-\d{2,3}-\d{2,3}/) || text.match(/\d{7,8}/);
  if (!match) return { plate: '', note: clean(text) };
  const note = clean(text.replace(match[0], ''));
  return { plate: match[0], note };
}

function inferKind(model) {
  if (/נגרר/.test(model)) return 'trailer';
  if (/משאית|MAN|מאן/i.test(model)) return 'truck';
  return 'car';
}

function parseOwnership(value) {
  const text = clean(value);
  if (!text) return { ownership: null, label: '' };
  const label = clean(text.replace(/^פרטי\s*-?\s*/, ''));
  return { ownership: /ליסינג/.test(text) ? 'leasing' : 'owned', label };
}

function parseHolder(value) {
  const text = clean(value);
  if (!text) return { holder_type: 'driver', driver_name: '' };
  if (/^משרד$/.test(text)) return { holder_type: 'office', driver_name: '' };
  if (/^חב['׳]?\s/.test(text)) return { holder_type: 'company', driver_name: text };
  if (/^משרד/.test(text)) return { holder_type: 'office', driver_name: clean(text.replace(/^משרד\s*[\\/]?\s*/, '')) };
  return { holder_type: 'driver', driver_name: text };
}

function tollFromFlag(kind, value, warnings, plate) {
  if (isEmpty(value)) return null;
  const date = parseDateCell(value);
  const text = clean(value);
  if (!date && !/^v$/i.test(text)) {
    warnings.push(`${plate}: ערך לא ברור בעמודת מנוי (${text}) – נשמר ללא תאריך עדכון`);
  }
  return { kind, subscription_number: '', updated_on: date };
}

export function parseVehicleRegistryRows(rows) {
  const headerIndex = rows.findIndex((row) => row.some((cell) => clean(cell).includes('מספר רכב')));
  if (headerIndex < 0) throw new Error('לא נמצאה שורת כותרות (מספר רכב) בקובץ.');

  const headerRow = rows[headerIndex].map(clean);
  const col = {};
  for (const [key, matcher] of Object.entries(HEADERS)) {
    const index = headerRow.findIndex((header) => header && matcher(header));
    if (index >= 0) col[key] = index;
  }
  if (col.plate === undefined) throw new Error('לא נמצאה עמודת מספר רכב.');

  const warnings = [];
  const vehicles = [];
  const seen = new Set();

  for (const row of rows.slice(headerIndex + 1)) {
    const cell = (key) => (col[key] === undefined ? '' : row[col[key]]);
    const { plate, note } = parsePlate(cell('plate'));
    if (!plate) {
      if (row.some((value) => !isEmpty(value))) warnings.push(`שורה ללא מספר רכב תקין דולגה (${clean(cell('model')) || clean(cell('driver'))})`);
      continue;
    }
    const digits = plate.replace(/\D/g, '');
    if (seen.has(digits)) {
      warnings.push(`${plate}: מספר רכב מופיע יותר מפעם אחת – השורה הכפולה דולגה`);
      continue;
    }
    seen.add(digits);

    const model = clean(cell('model'));
    const kind = inferKind(model);
    const yearValue = cell('year');
    const year = /^(19|20)\d{2}$/.test(clean(yearValue)) ? Number(clean(yearValue)) : null;
    const dalkanRaw = clean(cell('dalkan'));
    const isElectric = /חשמלי/.test(dalkanRaw);
    const { ownership, label } = parseOwnership(cell('ownership'));
    const holder = parseHolder(cell('driver'));

    const tolls = [];
    const dalkan = isElectric ? null : tollFromFlag('dalkan', cell('dalkan'), warnings, plate);
    if (dalkan) tolls.push(dalkan);

    const pangoNumber = clean(cell('pangoNumber')).replace(/\D/g, '');
    const pangoFlag = clean(cell('pangoFlag'));
    const pangoFlagNumber = /^\d{6,}$/.test(pangoFlag) ? pangoFlag : '';
    if (pangoNumber || pangoFlagNumber || /מנוי/.test(pangoFlag)) {
      tolls.push({
        kind: 'pango',
        subscription_number: pangoNumber || pangoFlagNumber,
        updated_on: parseDateCell(cell('kvish6')),
      });
    }
    const kvish6 = tollFromFlag('kvish6', cell('kvish6'), warnings, plate);
    if (kvish6) tolls.push(kvish6);
    const carmel = tollFromFlag('carmel_tunnels', cell('carmel'), warnings, plate);
    if (carmel) tolls.push(carmel);
    const hatzut = tollFromFlag('hatzut_zafon', cell('hatzut'), warnings, plate);
    if (hatzut) tolls.push(hatzut);

    if (!ownership && kind !== 'trailer') warnings.push(`${plate}: לא צוינה בעלות`);

    vehicles.push({
      plate_number: plate,
      kind,
      make_model: model,
      manufacture_year: year,
      is_electric: isElectric,
      entered_on: parseDateCell(cell('entered')),
      ownership,
      ownership_label: label,
      insurance_agent: String(cell('agent') ?? '').split('\n').map(clean).filter(Boolean).join(' / '),
      ...holder,
      status: 'in_use',
      notes: note ? `הערה מהטבלה: ${note}` : '',
      tolls,
    });
  }

  return { vehicles, warnings };
}

export async function parseVehicleRegistryFile(file) {
  if (!/\.(xls|xlsx)$/i.test(file.name)) throw new Error('יש לבחור קובץ Excel (.xls או .xlsx).');
  const xlsxModule = await import('xlsx');
  const XLSX = xlsxModule.default || xlsxModule;
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('לא נמצא גיליון נתונים בקובץ.');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  return parseVehicleRegistryRows(rows);
}
