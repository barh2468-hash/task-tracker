create table public.project_task_reports (
  id uuid primary key,
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  outcome text not null check (outcome in ('completed','partial','blocked','reopened')),
  summary text not null check (length(btrim(summary)) between 5 and 4000),
  next_steps text not null default '' check (length(next_steps) <= 4000),
  ready_for_drafting boolean not null default false,
  review_impact text not null default 'no_change' check (review_impact in ('no_change','changes_review','unsure')),
  document_ids uuid[] not null default '{}',
  attachments jsonb not null default '[]',
  file_reference text not null default '' check (length(file_reference) <= 1000),
  request_title text not null,
  request_description text,
  language text not null default 'he' check (language in ('he','en','el','pt')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  drawing_batch_id uuid references public.project_drawing_batches(id) on delete set null,
  check (outcome not in ('partial','blocked') or length(btrim(next_steps)) >= 5),
  check (not ready_for_drafting or outcome in ('completed','partial'))
);
create index task_reports_task_created on public.project_task_reports(task_id,created_at desc);
create index task_reports_project on public.project_task_reports(project_id);
alter table public.project_tasks add column latest_report_id uuid references public.project_task_reports(id) on delete set null;
alter table public.project_task_reports enable row level security;
revoke all on public.project_task_reports from public,anon,authenticated;
grant select,insert on public.project_task_reports to authenticated;
grant all on public.project_task_reports to service_role;
create policy "task reports read related" on public.project_task_reports for select to authenticated
  using (exists(select 1 from public.project_tasks t where t.id=task_id));
create policy "task reports insert assigned" on public.project_task_reports for insert to authenticated
  with check (created_by=(select auth.uid()) and exists(select 1 from public.project_tasks t
    join public.projects p on p.id=t.project_id where t.id=task_id and p.id=project_task_reports.project_id and not p.is_archived
    and ((select public.is_manager()) or (exists(select 1 from public.profiles a where a.id=(select auth.uid()) and a.role='field_worker')
      and (p.assigned_to=(select auth.uid()) or exists(select 1 from public.project_workers w where w.project_id=p.id and w.worker_id=(select auth.uid())))))));

-- Trigger validation also applies to direct REST inserts. Reports are immutable.
create function private.prepare_task_report() returns trigger language plpgsql security invoker set search_path='' as $$
declare task_row public.project_tasks; project_row public.projects;
begin
  if (select auth.uid()) is null or new.created_by is distinct from (select auth.uid()) then
    raise exception 'Unauthorized task report' using errcode='42501'; end if;
  select * into strict task_row from public.project_tasks where id=new.task_id for update;
  select * into strict project_row from public.projects where id=task_row.project_id;
  if new.project_id<>project_row.id or project_row.is_archived then raise exception 'Invalid report project'; end if;
  if not (select public.is_manager()) and not exists(select 1 from public.profiles a where a.id=(select auth.uid()) and a.role='field_worker'
    and (project_row.assigned_to=a.id or exists(select 1 from public.project_workers w where w.project_id=project_row.id and w.worker_id=a.id))) then
    raise exception 'Only assigned field workers or managers can report' using errcode='42501'; end if;
  if task_row.is_done and new.outcome<>'reopened' then raise exception 'Reopen the task before reporting again' using errcode='40001'; end if;
  if not task_row.is_done and new.outcome='reopened' then raise exception 'Task is already open' using errcode='40001'; end if;
  if cardinality(new.document_ids)>10 or exists(select 1 from unnest(new.document_ids) d(id)
    where not exists(select 1 from public.project_documents doc where doc.id=d.id and doc.project_id=new.project_id)) then
    raise exception 'Invalid report documents'; end if;
  new.created_at:=clock_timestamp();
  new.request_title:=task_row.title;
  new.request_description:=task_row.description;
  new.drawing_batch_id:=null;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'file_name',d.file_name,'file_path',d.file_path)), '[]'::jsonb)
    into new.attachments from public.project_documents d where d.id=any(new.document_ids);
  if new.ready_for_drafting then
    insert into public.project_drawing_batches(project_id,work_date,update_type,review_impact,summary,created_by,assigned_drafter,source_project_status)
      values(new.project_id,(now() at time zone 'Asia/Jerusalem')::date,'addition',new.review_impact,
        left(new.request_title || E'\n' || new.summary,2000),new.created_by,
        (select w.worker_id from public.project_workers w join public.get_worker_directory() d on d.id=w.worker_id
          where w.project_id=new.project_id and (d.role='drafter' or lower(d.full_name) ~ '(^|[[:space:]])(דודי|dudi|dudy)([[:space:]]|$)') order by w.worker_id limit 1),project_row.status)
      returning id into new.drawing_batch_id;
  end if;
  return new;
