create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.attendance_reminder_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  first_reminder_time time not null default '07:30',
  repeat_after_minutes integer not null default 15 check (repeat_after_minutes between 5 and 180),
  escalation_after_minutes integer not null default 30 check (escalation_after_minutes between 10 and 360),
  weekdays integer[] not null default array[0,1,2,3,4],
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.attendance_reminder_settings (id) values (true)
on conflict (id) do nothing;

alter table public.attendance_reminder_settings enable row level security;
drop policy if exists "reminder settings read authenticated" on public.attendance_reminder_settings;
drop policy if exists "reminder settings update managers" on public.attendance_reminder_settings;
create policy "reminder settings read authenticated" on public.attendance_reminder_settings
  for select to authenticated using (true);
create policy "reminder settings update managers" on public.attendance_reminder_settings
  for update to authenticated using (public.is_manager()) with check (public.is_manager());

do $$
declare existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'attendance-check-in-reminders'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  -- The Edge Function performs its own local-time and duplicate checks, so a
  -- five-minute schedule is safe across Israel daylight-saving transitions.
  perform cron.schedule(
    'attendance-check-in-reminders',
    '*/5 * * * *',
    $job$select net.http_post(
      url := 'https://qopsdkmzvncamjrxjwni.supabase.co/functions/v1/attendance-reminder',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
    );$job$
  );
end;
$$;
