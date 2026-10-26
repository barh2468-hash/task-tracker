const monthStart = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

/** Months a worker can report fuel for: the current one and the previous one (YYYY-MM-01). */
export function fuelMonthOptions(now = new Date()) {
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return [monthStart(now), monthStart(previous)];
}

/** '2026-10-01' or '2026-10' -> '10/2026'. */
export function formatMonth(value) {
  const [year, month] = String(value).split('-');
  return `${month}/${year}`;
}
