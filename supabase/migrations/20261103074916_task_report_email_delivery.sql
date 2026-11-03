-- Notification switches govern in-app/Push alerts. Preserve the existing
-- independent delivery of transactional task emails for every recipient.
create or replace function private.queue_task_report_notifications() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient record; task_creator uuid;
begin
  if new.created_by is distinct from (select auth.uid()) then raise exception 'Unauthorized report notification'; end if;
  select created_by into task_creator from public.project_tasks where id=new.task_id;
  for recipient in select distinct p.id from public.profiles p where p.id<>new.created_by and
    (p.role in ('admin','manager') or p.id=task_creator or (new.ready_for_drafting and exists(
      select 1 from public.project_workers w where w.project_id=new.project_id and w.worker_id=p.id
        and (p.role='drafter' or lower(p.full_name) ~ '(^|[[:space:]])(דודי|dudi|dudy)([[:space:]]|$)')))) loop
    insert into public.notifications(recipient_id,type,title,body,project_id,task_id)
      values(recipient.id,'task_done','דיווח ביצוע משימה',new.request_title || E'\n' || new.summary,new.project_id,new.task_id);
    insert into private.task_report_email_outbox(report_id,recipient_id) values(new.id,recipient.id);
  end loop;
  return new;
end $$;
revoke all on function private.queue_task_report_notifications() from public,anon,authenticated;
