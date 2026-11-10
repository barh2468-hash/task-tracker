-- Three field-worker reminders at 08:00, 08:15 and 08:30 in Asia/Jerusalem.
-- Keep the existing enabled flag, workdays and manager escalation interval.
update public.attendance_reminder_settings
set first_reminder_time = time '08:00:00',
    repeat_after_minutes = 15,
    updated_at = now()
where id = true;
