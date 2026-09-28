-- Add 'accounting' as a valid profiles.role value.
-- This migration was previously applied directly to the linked project and
-- is kept locally so Git and the remote migration history remain aligned.

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
check (role in ('manager', 'field_worker', 'drafter', 'accounting'));
