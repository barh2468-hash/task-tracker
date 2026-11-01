-- Synthetic accounts and projects only; all fixtures are rolled back.
begin;
select set_config('demo_test.viewer', gen_random_uuid()::text, true);
select set_config('demo_test.other', gen_random_uuid()::text, true);
select set_config('demo_test.manager', gen_random_uuid()::text, true);
select set_config('demo_test.allowed', gen_random_uuid()::text, true);
select set_config('demo_test.hidden', gen_random_uuid()::text, true);
select set_config('demo_test.draft', gen_random_uuid()::text, true);
insert into auth.users(id,email)
select current_setting('demo_test.'||key)::uuid, current_setting('demo_test.'||key)||'@example.invalid'
from unnest(array['viewer','other','manager']) key;
insert into public.profiles(id,email,full_name,role)
select current_setting('demo_test.'||key)::uuid, current_setting('demo_test.'||key)||'@example.invalid', 'Demo test '||key,
  case when key='manager' then 'manager' else 'demo' end
from unnest(array['viewer','other','manager']) key;
insert into public.projects(id,name,location,assigned_to)
select current_setting('demo_test.'||key)::uuid, 'Private operational '||key, 'Private location', current_setting('demo_test.viewer')::uuid
from unnest(array['allowed','hidden','draft']) key;
insert into public.demo_project_showcases(project_id,title,is_published)
select current_setting('demo_test.'||key)::uuid, 'Curated '||key, key <> 'draft'
from unnest(array['allowed','hidden','draft']) key;
insert into public.demo_project_access(user_id,project_id) values
  (current_setting('demo_test.viewer')::uuid,current_setting('demo_test.allowed')::uuid),
  (current_setting('demo_test.viewer')::uuid,current_setting('demo_test.draft')::uuid),
  (current_setting('demo_test.other')::uuid,current_setting('demo_test.hidden')::uuid);
insert into public.demo_case_studies(project_id,title,file_path,file_name,file_size)
select current_setting('demo_test.'||key)::uuid, 'Case '||key,
  current_setting('demo_test.'||key)||'/00000000-0000-4000-8000-000000000001.pdf','case.pdf',12
from unnest(array['allowed','hidden','draft']) key;
insert into public.demo_case_study_media(case_study_id,file_path,caption,caption_en)
select id,project_id::text||'/00000000-0000-4000-8000-000000000004.webp','תמונת ממצא','Survey image'
from public.demo_case_studies where project_id in (
  current_setting('demo_test.allowed')::uuid,current_setting('demo_test.hidden')::uuid,current_setting('demo_test.draft')::uuid
);
insert into storage.objects(bucket_id,name)
select 'demo-case-studies',file_path from public.demo_case_studies where project_id in (
  current_setting('demo_test.allowed')::uuid,current_setting('demo_test.hidden')::uuid,current_setting('demo_test.draft')::uuid
);
insert into storage.objects(bucket_id,name)
select 'demo-case-studies',file_path from public.demo_case_study_media where case_study_id in (
  select id from public.demo_case_studies where project_id in (
    current_setting('demo_test.allowed')::uuid,current_setting('demo_test.hidden')::uuid,current_setting('demo_test.draft')::uuid
  )
);
update public.demo_case_studies set challenge='Approved challenge',work_process='Approved approach',solution='Approved solution',outcome='Approved outcome'
where project_id=current_setting('demo_test.allowed')::uuid;

