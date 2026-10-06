-- Add an administrator role. Administrators inherit manager access through
-- public.is_manager(), while privileged Auth changes remain admin-only in the
-- admin-update-user-email Edge Function.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'field_worker', 'drafter', 'accounting'));

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('manager', 'admin')
  );
$$;

revoke all on function public.is_manager() from public;
revoke all on function public.is_manager() from anon;
grant execute on function public.is_manager() to authenticated;

-- New users may only create their own field-worker profile. Elevated roles
-- must be assigned through a trusted database/admin operation.
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
for insert to authenticated
with check (
  id = (select auth.uid())
  and role = 'field_worker'
  and lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

-- Prevent browser clients from changing identity or authorization fields on
-- their own profile. Calls made with the service role have no auth.uid() and
-- are allowed, which is required by the admin Edge Function.
create or replace function public.protect_profile_identity_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and (
       new.role is distinct from old.role
       or lower(new.email) is distinct from lower(old.email)
     ) then
    raise insufficient_privilege using
      message = 'Profile email and role can only be changed by an administrator';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_identity_fields() from public;
revoke all on function public.protect_profile_identity_fields() from anon;
revoke all on function public.protect_profile_identity_fields() from authenticated;

drop trigger if exists protect_profile_identity_fields on public.profiles;
create trigger protect_profile_identity_fields
before update of email, role on public.profiles
for each row execute function public.protect_profile_identity_fields();

-- Admins receive the same in-app manager notifications as managers.
create or replace function public.create_manager_notifications(
  p_type text,
  p_title text,
  p_body text,
  p_project_id uuid default null,
  p_task_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  insert into public.notifications (recipient_id, type, title, body, project_id, task_id, created_by)
  select id, coalesce(p_type, 'general'), p_title, p_body, p_project_id, p_task_id, (select auth.uid())
  from public.profiles
  where role in ('manager', 'admin');

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.create_manager_notifications(text,text,text,uuid,uuid) from public;
revoke all on function public.create_manager_notifications(text,text,text,uuid,uuid) from anon;
grant execute on function public.create_manager_notifications(text,text,text,uuid,uuid) to authenticated;
