import test from 'node:test';
import assert from 'node:assert/strict';
import { currentMonthRange, personalAttendanceRows, reportDate } from './personalReport.js';

test('month default respects Israel date and leap-year boundaries', () => {
  assert.deepEqual(currentMonthRange('2024-02-15T08:00:00Z'), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(currentMonthRange('2026-09-30T22:30:00Z'), { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(reportDate('2026-09-30T22:30:00Z'), '2026-10-01');
});
test('personal report excludes colleagues, includes range ends and treats leave as days', () => {
  const sessions = [
    { id: 'other', worker_id: 'colleague', started_at: '2026-10-10T08:00:00Z', ended_at: '2026-10-10T16:00:00Z' },
    { id: 'first', worker_id: 'me', attendance_date: '2026-10-01', started_at: '2026-10-01T08:00:00Z', ended_at: '2026-10-01T09:00:00Z' },
    { id: 'leave', worker_id: 'me', attendance_date: '2026-10-31', started_at: '2026-10-31T08:00:00Z', ended_at: '2026-10-31T16:00:00Z', is_all_day: true },
    { id: 'outside', worker_id: 'me', attendance_date: '2026-09-30', started_at: '2026-09-30T08:00:00Z' },
  ];
  const rows = personalAttendanceRows(sessions, 'me', '2026-10-01', '2026-10-31');
  assert.deepEqual(rows.map((row) => row.id), ['first', 'leave']);
  assert.equal(rows.reduce((sum, row) => sum + row.minutes, 0), 60);
  assert.deepEqual(personalAttendanceRows(sessions, 'me', '2026-11-01', '2026-10-01'), []);
});