end $$;
revoke all on function private.prepare_task_report() from public,anon,authenticated;
create trigger prepare_task_report before insert on public.project_task_reports for each row execute function private.prepare_task_report();

create function private.apply_task_report() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  update public.project_tasks set is_done=(new.outcome='completed'),latest_report_id=new.id,updated_at=new.created_at where id=new.task_id;
  insert into public.status_history(project_id,old_status,new_status,changed_by,note)
    values(new.project_id,null,'דיווח ביצוע משימה',new.created_by,new.request_title || E'\n' || new.summary || case when new.next_steps<>'' then E'\n' || new.next_steps else '' end);
  return new;
end $$;
revoke all on function private.apply_task_report() from public,anon,authenticated;
create trigger apply_task_report after insert on public.project_task_reports for each row execute function private.apply_task_report();

-- Stop legacy checkbox calls from closing a task without an actual report.
create function private.require_task_completion_report() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (new.is_done is distinct from old.is_done or new.latest_report_id is distinct from old.latest_report_id) and not exists(
    select 1 from public.project_task_reports r where r.id=new.latest_report_id and r.task_id=new.id and (r.outcome='completed')=new.is_done
      and (not old.is_done or new.is_done or r.outcome='reopened')
      and r.created_by=(select auth.uid()) and r.id is distinct from old.latest_report_id) then
    raise exception 'A completion report is required';
  end if;
  return new;
end $$;
revoke all on function private.require_task_completion_report() from public,anon,authenticated;
create trigger require_task_completion_report before update on public.project_tasks for each row execute function private.require_task_completion_report();

create function public.submit_task_report(p_report jsonb,p_expected_report_id uuid default null)
returns public.project_task_reports language plpgsql security invoker set search_path='' as $$
declare task_row public.project_tasks; result public.project_task_reports;
begin
  select * into strict task_row from public.project_tasks where id=(p_report->>'task_id')::uuid for update;
  select * into result from public.project_task_reports where id=(p_report->>'id')::uuid;
  if found then
    if result.created_by is distinct from (select auth.uid()) or result.task_id<>task_row.id
      or result.outcome<>p_report->>'outcome' or result.summary<>p_report->>'summary'
      or result.next_steps<>coalesce(p_report->>'next_steps','')
      or result.document_ids is distinct from array(select jsonb_array_elements_text(coalesce(p_report->'document_ids','[]'))::uuid)
      or result.review_impact<>coalesce(p_report->>'review_impact','no_change')
      or result.ready_for_drafting<>coalesce((p_report->>'ready_for_drafting')::boolean,false)
      or result.file_reference<>coalesce(p_report->>'file_reference','') then raise exception 'Report ID already used'; end if;
    return result;
  end if;
  if task_row.latest_report_id is distinct from p_expected_report_id then raise exception 'Task changed; refresh before reporting' using errcode='40001'; end if;
  insert into public.project_task_reports(id,task_id,project_id,outcome,summary,next_steps,ready_for_drafting,review_impact,document_ids,file_reference,request_title,language,created_by)
    values((p_report->>'id')::uuid,task_row.id,task_row.project_id,p_report->>'outcome',p_report->>'summary',coalesce(p_report->>'next_steps',''),
      coalesce((p_report->>'ready_for_drafting')::boolean,false),coalesce(p_report->>'review_impact','no_change'),
      array(select jsonb_array_elements_text(coalesce(p_report->'document_ids','[]'))::uuid),coalesce(p_report->>'file_reference',''),'',
      coalesce(p_report->>'language','he'),(select auth.uid())) returning * into result;
  return result;
end $$;
revoke all on function public.submit_task_report(jsonb,uuid) from public,anon;
grant execute on function public.submit_task_report(jsonb,uuid) to authenticated;

