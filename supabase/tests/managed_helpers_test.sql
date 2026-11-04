-- Fixtures and all changes are rolled back, including when run against a deployed table.
begin;
set local statement_timeout = '20s';
select set_config('test.helpers_admin', (select id::text from public.profiles where role='admin' limit 1), true);
select set_config('test.helpers_worker', (select id::text from public.profiles where role='field_worker' limit 1), true);
select set_config('test.helpers_demo', (select id::text from public.profiles where role='demo' limit 1), true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.helpers_admin'),'role','authenticated')::text, true);
set local role authenticated;
do $$
declare
  helper_id uuid;
  affected integer;
  snapshot_id uuid;
  snapshot_crew jsonb;
  original_name text := 'Managed helper test ' || gen_random_uuid()::text;
begin
  assert not has_table_privilege('anon','public.crew_helpers','SELECT'), 'Anonymous readers must be denied';
  assert not has_table_privilege('authenticated','public.crew_helpers','DELETE'), 'Helpers cannot be hard deleted';
  select id, crew_members into snapshot_id, snapshot_crew from public.work_sessions where crew_members <> '[]'::jsonb limit 1;
  insert into public.crew_helpers(name) values(original_name) returning id into helper_id;
  assert (select is_active from public.crew_helpers where id=helper_id), 'New helpers must be active';
  begin
    insert into public.crew_helpers(name) values(upper(original_name));
    raise exception 'Duplicate name accepted';
  exception when unique_violation then null; end;
  begin
    update public.crew_helpers set name=' ' where id=helper_id;
    raise exception 'Blank name accepted';
  exception when check_violation then null; end;
  update public.crew_helpers set name=original_name || ' Ω', is_active=false where id=helper_id;
  assert (select name=original_name || ' Ω' and not is_active from public.crew_helpers where id=helper_id), 'Admin rename and deactivation must work';
  if snapshot_id is not null then
    assert (select crew_members is not distinct from snapshot_crew from public.work_sessions where id=snapshot_id), 'Directory changes must never rewrite historical crew';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.helpers_worker'),'role','authenticated')::text, true);
  assert not exists (select 1 from public.crew_helpers where id=helper_id), 'Workers must not see inactive helpers';
  assert exists (select 1 from public.crew_helpers where is_active), 'Workers must see active helper choices';
  begin
    insert into public.crew_helpers(name) values('Unauthorized helper');
    raise exception 'Worker inserted a helper';
  exception when insufficient_privilege then null; end;
  update public.crew_helpers set is_active=false where is_active;
  get diagnostics affected = row_count;
  assert affected=0, 'Workers must not update helpers';
  begin
    delete from public.crew_helpers where id=helper_id;
    raise exception 'Hard delete was accepted';
  exception when insufficient_privilege then null; end;

  if nullif(current_setting('test.helpers_demo',true),'') is not null then
    perform set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.helpers_demo'),'role','authenticated')::text, true);
    assert not exists (select 1 from public.crew_helpers), 'Demo clients must not see staff helpers';
  end if;
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  assert not exists (select 1 from public.crew_helpers), 'Missing identity must not read helpers';
  perform set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('test.helpers_admin'),'role','authenticated')::text, true);
  update public.crew_helpers set is_active=true where id=helper_id;
  assert (select is_active from public.crew_helpers where id=helper_id), 'Admin can reactivate the same helper';
end;
$$;
reset role;
rollback;
select 'Managed helpers: create, rename, deactivate, reactivate, duplicate names, historical snapshots and role restrictions passed; fixtures rolled back' as result;
