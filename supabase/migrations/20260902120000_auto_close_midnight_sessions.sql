-- Automatically close forgotten project and general-attendance sessions at
-- local midnight in Israel. The function is also safe to call from the app as
-- an idempotent recovery path after a device has been offline.

create or replace function public.close_stale_work_sessions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  local_midnight timestamptz := (
    (now() at time zone 'Asia/Jerusalem')::date::timestamp
    at time zone 'Asia/Jerusalem'
  );
  closed_project_sessions integer := 0;
  closed_attendance_sessions integer := 0;
begin
  update public.work_sessions
  set
    ended_at = local_midnight,
    ended_lat = null,
    ended_lng = null,
    ended_accuracy = null,
    end_note = coalesce(end_note, 'סיום אוטומטי בחצות')
  where ended_at is null
    and started_at < local_midnight;
  get diagnostics closed_project_sessions = row_count;

  update public.attendance_sessions
  set
    ended_at = local_midnight,
    ended_lat = null,
    ended_lng = null,
    ended_accuracy = null,
    end_note = coalesce(end_note, 'סיום אוטומטי בחצות')
  where ended_at is null
    and not is_all_day
    and started_at < local_midnight;
  get diagnostics closed_attendance_sessions = row_count;

  return jsonb_build_object(
    'closed_project_sessions', closed_project_sessions,
    'closed_attendance_sessions', closed_attendance_sessions,
    'ended_at', local_midnight
  );
end;
$$;

revoke all on function public.close_stale_work_sessions() from public;
revoke all on function public.close_stale_work_sessions() from anon;
grant execute on function public.close_stale_work_sessions() to authenticated;
grant execute on function public.close_stale_work_sessions() to service_role;

create extension if not exists pg_cron;

-- Israel midnight is 21:00 UTC during daylight saving time and 22:00 UTC
-- during standard time. The function checks the local date, so the extra run
-- is harmless and keeps the schedule correct across DST changes.
do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'auto-close-midnight-work-sessions'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'auto-close-midnight-work-sessions',
    '0 21,22 * * *',
    'select public.close_stale_work_sessions();'
  );
end;
$$;

-- Repair sessions that were already left open across a previous midnight.
select public.close_stale_work_sessions();
