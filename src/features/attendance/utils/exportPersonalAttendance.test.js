import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createPersonalAttendanceWorkbook } from './exportPersonalAttendance.js';

test('Excel roundtrip preserves personal range, Israel dates, leave, open hours and separate project totals', async () => {
  const now = new Date('2026-10-12T08:00:00Z');
  const workbook = await createPersonalAttendanceWorkbook({ userId: 'me', workerName: 'עובד בדיקה', from: '2026-10-01', to: '2026-10-31', now,
    attendance: [
      { worker_id: 'me', started_at: '2026-09-30T22:30:00Z', ended_at: '2026-09-30T23:30:00Z', attendance_type: 'field', end_note: '=SUM(A1:A2)' },
      { worker_id: 'me', started_at: '2026-10-12T07:00:00Z', attendance_type: 'office' },
      { worker_id: 'me', attendance_date: '2026-10-31', started_at: '2026-10-31T08:00:00Z', ended_at: '2026-10-31T16:00:00Z', attendance_type: 'sick', is_all_day: true },
      { worker_id: 'other', attendance_date: '2026-10-10', started_at: '2026-10-10T08:00:00Z', ended_at: '2026-10-10T16:00:00Z', attendance_type: 'field' },
      { worker_id: 'me', attendance_date: '2026-09-29', started_at: '2026-09-29T08:00:00Z', ended_at: '2026-09-29T16:00:00Z', attendance_type: 'field' },
    ],
    work: [
      { worker_id: 'me', started_at: '2026-10-12T05:00:00Z', ended_at: '2026-10-12T06:00:00Z', projects: { name: 'העבודה המאוחרת' } },
      { worker_id: 'me', started_at: '2026-09-30T22:30:00Z', ended_at: '2026-09-30T23:00:00Z', projects: { name: 'הפרויקט שלי' }, crew_members: [{ name: 'עוזר' }], end_note: 'הערת סיום' },
      { worker_id: 'other', started_at: '2026-10-10T08:00:00Z', ended_at: '2026-10-10T16:00:00Z', projects: { name: 'פרויקט של עובד אחר' } },
      { worker_id: 'me', started_at: '2026-10-12T07:00:00Z', projects: { name: 'פרויקט פתוח' } },
    ],
  });
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
  assert.deepEqual(loaded.worksheets.map((sheet) => sheet.name), ['נוכחות אישית', 'עבודה בפרויקטים']);
  const attendance = loaded.getWorksheet('נוכחות אישית'), projects = loaded.getWorksheet('עבודה בפרויקטים');
  assert.equal(attendance.rowCount, 9);
  assert.equal(attendance.getCell('E4').result, 2);
  assert.equal(attendance.getCell('E4').formula, 'SUM(E7:E9)');
  assert.equal(attendance.getCell('F9').value, 'יום מלא');
  assert.equal(attendance.getCell('E9').value, null);
  assert.equal(attendance.getCell('F8').value, 'פתוח');
  assert.equal(attendance.getCell('E8').value, 1);
  assert.deepEqual([7, 8, 9].map((row) => attendance.getCell(`A${row}`).value.toISOString().slice(0, 10)), ['2026-10-01', '2026-10-12', '2026-10-31']);
  assert.equal(attendance.getCell('C7').numFmt, 'hh:mm');
  const exportedTime = attendance.getCell('C7').value;
  assert.ok(exportedTime instanceof Date);
  assert.equal(exportedTime.getUTCHours(), 1);
  assert.equal(exportedTime.getUTCMinutes(), 30);
  assert.equal(attendance.getCell('G7').type, ExcelJS.ValueType.String);
  assert.equal(attendance.getCell('G7').value, '=SUM(A1:A2)');
  assert.equal(projects.rowCount, 8);
  assert.equal(projects.getCell('E4').result, 1.5);
  assert.equal(projects.getCell('B7').value, 'הפרויקט שלי');
  assert.equal(projects.getCell('B8').value, 'העבודה המאוחרת');
  assert.equal(projects.getCell('F7').value, 'עוזר');
  assert.equal(projects.getCell('G7').value, 'הערת סיום');
  assert.equal(attendance.views[0].rightToLeft, true);
});

test('empty and reversed ranges cannot produce a misleading report', async () => {
  const options = { attendance: [], work: [], userId: 'me', from: '2026-10-01', to: '2026-10-31' };
  await assert.rejects(createPersonalAttendanceWorkbook(options), /אין נתונים/);
  await assert.rejects(createPersonalAttendanceWorkbook({ ...options, from: '2026-11-01' }), /טווח תאריכים/);
});
