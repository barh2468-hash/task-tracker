-- Internal notifications + worker task completion permissions.
-- Run once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'general',
  title text not null,
  body text,
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.project_tasks(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(recipient_id, is_read, created_at desc);

alter table public.notifications enable row level security;

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

drop policy if exists "notifications read own" on public.notifications;
drop policy if exists "notifications update own" on public.notifications;
drop policy if exists "notifications delete own" on public.notifications;

create policy "notifications read own" on public.notifications
for select using (recipient_id = auth.uid());

create policy "notifications update own" on public.notifications
for update using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy "notifications delete own" on public.notifications
for delete using (recipient_id = auth.uid());

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
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.notifications (recipient_id, type, title, body, project_id, task_id, created_by)
  select id, coalesce(p_type, 'general'), p_title, p_body, p_project_id, p_task_id, auth.uid()
  from public.profiles
  where role = 'manager';

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.create_user_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_project_id uuid default null,
  p_task_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.notifications (recipient_id, type, title, body, project_id, task_id, created_by)
  values (p_user_id, coalesce(p_type, 'general'), p_title, p_body, p_project_id, p_task_id, auth.uid())
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.create_manager_notifications(text,text,text,uuid,uuid) to authenticated;
grant execute on function public.create_user_notification(uuid,text,text,text,uuid,uuid) to authenticated;

-- Allow managers to update tasks and allow the assigned field worker to mark tasks done/open.
drop policy if exists "tasks update managers" on public.project_tasks;
drop policy if exists "tasks update managers or assigned worker" on public.project_tasks;

create policy "tasks update managers or assigned worker" on public.project_tasks
for update using (
  public.is_manager()
  or exists (
    select 1 from public.projects pr
    where pr.id = project_id
      and pr.assigned_to = auth.uid()
  )
)
with check (
  public.is_manager()
  or exists (
    select 1 from public.projects pr
    where pr.id = project_id
      and pr.assigned_to = auth.uid()
  )
);

do $$
begin
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.project_tasks; exception when duplicate_object then null; end;
end $$;
