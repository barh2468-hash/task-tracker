-- Prevent two devices from opening the same worker/project session at once.
-- Existing data is left untouched.

create or replace function public.prevent_duplicate_open_work_session()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ended_at is null then
    perform pg_advisory_xact_lock(hashtextextended(new.worker_id::text || ':' || new.project_id::text, 0));
    if exists (
      select 1 from public.work_sessions
      where worker_id = new.worker_id
        and project_id = new.project_id
        and ended_at is null
    ) then
      raise exception using errcode = '23505', message = 'open_work_session_exists';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_duplicate_open_work_session_trigger on public.work_sessions;
create trigger prevent_duplicate_open_work_session_trigger
before insert on public.work_sessions
for each row execute function public.prevent_duplicate_open_work_session();

