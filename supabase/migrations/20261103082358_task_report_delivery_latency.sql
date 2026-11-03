-- Independent delivery checkpoints prevent a push retry from resending email.
alter table private.task_report_email_outbox add column notification_id uuid references public.notifications(id) on delete set null;
alter table private.task_report_email_outbox add column push_sent_at timestamptz;
create index task_report_push_pending on private.task_report_email_outbox(next_attempt_at) where push_sent_at is null;
update private.task_report_email_outbox set next_attempt_at=least(next_attempt_at,now());
update private.task_report_email_outbox j set notification_id=(
  select n.id from public.notifications n join public.project_task_reports r on r.id=j.report_id
  where n.recipient_id=j.recipient_id and n.task_id=r.task_id and n.type='task_done'
    and n.body=r.request_title||E'\n'||r.summary
  order by abs(extract(epoch from n.created_at-r.created_at)) limit 1);

create or replace function private.queue_task_report_notifications() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient record; task_creator uuid; notice_id uuid;
begin
  if new.created_by is distinct from (select auth.uid()) then raise exception 'Unauthorized report notification'; end if;
  select created_by into task_creator from public.project_tasks where id=new.task_id;
  for recipient in select distinct p.id from public.profiles p where p.id<>new.created_by and
    (p.role in ('admin','manager') or p.id=task_creator or (new.ready_for_drafting and exists(
      select 1 from public.project_workers w where w.project_id=new.project_id and w.worker_id=p.id
        and (p.role='drafter' or lower(p.full_name) ~ '(^|[[:space:]])(דודי|dudi|dudy)([[:space:]]|$)')))) loop
    insert into public.notifications(recipient_id,type,title,body,project_id,task_id,created_by)
      values(recipient.id,'task_done','דיווח ביצוע משימה',new.request_title||E'\n'||new.summary,new.project_id,new.task_id,new.created_by) returning id into notice_id;
    insert into private.task_report_email_outbox(report_id,recipient_id,notification_id) values(new.id,recipient.id,notice_id);
  end loop;
  return new;
end $$;
revoke all on function private.queue_task_report_notifications() from public,anon,authenticated;

create or replace function public.claim_task_report_emails(p_report_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$
  with pending as (select report_id,recipient_id from private.task_report_email_outbox
    where (sent_at is null or push_sent_at is null) and next_attempt_at<=now()
    and (p_report_id is null or report_id=p_report_id) and (claimed_until is null or claimed_until<now())
    order by created_at for update skip locked limit 25), claimed as (
    update private.task_report_email_outbox j set claimed_until=now()+interval '5 minutes',claim_token=gen_random_uuid(),attempts=attempts+1
    from pending p where j.report_id=p.report_id and j.recipient_id=p.recipient_id returning j.*)
  select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('report',to_jsonb(r),'recipient_email',recipient.email,
    'project_name',pr.name,'worker_name',actor.full_name)), '[]'::jsonb)
    from claimed c join public.project_task_reports r on r.id=c.report_id join public.projects pr on pr.id=r.project_id
    join public.profiles actor on actor.id=r.created_by join public.profiles recipient on recipient.id=c.recipient_id;
$$;
create function public.finish_task_report_delivery(p_report_id uuid,p_recipient_id uuid,p_token uuid,p_email_sent boolean,p_push_done boolean,p_error text default null)
returns void language sql security invoker set search_path='' as $$
  update private.task_report_email_outbox set
    sent_at=case when p_email_sent then coalesce(sent_at,now()) else sent_at end,
    push_sent_at=case when p_push_done then coalesce(push_sent_at,now()) else push_sent_at end,
    claimed_until=case when p_error is not null or ((p_email_sent or sent_at is not null) and (p_push_done or push_sent_at is not null)) then null else claimed_until end,
    last_error=left(p_error,1000),next_attempt_at=case when p_error is not null then now()+least(interval '1 hour',interval '1 minute'*power(2,least(attempts,6))) else next_attempt_at end
    where report_id=p_report_id and recipient_id=p_recipient_id and claim_token=p_token;
$$;
revoke all on function public.finish_task_report_delivery(uuid,uuid,uuid,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.finish_task_report_delivery(uuid,uuid,uuid,boolean,boolean,text) to service_role;

-- Leave enough time for a cold worker to accept its background delivery task.
select cron.alter_job((select jobid from cron.job where jobname='task-report-email-delivery'),
  command:=$job$select net.http_post(url:='https://qopsdkmzvncamjrxjwni.supabase.co/functions/v1/notify-task-done',
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',coalesce(
      (select decrypted_secret from vault.decrypted_secrets where name='maya_cron_secret' limit 1),'')),body:='{}'::jsonb,timeout_milliseconds:=5000);$job$);