create table private.task_report_email_outbox (
  report_id uuid not null references public.project_task_reports(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),sent_at timestamptz,claimed_until timestamptz,claim_token uuid,
  attempts integer not null default 0,next_attempt_at timestamptz not null default now(),last_error text,
  primary key(report_id,recipient_id)
);
alter table private.task_report_email_outbox enable row level security;
revoke all on private.task_report_email_outbox from public,anon,authenticated;
grant usage on schema private to service_role;
grant all on private.task_report_email_outbox to service_role;
create index task_report_outbox_pending on private.task_report_email_outbox(next_attempt_at) where sent_at is null;

-- Privileged only to address other users' notifications and the private outbox.
create function private.queue_task_report_notifications() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient record; task_creator uuid; delivery_allowed boolean;
begin
  if new.created_by is distinct from (select auth.uid()) then raise exception 'Unauthorized report notification'; end if;
  select created_by into task_creator from public.project_tasks where id=new.task_id;
  for recipient in select distinct p.id from public.profiles p where p.id<>new.created_by and
    (p.role in ('admin','manager') or p.id=task_creator or (new.ready_for_drafting and exists(
      select 1 from public.project_workers w where w.project_id=new.project_id and w.worker_id=p.id
        and (p.role='drafter' or lower(p.full_name) ~ '(^|[[:space:]])(דודי|dudi|dudy)([[:space:]]|$)')))) loop
    insert into public.notifications as notice(recipient_id,type,title,body,project_id,task_id)
      values(recipient.id,'task_done','דיווח ביצוע משימה',new.request_title || E'\n' || new.summary,new.project_id,new.task_id)
      returning coalesce((to_jsonb(notice)->>'delivery_enabled')::boolean,true) into delivery_allowed;
    if delivery_allowed then
      insert into private.task_report_email_outbox(report_id,recipient_id) values(new.id,recipient.id);
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.queue_task_report_notifications() from public,anon,authenticated;
create trigger queue_task_report_notifications after insert on public.project_task_reports for each row execute function private.queue_task_report_notifications();

create function public.claim_task_report_emails(p_report_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$
  with pending as (select report_id,recipient_id from private.task_report_email_outbox where sent_at is null and next_attempt_at<=now()
    and (p_report_id is null or report_id=p_report_id) and (claimed_until is null or claimed_until<now())
    order by created_at for update skip locked limit 5), claimed as (
    update private.task_report_email_outbox j set claimed_until=now()+interval '5 minutes',claim_token=gen_random_uuid(),attempts=attempts+1
    from pending p where j.report_id=p.report_id and j.recipient_id=p.recipient_id returning j.*)
  select coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object('report',to_jsonb(r),'recipient_email',recipient.email,
    'project_name',pr.name,'worker_name',actor.full_name)), '[]'::jsonb)
    from claimed c join public.project_task_reports r on r.id=c.report_id join public.projects pr on pr.id=r.project_id
    join public.profiles actor on actor.id=r.created_by join public.profiles recipient on recipient.id=c.recipient_id;
$$;
create function public.finish_task_report_email(p_report_id uuid,p_recipient_id uuid,p_token uuid,p_error text default null)
returns void language sql security invoker set search_path='' as $$
  update private.task_report_email_outbox set sent_at=case when p_error is null then now() else null end,
    claimed_until=null,last_error=left(p_error,1000),next_attempt_at=now()+least(interval '1 hour',interval '1 minute'*power(2,least(attempts,6)))
    where report_id=p_report_id and recipient_id=p_recipient_id and claim_token=p_token and sent_at is null;
$$;
revoke all on function public.claim_task_report_emails(uuid),public.finish_task_report_email(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_task_report_emails(uuid),public.finish_task_report_email(uuid,uuid,uuid,text) to service_role;
select cron.schedule('task-report-email-delivery','* * * * *', $job$
  select net.http_post(url:='https://qopsdkmzvncamjrxjwni.supabase.co/functions/v1/notify-task-done',
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',coalesce(
      (select decrypted_secret from vault.decrypted_secrets where name='maya_cron_secret' limit 1),'')),body:='{}'::jsonb);
$job$);
