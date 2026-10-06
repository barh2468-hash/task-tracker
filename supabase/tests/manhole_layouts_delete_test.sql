-- Run after the deletion migration. All rows, role changes and tombstones are
-- transient: rollback at the end leaves real layouts untouched.
begin;
create temp table deletion_fixture as
select gen_random_uuid() project_id, gen_random_uuid() original_id, gen_random_uuid() revision_id,
  (select id from public.profiles where role='field_worker' order by id limit 1) owner_id,
  (select id from public.profiles where role='field_worker' order by id offset 1 limit 1) shared_id,
  (select id from public.profiles where role='field_worker' order by id offset 2 limit 1) outsider_id,
  (select id from public.profiles where role='manager' order by id limit 1) manager_id;
grant select on deletion_fixture to authenticated;
insert into public.projects(id,name,location,assigned_to,created_by)
select project_id,'בדיקת מחיקת פרישות – זמני','בדיקה',owner_id,manager_id from deletion_fixture;
insert into public.project_workers(project_id,worker_id) select project_id,shared_id from deletion_fixture;
select set_config('request.jwt.claim.sub',(select owner_id::text from deletion_fixture),true);
set local role authenticated;
insert into storage.objects(bucket_id,name)
select 'manhole-layouts',project_id::text||'/'||owner_id::text||'/'||original_id::text||'/'||file
from deletion_fixture cross join (values ('report.pdf'),('source.json'),('preview.png')) files(file);
insert into public.project_manhole_layouts(id,project_id,created_by,manhole_number,work_date,file_name,pdf_path,source_path,preview_path,pdf_size)
select original_id,project_id,owner_id,'09',current_date,'original.pdf',
  project_id::text||'/'||owner_id::text||'/'||original_id::text||'/report.pdf',
  project_id::text||'/'||owner_id::text||'/'||original_id::text||'/source.json',
  project_id::text||'/'||owner_id::text||'/'||original_id::text||'/preview.png',20 from deletion_fixture;
insert into public.project_manhole_layouts(id,project_id,created_by,manhole_number,work_date,file_name,pdf_path,source_path,preview_path,pdf_size,revision_of)
select revision_id,project_id,owner_id,'09',current_date,'revision.pdf',
  project_id::text||'/'||owner_id::text||'/'||revision_id::text||'/report.pdf',
  project_id::text||'/'||owner_id::text||'/'||revision_id::text||'/source.json',
  project_id::text||'/'||owner_id::text||'/'||revision_id::text||'/preview.png',20,original_id from deletion_fixture;
do $$ begin
  if has_table_privilege('authenticated','public.project_manhole_layouts','update') or has_table_privilege('authenticated','public.project_manhole_layouts','delete') then raise exception 'Direct mutation granted'; end if;
  if has_function_privilege('anon','public.delete_manhole_layout(uuid)','execute') or has_function_privilege('anon','private.delete_manhole_layout(uuid)','execute') then raise exception 'Anonymous deletion granted'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select shared_id::text from deletion_fixture),true);
set local role authenticated;
do $$ begin
  begin perform public.delete_manhole_layout((select original_id from deletion_fixture)); raise exception 'Teammate deleted another creator layout'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select outsider_id::text from deletion_fixture),true);
set local role authenticated;
do $$ begin
  begin perform public.delete_manhole_layout((select original_id from deletion_fixture)); raise exception 'Outsider deleted a layout'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Losing an assignment also revokes the creator's delete permission.
update public.projects set assigned_to=(select shared_id from deletion_fixture) where id=(select project_id from deletion_fixture);
select set_config('request.jwt.claim.sub',(select owner_id::text from deletion_fixture),true);
set local role authenticated;
do $$ begin
  begin perform public.delete_manhole_layout((select original_id from deletion_fixture)); raise exception 'Unassigned creator deleted a layout'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.projects set assigned_to=(select owner_id from deletion_fixture),is_archived=true where id=(select project_id from deletion_fixture);
set local role authenticated;
do $$ begin
  if public.delete_manhole_layout((select original_id from deletion_fixture)) <> (select original_id from deletion_fixture) then raise exception 'Creator could not delete'; end if;
  if public.delete_manhole_layout((select original_id from deletion_fixture)) <> (select original_id from deletion_fixture) then raise exception 'Retry not idempotent'; end if;
  if exists(select 1 from public.project_manhole_layouts where id=(select original_id from deletion_fixture)) then raise exception 'Deleted layout remains visible'; end if;
  if not exists(select 1 from public.project_manhole_layouts where id=(select revision_id from deletion_fixture)) then raise exception 'Other version removed'; end if;
  if exists(select 1 from storage.objects where name like (select project_id::text||'/%' from deletion_fixture)) then raise exception 'Deleted layout attachments remain readable'; end if;
  if not private.is_saved_manhole_file((select project_id::text||'/'||owner_id::text||'/'||original_id::text||'/report.pdf' from deletion_fixture)) then raise exception 'Retained PDF vulnerable to incomplete-upload cleanup'; end if;
end $$;
reset role;
do $$ begin
  if not exists(select 1 from public.project_manhole_layouts where id=(select original_id from deletion_fixture) and deleted_at is not null and deleted_by=(select owner_id from deletion_fixture)) then raise exception 'Deletion actor missing'; end if;
  if (select revision_of from public.project_manhole_layouts where id=(select revision_id from deletion_fixture)) <> (select original_id from deletion_fixture) then raise exception 'Revision link broken'; end if;
  if (select count(*) from storage.objects where name like (select project_id::text||'/%' from deletion_fixture)) <> 3 then raise exception 'Retained files physically removed'; end if;
end $$;
select set_config('request.jwt.claim.sub',(select manager_id::text from deletion_fixture),true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.project_manhole_layouts where id=(select original_id from deletion_fixture)) then raise exception 'Deleted layout visible to manager'; end if;
  perform public.delete_manhole_layout((select revision_id from deletion_fixture));
  if exists(select 1 from public.project_manhole_layouts where id=(select revision_id from deletion_fixture)) then raise exception 'Manager deletion failed'; end if;
end $$;
reset role;
select 'Creator/manager deletion, denied teammate/outsider/unassigned creator, idempotent retry, hidden attachments and preserved revisions passed; fixtures rolled back' as result;
rollback;
