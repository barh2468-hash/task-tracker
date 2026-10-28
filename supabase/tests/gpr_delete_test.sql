-- No real work is deleted; all fixtures and mail/notification changes roll back.
begin;
select set_config('gprdelete.admin',(select id::text from public.profiles where role='admin' limit 1),true);
select set_config('gprdelete.id',gen_random_uuid()::text,true);
insert into public.gpr_work_orders(id,title,order_number,client_name,created_by,source_email,updated_at)
values(current_setting('gprdelete.id')::uuid,'Delete fixture',gen_random_uuid()::text,'Delete test',
  current_setting('gprdelete.admin')::uuid,'Original mail','2000-01-01T00:00:00Z');
insert into public.notifications(recipient_id,type,title,gpr_order_id)
values(current_setting('gprdelete.admin')::uuid,'gpr_email_order_received','Delete fixture',current_setting('gprdelete.id')::uuid);
select set_config('request.jwt.claim.sub',current_setting('gprdelete.admin'),true);
set local role authenticated;
do $$ declare r public.gpr_work_orders;
begin
  r:=public.set_gpr_order_deleted(current_setting('gprdelete.id')::uuid,'2000-01-01T00:00:00Z',true);
  if r.deleted_at is null or r.deleted_by<>current_setting('gprdelete.admin')::uuid or r.source_email<>'Original mail' then
    raise exception 'Recoverable deletion lost ownership or original mail'; end if;
  if exists(select 1 from public.notifications where gpr_order_id=r.id and not is_read) then
    raise exception 'Deleted order still has unread notification'; end if;
  begin
    perform public.set_gpr_order_deleted(r.id,'2000-01-01T00:00:00Z',false);
    raise exception 'Stale restore accepted';
  exception when serialization_failure then null; end;
  r:=public.set_gpr_order_deleted(r.id,r.updated_at,false);
  if r.deleted_at is not null or r.deleted_by is not null or r.source_email<>'Original mail' then
    raise exception 'Restore did not preserve the work'; end if;
end $$;
reset role;
-- A later mail for a deleted order attaches to the retained record, never recreates it.
select set_config('gprdelete.connection',coalesce((select id::text from public.gpr_m365_connections where admin_id=current_setting('gprdelete.admin')::uuid),gen_random_uuid()::text),true);
select set_config('gprdelete.lock',gen_random_uuid()::text,true);
insert into public.gpr_m365_connections(id,admin_id,mailbox,allowed_senders,enabled,refresh_cipher,sync_lock,lock_until)
values(current_setting('gprdelete.connection')::uuid,current_setting('gprdelete.admin')::uuid,
  'delete-fixture@example.com',array['orders@example.com'],true,'test-only-cipher',current_setting('gprdelete.lock')::uuid,clock_timestamp()+interval '10 minutes')
on conflict(admin_id) do update set mailbox=excluded.mailbox,allowed_senders=excluded.allowed_senders,
  enabled=true,sync_lock=excluded.sync_lock,lock_until=excluded.lock_until;
update public.gpr_work_orders set deleted_at=now(),deleted_by=current_setting('gprdelete.admin')::uuid
where id=current_setting('gprdelete.id')::uuid;
set local role service_role;
do $$ declare r jsonb; item public.gpr_work_orders;
begin
  select * into item from public.gpr_work_orders where id=current_setting('gprdelete.id')::uuid;
  r:=public.ingest_gpr_m365_email(current_setting('gprdelete.connection')::uuid,current_setting('gprdelete.lock')::uuid,
    jsonb_build_object('key',gen_random_uuid(),'sender','orders@example.com','subject','GPR update','body','GPR mapping update'),
    jsonb_build_object('order_number',item.order_number,'client_name',item.client_name,'title','Must not recreate','description','GPR mapping'));
  if r->>'status'<>'linked' or (r->>'order_id')::uuid<>item.id then raise exception 'Deleted order was recreated'; end if;
  if not exists(select 1 from public.gpr_work_orders where id=item.id and deleted_at is not null and title='Delete fixture') then
    raise exception 'Incoming mail restored or overwrote a deleted order'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin
  begin
    perform public.set_gpr_order_deleted(current_setting('gprdelete.id')::uuid,now(),true);
    raise exception 'Non-admin could delete GPR work';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Recoverable deletion, restore, optimistic locking and admin-only access passed; fixtures rolled back.' as result;
