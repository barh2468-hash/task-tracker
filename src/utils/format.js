export function durationMinutes(startedAt, endedAt) {
  const started = new Date(startedAt);
  const ended = endedAt ? new Date(endedAt) : new Date();
  return Math.max(0, Math.round((ended.getTime() - started.getTime()) / 60000));
}

export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} דק׳`;
  return `${hours} ש׳ ${mins} דק׳`;
}

export function formatHoursDecimal(minutes) {
  return (minutes / 60).toFixed(2);
}

export function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function mapsLink(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return '';
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function formatLocation(location) {
  const accuracy = typeof location.accuracy === 'number' ? ` · דיוק כ-${location.accuracy} מ׳` : '';
  return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}${accuracy}`;
}

export function toDateInputValue(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function toLocalDateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function getMonthRange(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end),
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
  };
}

export function sessionStartedInRange(item, fromDate, toDate) {
  const started = item.started_at.slice(0, 10);
  return (!fromDate || started >= fromDate) && (!toDate || started <= toDate);
}