select set_config('request.jwt.claim.sub',current_setting('demo_test.viewer'),true);
set local role authenticated;
do $$ declare item record; total bigint; begin
  if not private.is_demo() or public.is_manager() then raise exception 'Incorrect role resolution'; end if;
  if (select count(*) from public.demo_project_showcases) <> 1
     or not exists(select 1 from public.demo_project_showcases where project_id=current_setting('demo_test.allowed')::uuid) then
    raise exception 'Demo sees unapproved or unpublished projects';
  end if;
  if (select count(*) from public.demo_case_studies) <> 1 then raise exception 'Case study isolation failed'; end if;
  if (select count(*) from public.demo_case_study_media) <> 1 then raise exception 'Case study image isolation failed'; end if;
  update public.demo_case_study_media set caption='Unauthorized';
  if found then raise exception 'Demo modified image captions'; end if;
  if not exists(select 1 from public.demo_case_studies where challenge='Approved challenge' and outcome='Approved outcome') then
    raise exception 'Authorized article content unavailable'; end if;
  update public.demo_case_studies set challenge='Unauthorized article edit';
  if found then raise exception 'Demo modified article content'; end if;
  if (select count(*) from public.demo_project_access) <> 2 then raise exception 'Other user grants leaked'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'Employee directory leaked'; end if;
  if (select count(*) from storage.objects) <> 2 then raise exception 'Storage isolation failed'; end if;
  -- Every operational table must deny reads even when assigned to this demo.
  for item in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
      and c.relname not in ('profiles','demo_project_showcases','demo_project_access','demo_case_studies','demo_case_study_media')
      and has_table_privilege(current_user,c.oid,'select')
  loop
    begin
      execute format('select count(*) from public.%I',item.relname) into total;
      if total <> 0 then raise exception 'Operational data leaked from %',item.relname; end if;
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    insert into public.demo_project_access(user_id,project_id) values(current_setting('demo_test.viewer')::uuid,current_setting('demo_test.hidden')::uuid);
    raise exception 'Demo self-granted access';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.demo_case_studies(project_id,title,file_path,file_name,file_size)
    values(current_setting('demo_test.allowed')::uuid,'Unauthorized upload',current_setting('demo_test.allowed')||'/00000000-0000-4000-8000-000000000002.pdf','bad.pdf',10);
    raise exception 'Demo inserted a case study';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values('demo-case-studies',current_setting('demo_test.allowed')||'/00000000-0000-4000-8000-000000000003.pdf');
    raise exception 'Demo uploaded a PDF';
  exception when insufficient_privilege then null; end;
  update public.demo_project_showcases set title='Unauthorized';
  if found then raise exception 'Demo changed a showcase'; end if;
  delete from public.demo_case_studies;
  if found then raise exception 'Demo deleted a case study'; end if;
  begin
    delete from storage.objects where bucket_id='demo-case-studies';
    if found then raise exception 'Demo deleted a PDF'; end if;
  exception when insufficient_privilege then null; end;
  update public.profiles set full_name='Unauthorized';
  if found then raise exception 'Demo modified own profile'; end if;
  -- Definer RPCs must not bypass the read-only boundary.
  begin
    perform public.create_manager_notifications('test','test','test');
    raise exception 'Demo sent a notification through an RPC';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_chat_conversation(array[current_setting('demo_test.manager')::uuid],'test');
    raise exception 'Demo created a conversation through an RPC';
  exception when insufficient_privilege then null; end;
  begin
    perform public.close_stale_work_sessions();
    raise exception 'Demo closed employee sessions';
  exception when insufficient_privilege then null; end;
  begin
    select count(*) into total from public.get_worker_directory();
    if total <> 0 then raise exception 'Directory RPC leaked staff'; end if;
  exception when insufficient_privilege then null; end;
  begin
    select count(*) into total from public.worker_available_vehicles();
    if total <> 0 then raise exception 'Vehicle RPC leaked fleet'; end if;
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- A second customer must see only their separately approved project.
select set_config('request.jwt.claim.sub',current_setting('demo_test.other'),true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.demo_project_showcases) <> 1 or not exists(
    select 1 from public.demo_project_showcases where project_id=current_setting('demo_test.hidden')::uuid
  ) then raise exception 'Cross-customer project isolation failed'; end if;
end $$;
reset role;

-- Manager can edit, publish and grant; staff RPC behavior is retained.
select set_config('request.jwt.claim.sub',current_setting('demo_test.manager'),true);
set local role authenticated;
do $$ begin
  if not public.is_manager() then raise exception 'Manager access regressed'; end if;
  if (select count(*) from public.get_worker_directory()) < 3 then raise exception 'Manager directory regressed'; end if;
  update public.demo_project_showcases set title='Manager edited' where project_id=current_setting('demo_test.allowed')::uuid;
  if not found then raise exception 'Manager cannot edit showcase'; end if;
  update public.demo_case_studies set outcome='Manager edited outcome' where project_id=current_setting('demo_test.allowed')::uuid;
  if not found then raise exception 'Manager cannot edit article'; end if;
  delete from public.demo_project_access where user_id=current_setting('demo_test.viewer')::uuid;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('demo_test.viewer'),true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.demo_project_showcases) or exists(select 1 from public.demo_case_studies) or exists(select 1 from public.demo_case_study_media)
    or exists(select 1 from storage.objects) then raise exception 'Revoked access remains effective'; end if;
end $$;
reset role;
rollback;
select 'Demo project isolation, read-only access, RPCs, storage and revocation passed; fixtures rolled back.' as result;
