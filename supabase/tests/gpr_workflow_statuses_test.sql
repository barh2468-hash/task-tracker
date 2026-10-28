-- All fixtures are rolled back. Real order statuses are never changed here.
begin;
select set_config('gprstatus.admin',(select id::text from public.profiles where role='admin' limit 1),true);
select set_config('gprstatus.id',gen_random_uuid()::text,true);
select set_config('request.jwt.claim.sub',current_setting('gprstatus.admin'),true);
set local role authenticated;
insert into public.gpr_work_orders(id,title,created_by,source_email,requirements)
values(current_setting('gprstatus.id')::uuid,'Status workflow test',current_setting('gprstatus.admin')::uuid,
  'Original email','[{"key":"plan","done":false,"detail":"Preserve requirement"}]');
do $$ declare stage text;
begin
  foreach stage in array array['new','scheduled','scanning','interpretation','clarification','completed','cancelled'] loop
    update public.gpr_work_orders set status=stage where id=current_setting('gprstatus.id')::uuid;
    if not exists(select 1 from public.gpr_work_orders where id=current_setting('gprstatus.id')::uuid
      and status=stage and source_email='Original email' and requirements->0->>'done'='false') then
      raise exception 'Stage % did not persist independently of original email and checklist',stage;
    end if;
  end loop;
  begin
    update public.gpr_work_orders set status='approval' where id=current_setting('gprstatus.id')::uuid;
    raise exception 'Retired approval status was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.gpr_work_orders set status='invalid' where id=current_setting('gprstatus.id')::uuid;
    raise exception 'Unknown status was accepted';
  exception when check_violation then null;
  end;
end $$;
reset role;
rollback;
select 'All seven GPR statuses persisted; retired/unknown statuses rejected; mail and actions preserved; fixtures rolled back.' as result;
