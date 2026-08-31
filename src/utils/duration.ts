export function durationMinutes(startedAt: string, endedAt?: string | null) {
  const started = new Date(startedAt);
  const ended = endedAt ? new Date(endedAt) : new Date();
  return Math.max(0, Math.round((ended.getTime() - started.getTime()) / 60000));
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins} דק׳`;
  return `${hours} שעות ו-${mins} דק׳`;
}

export function formatHoursDecimal(minutes: number) {
  return (minutes / 60).toFixed(2);
}
