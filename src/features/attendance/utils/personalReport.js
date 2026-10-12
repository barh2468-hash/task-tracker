const israelDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' });

export function reportDate(value = new Date()) {
  return israelDate.format(new Date(value));
}

export function currentMonthRange(value = new Date()) {
  const today = reportDate(value);
  const [year, month] = today.split('-').map(Number);
  return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}` };
}

export function personalAttendanceRows(sessions, userId, from, to, now = new Date()) {
  if (!from || !to || from > to) return [];
  return sessions.filter((item) => {
    const date = item.attendance_date || reportDate(item.started_at);
    return item.worker_id === userId && date >= from && date <= to;
  }).map((item) => ({
    ...item,
    date: item.attendance_date || reportDate(item.started_at),
    minutes: item.is_all_day ? 0 : Math.max(0, Math.round((new Date(item.ended_at || now) - new Date(item.started_at)) / 60000)),
  })).sort((a, b) => a.date.localeCompare(b.date) || new Date(a.started_at) - new Date(b.started_at));
}
