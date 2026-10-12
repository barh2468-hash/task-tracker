import {
  DOCUMENT_TYPES, HOLDER_TYPES, INSURANCE_KINDS, OWNERSHIP_TYPES, TOLL_KINDS, VEHICLE_KINDS, VEHICLE_STATUSES,
} from '../constants.js';
import { getDocumentUrl } from '../api.js';
import { formatDate } from './vehicleStatus.js';

const FINE_STATUS_LABELS = { new: 'חדש', forwarded: 'הועבר לנהג', paid: 'שולם', appeal: 'בערעור' };
const QUOTE_STATUS_LABELS = { pending: 'ממתינה לאישור', approved: 'אושרה', rejected: 'נדחתה' };
const dateTime = (value) => (value ? new Date(value).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '');
const day = (value) => (value ? formatDate(value) : '');
const bool = (value) => (value ? 'כן' : 'לא');

async function loadXlsx() {
  const module = await import('xlsx');
  return module.default || module;
}

function sheetFrom(XLSX, headers, rows) {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  sheet['!cols'] = headers.map((header, index) => ({
    wch: Math.min(40, Math.max(String(header).length + 2, ...rows.map((row) => String(row[index] ?? '').length + 2))),
  }));
  return sheet;
}

/** Builds the workbook sheets for a set of vehicles (one vehicle for the ZIP summary, or the whole fleet). */
function buildSheets(XLSX, { vehicles, policies = [], inspections = [], tolls = [], readings = [], fines = [], assignments = [], quotes = [] }) {
  const plateById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.plate_number]));
  const plate = (id) => plateById.get(id) || '';

  const sheets = [
    ['רכבים', sheetFrom(XLSX,
      ['מספר רכב', 'סוג', 'דגם', 'שנה', 'חשמלי', 'סטטוס', 'בעלות', 'חברת ליסינג / בעלים', 'תחילת ליסינג', 'סיום ליסינג',
        'סוג מחזיק', 'נהג / מחזיק', 'סוכן ביטוח', 'נכנס לחברה', 'ק"מ אחרון', 'הוצא משימוש', 'סיבה', 'הערות'],
      vehicles.map((vehicle) => [
        vehicle.plate_number, VEHICLE_KINDS[vehicle.kind], vehicle.make_model, vehicle.manufacture_year ?? '', bool(vehicle.is_electric),
        VEHICLE_STATUSES[vehicle.status], vehicle.ownership ? OWNERSHIP_TYPES[vehicle.ownership] : '', vehicle.ownership_label,
        day(vehicle.lease_start), day(vehicle.lease_end), HOLDER_TYPES[vehicle.holder_type], vehicle.driver_name, vehicle.insurance_agent,
        day(vehicle.entered_on), vehicle.current_odometer ?? '', day(vehicle.retired_on), vehicle.retired_reason, vehicle.notes,
      ]))],
    ['ביטוחים', sheetFrom(XLSX,
      ['מספר רכב', 'סוג', 'חברה', 'סוכן', 'מספר פוליסה', 'מתאריך', 'עד', 'פרמיה (₪)'],
      policies.map((policy) => [plate(policy.vehicle_id), INSURANCE_KINDS[policy.kind], policy.insurer, policy.agent,
        policy.policy_number, day(policy.valid_from), day(policy.valid_to), policy.premium_ils ?? '']))],
    ['טסטים', sheetFrom(XLSX,
      ['מספר רכב', 'תאריך טסט', 'בתוקף עד', 'תחנה', 'תוצאה'],
      inspections.map((item) => [plate(item.vehicle_id), day(item.inspected_on), day(item.valid_to), item.station, item.result]))],
    ['מנויים', sheetFrom(XLSX,
      ['מספר רכב', 'מנוי', 'מספר מנוי', 'עודכן'],
      tolls.map((toll) => [plate(toll.vehicle_id), TOLL_KINDS[toll.kind], toll.subscription_number, day(toll.updated_on)]))],
    ['ק"מ חודשי', sheetFrom(XLSX,
      ['מספר רכב', 'חודש', 'ק"מ'],
      [...readings].sort((a, b) => b.reading_month.localeCompare(a.reading_month))
        .map((reading) => [plate(reading.vehicle_id), reading.reading_month.slice(0, 7), reading.odometer_km]))],
    ['דוחות', sheetFrom(XLSX,
      ['מספר רכב', 'מספר דוח', 'מועד עבירה', 'עבירה', 'מקום', 'רשות', 'נהג אחראי', 'סכום (₪)', 'לתשלום עד', 'סטטוס'],
      fines.map((fine) => [plate(fine.vehicle_id), fine.fine_number, dateTime(fine.offense_at), fine.offense_description, fine.location,
        fine.authority, fine.driver_name, Number(fine.amount_ils), day(fine.due_date), FINE_STATUS_LABELS[fine.status]]))],
    ['שיוכים', sheetFrom(XLSX,
      ['מספר רכב', 'נהג', 'מתאריך', 'עד', 'סוג', 'ק"מ התחלה', 'ק"מ סיום'],
      assignments.map((item) => [plate(item.vehicle_id), item.driver_name, dateTime(item.started_at), dateTime(item.ended_at),
        item.assignment_kind === 'temporary' ? 'זמני' : 'קבוע', item.start_odometer ?? '', item.end_odometer ?? '']))],
  ];
  if (quotes.length) {
    sheets.push(['הצעות ביטוח', sheetFrom(XLSX,
      ['מספר רכב', 'סוכן', 'חברה', 'פרמיה (₪)', 'סטטוס', 'הוגשה ע"י', 'הוחלט ע"י', 'תאריך החלטה', 'הערת החלטה'],
      quotes.map((quote) => [plate(quote.vehicle_id), quote.agent, quote.insurer, quote.premium_ils ?? '', QUOTE_STATUS_LABELS[quote.status],
        quote.requested_by_name, quote.decided_by_name, dateTime(quote.decided_at), quote.decision_note]))]);
  }
  return sheets;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** Whole-fleet Excel: one sheet per subject. */
