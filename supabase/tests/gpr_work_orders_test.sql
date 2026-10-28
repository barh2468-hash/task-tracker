-- All test data and updates are rolled back. Uses existing role identities,
-- without changing users, projects, tasks, notifications or email settings.
begin;
select set_config('gpr.test_admin', (select id::text from public.profiles where role = 'admin' limit 1), true);
select set_config('gpr.test_id', gen_random_uuid()::text, true);
insert into public.gpr_work_orders(id, order_number, client_name, created_by)
values (current_setting('gpr.test_id')::uuid, current_setting('gpr.test_id'), 'GPR integration test', current_setting('gpr.test_admin')::uuid);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('gpr.test_admin'), true);
do $$ begin
  if (select count(*) from public.gpr_work_orders where id = current_setting('gpr.test_id')::uuid) <> 1 then
    raise exception 'Administrator cannot read the order';
  end if;
  update public.gpr_work_orders set status = 'scheduled', requirements = '[{"key":"crew","done":true,"detail":"Test"}]',
    source_subject = 'Electra - Project Depot - GPR - Field preparation'
  where id = current_setting('gpr.test_id')::uuid;
  if not exists (select 1 from public.gpr_work_orders where id = current_setting('gpr.test_id')::uuid and status = 'scheduled') then
    raise exception 'Administrator cannot update the order';
  end if;
  if not exists (select 1 from public.gpr_work_orders where id = current_setting('gpr.test_id')::uuid
    and source_subject = 'Electra - Project Depot - GPR - Field preparation') then
    raise exception 'Original email subject did not round trip';
  end if;
  begin
    insert into public.gpr_work_orders(order_number, client_name, created_by)
    values (current_setting('gpr.test_id'), 'gpr INTEGRATION test ', current_setting('gpr.test_admin')::uuid);
    raise exception 'Duplicate issuer and order number were accepted';
  exception when unique_violation then null;
  end;
  insert into public.gpr_work_orders(order_number, client_name, created_by)
  values (current_setting('gpr.test_id'), 'Different issuer', current_setting('gpr.test_admin')::uuid);
end $$;
reset role;

-- For each non-admin role use a real profile if available, otherwise a missing
-- identity (which must also be denied). No temporary authorization is granted.
do $$ declare
  role_name text; role_user uuid; visible_count integer; changed integer;
begin
  foreach role_name in array array['manager','field_worker','drafter','accounting'] loop
    select id into role_user from public.profiles where role = role_name limit 1;
    perform set_config('request.jwt.claim.sub', coalesce(role_user, gen_random_uuid())::text, true);
    execute 'set local role authenticated';
    select count(*) into visible_count from public.gpr_work_orders;
    if visible_count <> 0 then raise exception 'GPR data leaked to %', role_name; end if;
    update public.gpr_work_orders set notes = 'unauthorized' where id = current_setting('gpr.test_id')::uuid;
    get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'GPR update allowed for %', role_name; end if;
    begin
      insert into public.gpr_work_orders(title, created_by) values ('Unauthorized', role_user);
      raise exception 'GPR insert allowed for %', role_name;
    exception when insufficient_privilege then null;
    end;
    execute 'reset role';
  end loop;
end $$;

set local role anon;
do $$ begin
  begin
    perform count(*) from public.gpr_work_orders;
    raise exception 'Anonymous role can read GPR data';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
select 'Admin read/write, duplicate detection, non-admin read/insert/update and anonymous access passed; test data rolled back.' as result;
