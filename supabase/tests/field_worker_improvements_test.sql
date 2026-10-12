-- All fixtures, notifications, queues and reports are rolled back.
begin;
set local statement_timeout = '20s';
select set_config('test.manager', (select id::text from public.profiles where role in ('manager','admin') limit 1), true);
select set_config('test.worker', (select id::text from public.profiles where role='field_worker' order by id limit 1), true);
select set_config('test.other', (select id::text from public.profiles where role='field_worker' order by id offset 1 limit 1), true);
select set_config('test.drafter', (select id::text from public.profiles where role='drafter' limit 1), true);
select set_config('test.project', gen_random_uuid()::text, true);
select set_config('test.session', gen_random_uuid()::text, true);
select set_config('test.note', gen_random_uuid()::text, true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.manager'),'role','authenticated')::text, true);
set local role authenticated;
insert into public.projects(id,name,location,assigned_to,created_by,status)
  values(current_setting('test.project')::uuid,'Transactional test project','Test location',current_setting('test.worker')::uuid,current_setting('test.manager')::uuid,'בעבודה בשטח');
insert into public.project_workers(project_id,worker_id,assigned_by)
  values(current_setting('test.project')::uuid,current_setting('test.other')::uuid,current_setting('test.manager')::uuid);
insert into public.project_workers(project_id,worker_id,assigned_by)
  values(current_setting('test.project')::uuid,current_setting('test.drafter')::uuid,current_setting('test.manager')::uuid);
update public.projects set status='עבר לשרטוט' where id=current_setting('test.project')::uuid;
reset role;
do $$ begin
  if (select count(*) from public.notifications where project_id=current_setting('test.project')::uuid and type='project_drafter_assigned') <> 2 then raise exception 'Drafter assignment must notify both field workers'; end if;
  if (select count(*) from public.notifications where project_id=current_setting('test.project')::uuid and type='manager_project_status_changed') <> 1 then raise exception 'Manager status change must notify responsible worker once'; end if;
  if (select count(*) from private.field_project_update_outbox where project_id=current_setting('test.project')::uuid) <> 3 then raise exception 'All three field notifications must queue delivery'; end if;
  if has_function_privilege('authenticated','public.claim_field_project_updates(integer)','execute') or has_table_privilege('authenticated','private.field_project_update_outbox','select') then raise exception 'Outbox must be inaccessible to employees'; end if;
end $$;

select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.worker'),'role','authenticated')::text, true);
set local role authenticated;
insert into public.personal_notes(id,owner_id,project_id,title,body)
  values(current_setting('test.note')::uuid,current_setting('test.worker')::uuid,current_setting('test.project')::uuid,'Private test note','Personal text');
insert into public.work_sessions(id,project_id,worker_id,started_at)
  values(current_setting('test.session')::uuid,current_setting('test.project')::uuid,current_setting('test.worker')::uuid,now()-interval '1 hour');
update public.work_sessions set ended_at=now(),end_note='Daily field measurements',daily_drafting_ready=true where id=current_setting('test.session')::uuid;
select public.update_my_work_session_crew(current_setting('test.session')::uuid,'[{"id":null,"name":"Test helper","source":"helper"}]'::jsonb);
update public.work_sessions set crew_members=crew_members where id=current_setting('test.session')::uuid;
do $$ begin
  if (select count(*) from public.project_drawing_batches where work_session_id=current_setting('test.session')::uuid) <> 1 then raise exception 'Closing and editing must create exactly one daily batch'; end if;
  if (select status from public.projects where id=current_setting('test.project')::uuid) <> 'עבר לשרטוט' then raise exception 'Daily batch must preserve project status'; end if;
  if (select end_note from public.work_sessions where id=current_setting('test.session')::uuid) <> 'Daily field measurements' then raise exception 'Crew edits must preserve end note'; end if;
  if (select count(*) from public.status_history where project_id=current_setting('test.project')::uuid and new_status='עודכן צוות לאחר סיום') <> 1 then raise exception 'Crew edit audit missing'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.other'),'role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.personal_notes where id=current_setting('test.note')::uuid) then raise exception 'Personal note visible to colleague'; end if;
  begin
    perform public.update_my_work_session_crew(current_setting('test.session')::uuid,'[]'::jsonb);
    raise exception 'Colleague edited another worker crew';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.manager'),'role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.personal_notes where id=current_setting('test.note')::uuid) then raise exception 'Personal note visible to manager'; end if;
end $$;
update public.projects set is_archived=true where id=current_setting('test.project')::uuid;
reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.worker'),'role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  if not exists(select 1 from public.projects where id=current_setting('test.project')::uuid and is_archived) then raise exception 'Assigned worker must retain archive access'; end if;
  if not exists(select 1 from public.personal_notes where id=current_setting('test.note')::uuid) then raise exception 'Owner must retain private note'; end if;
end $$;
reset role;
rollback;
select 'Field notifications, daily drawing, crew permissions, note privacy and archive access passed; fixtures rolled back' as result;