export async function exportFleetWorkbook(data) {
  const XLSX = await loadXlsx();
  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] };
  for (const [name, sheet] of buildSheets(XLSX, data)) XLSX.utils.book_append_sheet(workbook, sheet, name);
  XLSX.writeFile(workbook, `צי-רכבים-${stamp()}.xlsx`);
}

const safeName = (name) => String(name).replace(/[\\/:*?"<>|]/g, '-').trim() || 'file';

/**
 * One vehicle: a ZIP with a summary workbook and every uploaded document,
 * foldered by document type. Files that fail to download are listed in
 * errors.txt instead of aborting the export.
 */
export async function exportVehicleZip(detail, { assignments = [], fines = [] } = {}, onProgress) {
  const [{ default: JSZip }, XLSX] = await Promise.all([import('jszip'), loadXlsx()]);
  const { vehicle, documents } = detail;
  const zip = new JSZip();

  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] };
  for (const [name, sheet] of buildSheets(XLSX, {
    vehicles: [vehicle], policies: detail.policies, inspections: detail.inspections, tolls: detail.tolls,
    readings: detail.readings, fines, assignments, quotes: detail.quotes || [],
  })) {
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  zip.file('סיכום.xlsx', XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));

  const errors = [];
  for (let index = 0; index < documents.length; index += 1) {
    const document = documents[index];
    onProgress?.(index + 1, documents.length);
    try {
      const response = await fetch(await getDocumentUrl(document));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const folder = safeName(DOCUMENT_TYPES[document.doc_type] || document.doc_type);
      const date = String(document.uploaded_at || '').slice(0, 10);
      zip.file(`${folder}/${date}-${safeName(document.original_name || document.id)}`, await response.blob());
    } catch (error) {
      errors.push(`${document.original_name || document.id}: ${error?.message || error}`);
    }
  }
  if (errors.length) zip.file('errors.txt', errors.join('\n'));

  download(await zip.generateAsync({ type: 'blob' }), `${safeName(vehicle.plate_number)}-${stamp()}.zip`);
  return { files: documents.length - errors.length, errors: errors.length };
}
