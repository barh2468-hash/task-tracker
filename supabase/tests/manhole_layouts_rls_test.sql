-- Existing accounts are used only as authorization identities. Every test
-- project, sheet, object metadata entry and dispatch reservation is rolled back.
begin;
create temp table sheet_test_fixture as
select gen_random_uuid() project_id, gen_random_uuid() sheet_id,
  (select id from public.profiles where role='field_worker' order by id limit 1) owner_id,
  (select id from public.profiles where role='field_worker' order by id offset 1 limit 1) shared_id,
  (select id from public.profiles where role='field_worker' order by id offset 2 limit 1) outsider_id,
  (select id from public.profiles where role='manager' order by id limit 1) manager_id;
grant select on sheet_test_fixture to authenticated, service_role;
insert into public.projects(id,name,location,assigned_to,created_by)
select project_id,'בדיקת הרשאות פרישה – זמני','בדיקה',owner_id,manager_id from sheet_test_fixture;
insert into public.project_workers(project_id,worker_id)
select project_id,shared_id from sheet_test_fixture;

select set_config('request.jwt.claim.sub',(select owner_id::text from sheet_test_fixture),true);
set local role authenticated;
insert into storage.objects(bucket_id,name)
select 'manhole-layouts',project_id::text||'/'||owner_id::text||'/'||sheet_id::text||'/'||file
from sheet_test_fixture cross join (values ('report.pdf'),('source.json'),('preview.png')) files(file);
insert into public.project_manhole_layouts(id,project_id,created_by,project_name,created_by_name,manhole_number,work_date,file_name,pdf_path,source_path,preview_path,pdf_size)
select sheet_id,project_id,owner_id,'spoofed project','spoofed name','01',current_date,'test.pdf',
 project_id::text||'/'||owner_id::text||'/'||sheet_id::text||'/report.pdf',
 project_id::text||'/'||owner_id::text||'/'||sheet_id::text||'/source.json',
 project_id::text||'/'||owner_id::text||'/'||sheet_id::text||'/preview.png',20 from sheet_test_fixture;
do $$ begin
  if (select count(*) from public.project_manhole_layouts where id=(select sheet_id from sheet_test_fixture))<>1 then raise exception 'Owner cannot read saved sheet'; end if;
  if exists(select 1 from public.project_manhole_layouts where id=(select sheet_id from sheet_test_fixture) and (project_name='spoofed project' or created_by_name='spoofed name')) then raise exception 'Untrusted names were not replaced'; end if;
  if has_table_privilege('authenticated','public.project_manhole_layouts','update') or has_table_privilege('authenticated','public.project_manhole_layouts','delete') then raise exception 'Completed versions are mutable'; end if;
end $$;
-- Storage protects direct SQL DELETE independently of RLS. Client cleanup uses
-- the Storage API and the bucket's incomplete-save-only DELETE policy.

set local role postgres;
select set_config('request.jwt.claim.sub',(select shared_id::text from sheet_test_fixture),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.project_manhole_layouts where id=(select sheet_id from sheet_test_fixture))<>1 then raise exception 'Additional assigned worker cannot read'; end if;
 if (select count(*) from storage.objects where bucket_id='manhole-layouts' and name like (select project_id::text||'/%' from sheet_test_fixture))<>3 then raise exception 'Additional worker cannot read saved files'; end if;
end $$;

set local role postgres;
select set_config('request.jwt.claim.sub',(select outsider_id::text from sheet_test_fixture),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.project_manhole_layouts where id=(select sheet_id from sheet_test_fixture)) then raise exception 'Unassigned worker can read'; end if;
 if exists(select 1 from storage.objects where bucket_id='manhole-layouts' and name like (select project_id::text||'/%' from sheet_test_fixture)) then raise exception 'Unassigned worker can read files'; end if;
 if has_function_privilege('authenticated','public.reserve_manhole_email_request(uuid,uuid,text)','execute') then raise exception 'Client can bypass email rate limit'; end if;
 if has_table_privilege('authenticated','public.manhole_layout_email_requests','select') then raise exception 'Client can read dispatch reservations'; end if;
 begin
   insert into storage.objects(bucket_id,name) select 'manhole-layouts',project_id::text||'/'||outsider_id::text||'/test/report.pdf' from sheet_test_fixture;
   raise exception 'Unassigned worker can upload';
 exception when insufficient_privilege then null; end;
end $$;

set local role postgres;
select set_config('request.jwt.claim.sub',(select manager_id::text from sheet_test_fixture),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.project_manhole_layouts where id=(select sheet_id from sheet_test_fixture))<>1 then raise exception 'Manager cannot read'; end if;
 if has_table_privilege('anon','public.project_manhole_layouts','select') then raise exception 'Anonymous users can read'; end if;
end $$;

set local role postgres;
update public.projects set is_archived=true where id=(select project_id from sheet_test_fixture);
select set_config('request.jwt.claim.sub',(select owner_id::text from sheet_test_fixture),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.project_manhole_layouts where id=(select sheet_id from sheet_test_fixture))<>1 then raise exception 'Archived sheets became unreadable'; end if;
 begin
   insert into storage.objects(bucket_id,name) select 'manhole-layouts',project_id::text||'/'||owner_id::text||'/test/report.pdf' from sheet_test_fixture;
   raise exception 'Archived project can receive new upload';
 exception when insufficient_privilege then null; end;
end $$;

set local role postgres;
set local role service_role;
do $$ declare request uuid := gen_random_uuid(); response jsonb; begin
 response := public.reserve_manhole_email_request(request,(select outsider_id from sheet_test_fixture),'same-payload');
 if (response->>'existing')::boolean then raise exception 'New request returned existing'; end if;
 response := public.reserve_manhole_email_request(request,(select outsider_id from sheet_test_fixture),'same-payload');
 if not (response->>'existing')::boolean then raise exception 'Duplicate request was not reserved once'; end if;
 for i in 1..9 loop perform public.reserve_manhole_email_request(gen_random_uuid(),(select outsider_id from sheet_test_fixture),'payload'); end loop;
 begin
   perform public.reserve_manhole_email_request(gen_random_uuid(),(select outsider_id from sheet_test_fixture),'payload');
   raise exception 'Hourly dispatch rate limit was bypassed';
 exception when raise_exception then if sqlerrm<>'mail_rate_limited' then raise; end if; end;
end $$;
rollback;
select 'Owner, additional worker, manager, outsider, archive, immutable versions and email deduplication/rate limit checks passed; all fixtures rolled back.' as verification;
