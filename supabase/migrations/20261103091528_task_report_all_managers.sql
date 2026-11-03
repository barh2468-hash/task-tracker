-- Every manager receives report emails, including a manager who authored the
-- report. Extra task owners/drafters remain included without self-alerts.
create or replace function private.queue_task_report_notifications() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient record; task_creator uuid; notice_id uuid;
begin
  if new.created_by is distinct from (select auth.uid()) then raise exception 'Unauthorized report notification'; end if;
  select created_by into task_creator from public.project_tasks where id=new.task_id;
  for recipient in select distinct p.id from public.profiles p where
    p.role in ('admin','manager') or (p.id<>new.created_by and
      (p.id=task_creator or (new.ready_for_drafting and exists(
        select 1 from public.project_workers w where w.project_id=new.project_id and w.worker_id=p.id
          and (p.role='drafter' or lower(p.full_name) ~ '(^|[[:space:]])(דודי|dudi|dudy)([[:space:]]|$)'))))) loop
    insert into public.notifications(recipient_id,type,title,body,project_id,task_id,created_by)
      values(recipient.id,'task_done','דיווח ביצוע משימה',new.request_title||E'\n'||new.summary,new.project_id,new.task_id,new.created_by) returning id into notice_id;
    insert into private.task_report_email_outbox(report_id,recipient_id,notification_id) values(new.id,recipient.id,notice_id);
  end loop;
  return new;
end $$;
revoke all on function private.queue_task_report_notifications() from public,anon,authenticated;

-- Project details come from the database, never the request body.
create or replace function public.claim_task_report_emails(p_report_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$
  with pending as (select report_id,recipient_id from private.task_report_email_outbox
    where (sent_at is null or push_sent_at is null) and next_attempt_at<=now()
    and (p_report_id is null or report_id=p_report_id) and (claimed_until is null or claimed_until<now())
    order by created_at for update skip locked limit 25), claimed as (
    update private.task_report_email_outbox j set claimed_until=now()+interval '5 minutes',claim_token=gen_random_uuid(),attempts=attempts+1
    from pending p where j.report_id=p.report_id and j.recipient_id=p.recipient_id returning j.*)
  select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('report',to_jsonb(r),'recipient_email',recipient.email,
    'project_name',pr.name,'client_name',pr.client_name,'location',pr.location,'worker_name',actor.full_name)), '[]'::jsonb)
    from claimed c join public.project_task_reports r on r.id=c.report_id join public.projects pr on pr.id=r.project_id
    join public.profiles actor on actor.id=r.created_by join public.profiles recipient on recipient.id=c.recipient_id;
$$;
revoke all on function public.claim_task_report_emails(uuid) from public,anon,authenticated;
grant execute on function public.claim_task_report_emails(uuid) to service_role;
