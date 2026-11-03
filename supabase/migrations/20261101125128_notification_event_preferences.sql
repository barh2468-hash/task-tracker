-- Account-wide choices for future in-app and Push notifications. Retain the
-- internal event row so existing email outboxes and audit references stay valid.
create table public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('status_changes','assignments','work_started','work_ended',
    'attendance_updates','attendance_reminders','new_tasks','completed_tasks','drawings','documents',
    'continuation_reports','gpr','vehicles','chat','other')),
  enabled boolean not null default true,
  primary key (user_id, category)
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;
create policy "Read own notification preferences" on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Insert own notification preferences" on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Update own notification preferences" on public.notification_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.notification_preference_category(event_type text)
returns text language sql immutable security invoker set search_path = '' as $$
  select case
    when event_type = 'chat_message' then 'chat'
    when starts_with(event_type, 'gpr_') then 'gpr'
    when starts_with(event_type, 'vehicle_') then 'vehicles'
    when event_type = 'work_started' then 'work_started'
    when event_type = 'work_ended' then 'work_ended'
    when starts_with(event_type, 'attendance_reminder_') or event_type = 'attendance_missing_escalation' then 'attendance_reminders'
    when starts_with(event_type, 'attendance_') then 'attendance_updates'
    when event_type in ('status_change','manager_project_status_changed') then 'status_changes'
    when event_type in ('project_assigned','drafter_assigned','project_drafter_assigned') then 'assignments'
    when event_type = 'task_done' then 'completed_tasks'
    when starts_with(event_type, 'task_') then 'new_tasks'
    when starts_with(event_type, 'continuation_') then 'continuation_reports'
    when event_type in ('photo_deleted','project_document_uploaded','drawing_document_uploaded') then 'documents'
    when starts_with(event_type, 'drawing_') or starts_with(event_type, 'project_review_') or event_type = 'daily_drafting_ready' then 'drawings'
    else 'other' end;
$$;
revoke all on function public.notification_preference_category(text) from public, anon;
grant execute on function public.notification_preference_category(text) to authenticated, service_role;

alter table public.notifications add column delivery_enabled boolean not null default true;
create schema if not exists private;
create function private.apply_notification_preference()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.delivery_enabled := not exists (
    select 1 from public.notification_preferences pref
    where pref.user_id = new.recipient_id
      and pref.category = public.notification_preference_category(new.type)
      and not pref.enabled
  );
  return new;
end;
$$;
revoke all on function private.apply_notification_preference() from public, anon, authenticated;
create trigger apply_notification_preference before insert on public.notifications
  for each row execute function private.apply_notification_preference();

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'notification_preferences') then
    alter publication supabase_realtime add table public.notification_preferences;
  end if;
end $$;
