-- Additive field-worker features. No existing projects or reports are rewritten.
create table public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  project_id uuid references public.projects(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  body text not null check (char_length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index personal_notes_owner_updated_idx on public.personal_notes(owner_id, updated_at desc);
create index personal_notes_project_idx on public.personal_notes(project_id) where project_id is not null;
alter table public.personal_notes enable row level security;
revoke all on public.personal_notes from anon, authenticated;
grant select, insert, update, delete on public.personal_notes to authenticated;
create policy "notes read own" on public.personal_notes for select to authenticated using (owner_id = (select auth.uid()));
create policy "notes insert own" on public.personal_notes for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "notes update own" on public.personal_notes for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "notes delete own" on public.personal_notes for delete to authenticated using (owner_id = (select auth.uid()));

create or replace function private.prepare_personal_note() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  -- Existing notes remain editable when project access is subsequently removed.
  if new.project_id is not null and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id) then
    if not exists (select 1 from public.projects where id = new.project_id) then
      raise exception 'Project is not accessible' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.prepare_personal_note() from public, anon, authenticated;
create trigger prepare_personal_note before insert or update on public.personal_notes for each row execute function private.prepare_personal_note();

-- A narrow invoker RPC edits only the caller's closed session crew, with an audit record.
create or replace function public.update_my_work_session_crew(p_session_id uuid, p_crew_members jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  work_row public.work_sessions;
  clean_crew jsonb;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into work_row from public.work_sessions where id = p_session_id and worker_id = (select auth.uid()) for update;
  if not found or work_row.ended_at is null then raise exception 'Only your own closed work session can be edited' using errcode = '42501'; end if;
  if p_crew_members is null or jsonb_typeof(p_crew_members) <> 'array' then raise exception 'Crew must be an array'; end if;
  if jsonb_array_length(p_crew_members) > 100 then raise exception 'Too many crew members'; end if;
  if exists (select 1 from jsonb_array_elements(p_crew_members) member where jsonb_typeof(member) <> 'object'
    or coalesce(member->>'source','') not in ('system','helper') or coalesce(length(trim(member->>'name')),0) not between 1 and 120
    or (member->>'source' = 'system' and not exists (select 1 from public.get_worker_directory() d where d.id::text = member->>'id' and d.id <> work_row.worker_id)))
  then raise exception 'Invalid crew member'; end if;
  select coalesce(jsonb_agg(distinct jsonb_build_object(
    'id', case when member->>'source' = 'system' then member->>'id' else null end,
    'name', case when member->>'source' = 'system' then (select d.full_name from public.get_worker_directory() d where d.id::text = member->>'id') else trim(member->>'name') end,
    'source', member->>'source')), '[]'::jsonb) into clean_crew from jsonb_array_elements(p_crew_members) member;
  if work_row.crew_members is not distinct from clean_crew then return; end if;
  update public.work_sessions set crew_members = clean_crew where id = p_session_id and worker_id = (select auth.uid());
  insert into public.status_history(project_id, old_status, new_status, changed_by, note)
    values(work_row.project_id, null, 'עודכן צוות לאחר סיום', (select auth.uid()),
      'רישום ' || p_session_id || ' · צוות קודם: ' || work_row.crew_members::text || ' · צוות מעודכן: ' || clean_crew::text);
end;
$$;
revoke all on function public.update_my_work_session_crew(uuid,jsonb) from public, anon;
grant execute on function public.update_my_work_session_crew(uuid,jsonb) to authenticated;

alter table public.work_sessions add column daily_drafting_ready boolean not null default false;
alter table public.project_drawing_batches add column work_session_id uuid references public.work_sessions(id) on delete set null;
create unique index drawing_batches_work_session_key on public.project_drawing_batches(work_session_id) where work_session_id is not null;
create or replace function private.create_daily_drawing_batch() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare project_row public.projects; actor_id uuid := (select auth.uid());
begin
  if old.ended_at is not null or new.ended_at is null or not new.daily_drafting_ready then return new; end if;
  if actor_id is null or (new.worker_id <> actor_id and not (select public.is_manager())) then raise exception 'Unauthorized daily drafting request' using errcode = '42501'; end if;
  select * into strict project_row from public.projects where id = new.project_id;
  insert into public.project_drawing_batches(project_id, work_date, update_type, review_impact, summary, created_by, source_project_status, work_session_id)
    values(new.project_id, (new.started_at at time zone 'Asia/Jerusalem')::date, 'addition', 'no_change',
      left('ניתן לשרטט את העבודה שבוצעה היום. ' || coalesce(new.end_note,''),2000), actor_id, project_row.status, new.id);
  perform public.create_manager_notifications('daily_drafting_ready', 'עבודת היום מוכנה לשרטוט: ' || project_row.name,
    'נוצרה מנת שרטוט עבור עבודת היום. סטטוס הפרויקט נשמר. ' || coalesce(new.end_note,''), new.project_id, null);
  return new;
end;
$$;
revoke all on function private.create_daily_drawing_batch() from public, anon, authenticated;
create trigger create_daily_drawing_batch after update on public.work_sessions for each row execute function private.create_daily_drawing_batch();

-- Field notifications are recorded with the change itself, including offline sync.
-- The durable, private outbox keeps email failures from cancelling the project edit.
create table private.field_project_update_outbox (
  id uuid primary key references public.notifications(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null, body text not null,
  created_at timestamptz not null default now(),
  attempts integer not null default 0,
  claimed_until timestamptz,
  claim_token uuid,
  email_sent_at timestamptz,
  delivered_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error text
);
alter table private.field_project_update_outbox enable row level security;
revoke all on private.field_project_update_outbox from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, update on private.field_project_update_outbox to service_role;
create index field_update_outbox_pending_idx on private.field_project_update_outbox(next_attempt_at) where delivered_at is null;

create or replace function private.queue_field_project_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := (select auth.uid()); actor_name text; project_row public.projects;
  event_title text; event_body text; event_type text; worker_id uuid; notification_id uuid; drafter_name text;
begin
  if actor_id is null or not (select public.is_manager()) then return new; end if;
  select full_name into actor_name from public.profiles where id = actor_id;
  if tg_table_name = 'projects' then
    if new.status is not distinct from old.status or new.assigned_to is null then return new; end if;
    project_row := new;
    event_type := 'manager_project_status_changed';
    event_title := 'עדכון סטטוס: ' || new.name;
    event_body := actor_name || ' שינה את סטטוס הפרויקט: ' || old.status || ' → ' || new.status;
  else
    select full_name into drafter_name from public.profiles where id = new.worker_id and
      (role = 'drafter' or lower(full_name) ~ '(^|[[:space:]])(דודי|dudi|dudy)([[:space:]]|$)');
    if not found then return new; end if;
    select * into strict project_row from public.projects where id = new.project_id;
    event_type := 'project_drafter_assigned';
    event_title := 'שויך שרטט לפרויקט: ' || project_row.name;
    event_body := actor_name || ' שייך את השרטט ' || drafter_name || ' לפרויקט ' || project_row.name;
  end if;
  for worker_id in
    select distinct id from public.profiles where role = 'field_worker' and
      (id = project_row.assigned_to or (tg_table_name = 'project_workers' and exists
        (select 1 from public.project_workers pw where pw.project_id = project_row.id and pw.worker_id = profiles.id)))
  loop
    insert into public.notifications(recipient_id,type,title,body,project_id,created_by)
      values(worker_id,event_type,event_title,event_body,project_row.id,actor_id) returning id into notification_id;
    insert into private.field_project_update_outbox(id,recipient_id,project_id,title,body)
      values(notification_id,worker_id,project_row.id,event_title,event_body);
  end loop;
  return new;
end;
$$;
revoke all on function private.queue_field_project_update() from public, anon, authenticated;
create trigger queue_field_project_status_update after update of status on public.projects for each row execute function private.queue_field_project_update();
create trigger queue_field_project_drafter_update after insert on public.project_workers for each row execute function private.queue_field_project_update();

create or replace function public.claim_field_project_updates(p_limit integer default 5)
returns jsonb language sql security invoker set search_path = '' as $$
  with pending as (
    select id from private.field_project_update_outbox where delivered_at is null and next_attempt_at <= now()
      and (claimed_until is null or claimed_until < now()) order by created_at for update skip locked limit least(greatest(p_limit,1),10)
  ), claimed as (update private.field_project_update_outbox jobs set claimed_until = now() + interval '3 minutes', claim_token = gen_random_uuid(), attempts = attempts + 1
    from pending where jobs.id = pending.id returning jobs.*)
  select coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) from claimed;
$$;
create or replace function public.finish_field_project_update(p_id uuid, p_claim_token uuid, p_email_sent boolean, p_done boolean, p_error text default null)
returns void language sql security invoker set search_path = '' as $$
  update private.field_project_update_outbox set
    email_sent_at = case when p_email_sent then coalesce(email_sent_at,now()) else email_sent_at end,
    delivered_at = case when p_done then now() else delivered_at end,
    claimed_until = case when p_done or p_error is not null then null else claimed_until end,
    next_attempt_at = case when p_error is not null then now() + least(interval '1 hour', interval '1 minute' * power(2,least(attempts,6))) else next_attempt_at end,
    last_error = left(p_error,1000)
  where id = p_id and claim_token = p_claim_token;
$$;
revoke all on function public.claim_field_project_updates(integer) from public, anon, authenticated;
revoke all on function public.finish_field_project_update(uuid,uuid,boolean,boolean,text) from public, anon, authenticated;
grant execute on function public.claim_field_project_updates(integer) to service_role;
grant execute on function public.finish_field_project_update(uuid,uuid,boolean,boolean,text) to service_role;

select cron.schedule('field-project-update-delivery','* * * * *', $job$
  select net.http_post(url := 'https://qopsdkmzvncamjrxjwni.supabase.co/functions/v1/send-field-project-updates',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',coalesce(
      (select decrypted_secret from vault.decrypted_secrets where name='maya_cron_secret' limit 1),'')), body := '{}'::jsonb);
$job$);
