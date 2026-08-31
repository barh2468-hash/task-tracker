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
    month: `${year}-${String(month + 1).padStart(2, "0")}`,
  };
}

export function sessionStartedInRange(
  item: { started_at: string },
  fromDate: string,
  toDate: string,
) {
  const started = item.started_at.slice(0, 10);
  return (!fromDate || started >= fromDate) && (!toDate || started <= toDate);
}

export function daysBetween(dateText: string | null | undefined) {
  if (!dateText) return 0;
  const date = new Date(dateText);
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}
