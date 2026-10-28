-- Exercise the same optimistic, partial updates as the checklist API.
-- No real work is changed; all fixtures are rolled back.
begin;
select set_config('gprprogress.admin',(select id::text from public.profiles where role='admin' limit 1),true);
select set_config('gprprogress.id',gen_random_uuid()::text,true);
select set_config('request.jwt.claim.sub',current_setting('gprprogress.admin'),true);
set local role authenticated;
insert into public.gpr_work_orders(id,title,created_by,requirements,source_email,notes,updated_at)
values(current_setting('gprprogress.id')::uuid,'Progress test',current_setting('gprprogress.admin')::uuid,
  '[{"key":"plan","done":false,"detail":"Keep note"},{"key":"crew","done":false,"detail":"Keep crew requirement"}]',
  'Original email','Manual note','2000-01-01T00:00:00Z');
do $$ declare saved_at timestamptz; n integer; r public.gpr_work_orders;
begin
  update public.gpr_work_orders
  set requirements='[{"key":"plan","done":true,"detail":"Keep note"},{"key":"crew","done":false,"detail":"Keep crew requirement"}]'
  where id=current_setting('gprprogress.id')::uuid and updated_at='2000-01-01T00:00:00Z'
  returning updated_at into saved_at;
  if not found then raise exception 'Admin cannot save checklist'; end if;
  update public.gpr_work_orders set requirements='[]'
  where id=current_setting('gprprogress.id')::uuid and updated_at='2000-01-01T00:00:00Z';
  get diagnostics n = row_count;
  if n<>0 then raise exception 'Stale update overwrote a newer checklist'; end if;
  update public.gpr_work_orders set status='completed'
  where id=current_setting('gprprogress.id')::uuid and updated_at=saved_at;
  if not found then raise exception 'Admin cannot complete work'; end if;
  select * into r from public.gpr_work_orders where id=current_setting('gprprogress.id')::uuid;
  if r.source_email<>'Original email' or r.notes<>'Manual note' or r.requirements->0->>'detail'<>'Keep note'
    or r.requirements->1->>'done'<>'false' or r.status<>'completed' then
    raise exception 'Progress update changed original mail, notes or unfinished actions'; end if;
  update public.gpr_work_orders set status='new' where id=r.id and updated_at=r.updated_at;
  if not found then raise exception 'Work cannot reopen'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin
  update public.gpr_work_orders set status='completed' where id=current_setting('gprprogress.id')::uuid;
  if found then raise exception 'Non-admin changed GPR progress'; end if;
end $$;
reset role;
rollback;
select 'Checklist persistence, stale-update protection, complete/reopen and admin permissions passed; fixtures rolled back.' as result;
