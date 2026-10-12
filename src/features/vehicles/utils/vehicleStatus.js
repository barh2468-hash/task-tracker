import { EXPIRY_WARNING_DAYS, KINDS_WITHOUT_ODOMETER } from '../constants.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function toDay(value) {
  return new Date(`${String(value).slice(0, 10)}T12:00:00`);
}

export function formatDate(value) {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function todayString(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentMonthString(now = new Date()) {
  return `${todayString(now).slice(0, 7)}-01`;
}

export function daysUntil(dateValue, now = new Date()) {
  if (!dateValue) return null;
  return Math.round((toDay(dateValue) - toDay(todayString(now))) / DAY_MS);
}

/** 'missing' | 'expired' | 'soon' | 'ok' for the latest valid_to of a record set. */
export function expiryLevel(validTo, now = new Date()) {
  if (!validTo) return 'missing';
  const days = daysUntil(validTo, now);
  if (days < 0) return 'expired';
  if (days <= EXPIRY_WARNING_DAYS) return 'soon';
  return 'ok';
}

function latestValidTo(rows) {
  let latest = null;
  for (const row of rows || []) {
    if (row.valid_to && (!latest || row.valid_to > latest)) latest = row.valid_to;
  }
  return latest;
}

/**
 * Collapses the child tables into the per-vehicle summary the list and the
 * alerts dashboard render. Retired vehicles raise no alerts.
 */
export function buildVehicleSummaries({ vehicles, policies, inspections, readings, pendingQuotes = [], now = new Date() }) {
  const group = (rows) => {
    const map = new Map();
    for (const row of rows || []) {
      if (!map.has(row.vehicle_id)) map.set(row.vehicle_id, []);
      map.get(row.vehicle_id).push(row);
    }
    return map;
  };
  const policiesBy = group(policies);
  const inspectionsBy = group(inspections);
  const readingsBy = group(readings);
  const month = currentMonthString(now);
  const quoteVehicles = new Set(pendingQuotes.map((quote) => quote.vehicle_id));

  return (vehicles || []).map((vehicle) => {
    const insuranceValidTo = latestValidTo(policiesBy.get(vehicle.id));
    const inspectionValidTo = latestValidTo(inspectionsBy.get(vehicle.id));
    const needsOdometer =
      vehicle.status !== 'retired' && !KINDS_WITHOUT_ODOMETER.includes(vehicle.kind);
    const odometerReportedThisMonth = (readingsBy.get(vehicle.id) || []).some(
      (reading) => reading.reading_month === month,
    );
    const active = vehicle.status !== 'retired';
    return {
      vehicle,
      insuranceValidTo,
      insuranceLevel: active ? expiryLevel(insuranceValidTo, now) : 'ok',
      inspectionValidTo,
      inspectionLevel: active && vehicle.kind !== 'trailer' ? expiryLevel(inspectionValidTo, now) : 'ok',
      leaseLevel: active && vehicle.lease_end ? expiryLevel(vehicle.lease_end, now) : 'ok',
      odometerMissing: needsOdometer && !odometerReportedThisMonth,
      hasPendingQuote: quoteVehicles.has(vehicle.id),
    };
  });
}

/** Statuses a vehicle passes through before it is handed over and in use. */
export const PRE_ACTIVE_STATUSES = ['expected', 'awaiting_insurance', 'awaiting_handover'];

/** True when some policy is still valid today (an approved quote alone is not enough to hand a vehicle over). */
export function hasActivePolicy(policies, now = new Date()) {
  return (policies || []).some((policy) => policy.valid_to && daysUntil(policy.valid_to, now) >= 0);
}

const isUrgent = (level) => level === 'expired' || level === 'soon';

/** Something actually expired or about to — as opposed to data simply not entered yet. */
export function hasAlert(summary) {
  return (
    isUrgent(summary.insuranceLevel) ||
    isUrgent(summary.inspectionLevel) ||
    isUrgent(summary.leaseLevel)
  );
}

/** Insurance or test (where one applies) has never been entered. */
export function hasMissingData(summary) {
  return (
    summary.insuranceLevel === 'missing' ||
    (summary.inspectionLevel === 'missing' && summary.vehicle.kind !== 'trailer')
  );
}

/** Higher = more urgent; used to float problem vehicles to the top of the list. */
export function attentionScore(summary) {
  const weight = (level) => (level === 'expired' ? 2 : level === 'soon' ? 1 : 0);
  return weight(summary.insuranceLevel) + weight(summary.inspectionLevel) + weight(summary.leaseLevel);
}
