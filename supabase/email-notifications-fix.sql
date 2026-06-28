-- Email notification support for status changes by field workers.
-- Run once in Supabase SQL Editor.
-- No new role is added. Existing roles remain: manager / field_worker.

create or replace function public.is_manager()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'manager'
  );
$$;

grant execute on function public.is_manager() to authenticated;

-- Optional safety: make sure the role constraint stays only manager / field_worker.
do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%role%';

  if constraint_name is not null then
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.profiles
add constraint profiles_role_check
check (role in ('manager', 'field_worker'));
