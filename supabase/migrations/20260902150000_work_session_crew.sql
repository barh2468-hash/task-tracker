-- Store the employees/helpers selected when project work is completed, and
-- expose a minimal employee directory to authenticated users without widening
-- direct access to the profiles table.

alter table public.work_sessions
  add column if not exists crew_members jsonb not null default '[]'::jsonb;

alter table public.work_sessions
  drop constraint if exists work_sessions_crew_members_array_check;

alter table public.work_sessions
  add constraint work_sessions_crew_members_array_check
  check (jsonb_typeof(crew_members) = 'array');

create or replace function public.get_worker_directory()
returns table (
  id uuid,
  full_name text,
  role text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role
  from public.profiles p
  where auth.uid() is not null
  order by p.full_name;
$$;

revoke all on function public.get_worker_directory() from public;
revoke all on function public.get_worker_directory() from anon;
grant execute on function public.get_worker_directory() to authenticated;
