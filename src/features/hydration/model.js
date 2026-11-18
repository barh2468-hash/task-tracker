const reminderEmail = 'eyal@maya-tm.com';
const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jerusalem',
  weekday: 'short',
});

export function shouldShowHydrationReminder(email, now = new Date()) {
  if (typeof email !== 'string' || email.trim().toLowerCase() !== reminderEmail) return false;
  return weekdayFormatter.format(now) === 'Wed';
}
