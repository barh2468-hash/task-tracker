begin;
set local statement_timeout='20s';
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from public.profiles where role='admin' order by id limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $$
<<test>>
declare
 admin_id uuid:=auth.uid(); worker_id uuid; outsider_id uuid; pr_id uuid; task_id uuid; other_task uuid; doc_id uuid:=gen_random_uuid();
 report_id uuid:=gen_random_uuid(); complete_id uuid:=gen_random_uuid(); reopened_id uuid:=gen_random_uuid();
 result public.project_task_reports; data jsonb;
begin
 select id into strict worker_id from public.profiles where role='field_worker' order by id limit 1;
 select id into strict outsider_id from public.profiles where role='field_worker' and id<>worker_id order by id limit 1;
 insert into public.projects(name,location,created_by,assigned_to) values('Task report regression','Test',admin_id,worker_id) returning id into pr_id;
 insert into public.project_tasks(project_id,title,description,created_by) values(pr_id,'Original request','Explain both pipes',admin_id) returning id into task_id;
 insert into public.project_tasks(project_id,title,created_by) values(pr_id,'Still open',admin_id) returning id into other_task;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',worker_id,'role','authenticated')::text,true);
 insert into public.project_documents(id,project_id,uploaded_by,file_path,file_name,file_size,document_type)
 values(doc_id,pr_id,worker_id,pr_id||'/'||worker_id||'/test.pdf','תמונה & sketch.pdf',100,'drawing_source');
 data:=jsonb_build_object('id',report_id,'task_id',task_id,'outcome','partial','summary',E'נבדק הקו הראשון\nSecond line unchanged <b>',
   'next_steps','Need access to second pipe','ready_for_drafting',true,'document_ids',jsonb_build_array(doc_id),'language','el');
 select * into result from public.submit_task_report(data);
 assert result.summary=data->>'summary' and result.request_description='Explain both pipes', 'Report must preserve worker text and request snapshot';
 assert not (select is_done from public.project_tasks where id=task_id), 'Partial work must stay open';
 assert result.drawing_batch_id is not null and jsonb_array_length(result.attachments)=1, 'Partial work can create a drawing batch with attachment references';
 assert (select status='בעבודה בשטח' from public.projects where id=pr_id), 'Reporting must preserve project workflow status';
 assert (select count(*)=1 from public.project_task_reports where id=report_id), 'One report must be saved';
 perform public.submit_task_report(data);
 assert (select count(*)=1 from public.project_drawing_batches where project_id=pr_id), 'Retries must not create another drawing batch';
 begin
  perform public.submit_task_report(jsonb_build_object('id',gen_random_uuid(),'task_id',task_id,'outcome','completed','summary','A stale report'));
  raise exception 'A stale report was accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.submit_task_report(jsonb_build_object('id',gen_random_uuid(),'task_id',task_id,'outcome','partial','summary','Some work'),report_id);
  raise exception 'Partial report without follow-up was accepted';
 exception when check_violation then null; end;
 begin
  update public.project_tasks set is_done=true where id=other_task;
  raise exception 'Legacy checkbox could complete a task';
 exception when raise_exception then if sqlerrm<>'A completion report is required' then raise; end if; end;
 select * into result from public.submit_task_report(jsonb_build_object('id',complete_id,'task_id',task_id,'outcome','completed','summary','Both pipes measured'),report_id);
 assert (select is_done from public.project_tasks where id=task_id), 'Completed report must close task';
 select * into result from public.submit_task_report(jsonb_build_object('id',reopened_id,'task_id',task_id,'outcome','reopened','summary','Please verify depth again'),complete_id);
 assert not (select is_done from public.project_tasks where id=task_id), 'Reopening must preserve previous reports and reopen the task';
 assert (select count(*)=3 from public.project_task_reports r where r.task_id=test.task_id), 'History must be immutable across reopening';
 assert not has_table_privilege('authenticated','public.project_task_reports','UPDATE'), 'Reports must not be editable';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider_id,'role','authenticated')::text,true);
 assert not exists(select 1 from public.project_task_reports r where r.task_id=test.task_id), 'Unassigned workers must not read reports';
 begin
  perform public.submit_task_report(jsonb_build_object('id',gen_random_uuid(),'task_id',task_id,'outcome','completed','summary','Unauthorized report'),reopened_id);
  raise exception 'An unassigned worker could report';
 exception when no_data_found or insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 assert exists(select 1 from public.notifications n where n.task_id=test.task_id and n.recipient_id=admin_id and n.type='task_done'), 'Requester/manager must receive the report notification';
 perform public.submit_task_report(jsonb_build_object('id',gen_random_uuid(),'task_id',other_task,'outcome','completed','summary','Manager completed this task'));
 delete from public.project_tasks where id=other_task;
 assert not exists(select 1 from public.project_tasks where id=other_task), 'Managers must still be able to delete a completed task';
 perform set_config('task_report_test.report_id',report_id::text,true);
end $$;
reset role;
do $$ begin
 assert exists(select 1 from private.task_report_email_outbox), 'Reports must queue durable email jobs';
 assert not has_function_privilege('authenticated','public.claim_task_report_emails(uuid)','EXECUTE'), 'Only service role can claim email jobs';
end $$;
set local role service_role;
do $$
declare jobs jsonb; job jsonb; retried jsonb;
begin
 jobs:=public.claim_task_report_emails(current_setting('task_report_test.report_id')::uuid);
 assert jsonb_array_length(jobs)>0, 'Email delivery must be claimable';
 job:=jobs->0;
 perform public.finish_task_report_email((job->>'report_id')::uuid,(job->>'recipient_id')::uuid,gen_random_uuid(),null);
 assert not exists(select 1 from private.task_report_email_outbox j where j.report_id=(job->>'report_id')::uuid and j.recipient_id=(job->>'recipient_id')::uuid and j.sent_at is not null), 'Wrong claim token cannot acknowledge delivery';
 perform public.finish_task_report_email((job->>'report_id')::uuid,(job->>'recipient_id')::uuid,(job->>'claim_token')::uuid,'SMTP unavailable');
 assert exists(select 1 from private.task_report_email_outbox j where j.report_id=(job->>'report_id')::uuid and j.recipient_id=(job->>'recipient_id')::uuid and j.sent_at is null and j.last_error='SMTP unavailable'), 'Failed email must stay queued';
 update private.task_report_email_outbox j set next_attempt_at=now() where j.report_id=(job->>'report_id')::uuid and j.recipient_id=(job->>'recipient_id')::uuid;
 retried:=public.claim_task_report_emails(current_setting('task_report_test.report_id')::uuid);
 select value into job from jsonb_array_elements(retried) where value->>'recipient_id'=job->>'recipient_id';
 assert job is not null, 'Failed delivery must be retried';
 perform public.finish_task_report_email((job->>'report_id')::uuid,(job->>'recipient_id')::uuid,(job->>'claim_token')::uuid,null);
 assert exists(select 1 from private.task_report_email_outbox j where j.report_id=(job->>'report_id')::uuid and j.recipient_id=(job->>'recipient_id')::uuid and j.sent_at is not null), 'Delivered emails must be acknowledged';
end $$;
reset role;
rollback;
select 'Task reports: required detail, partial follow-up, attachments, drawing handoff, unchanged project status, idempotency, stale edits, completion guard, reopening, history and durable notifications verified; fixtures rolled back' as result;
