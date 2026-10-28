-- No real mailbox requests, credentials, messages or authorization changes.
-- All fixtures and updates below are rolled back.
begin;
select set_config('gpr365.admin',(select id::text from public.profiles where role='admin' limit 1),true);
select set_config('gpr365.connection',coalesce((select id::text from public.gpr_m365_connections where admin_id=current_setting('gpr365.admin')::uuid),gen_random_uuid()::text),true);
select set_config('gpr365.lock',gen_random_uuid()::text,true);
-- The fixture is invisible outside this transaction; an existing connection's
-- settings are restored by rollback. No existing rows are deleted.
insert into public.gpr_m365_connections(id,admin_id,mailbox,allowed_senders,enabled,refresh_cipher,sync_lock,lock_until)
values(current_setting('gpr365.connection')::uuid,current_setting('gpr365.admin')::uuid,'integration@example.com',array['orders@example.com'],true,'dummy-cipher',current_setting('gpr365.lock')::uuid,clock_timestamp()+interval '10 minutes')
on conflict(admin_id) do update set mailbox=excluded.mailbox,allowed_senders=excluded.allowed_senders,enabled=true,
  refresh_cipher=excluded.refresh_cipher,sync_lock=excluded.sync_lock,lock_until=excluded.lock_until;

set local role service_role;
do $$ declare c uuid:=current_setting('gpr365.connection')::uuid; l uuid:=current_setting('gpr365.lock')::uuid;
  number text:=gen_random_uuid()::text; msg jsonb; parsed jsonb; r jsonb; first_id uuid; before_count integer;
begin
  select count(*) into before_count from public.notifications where type='gpr_email_order_received';
  msg:=jsonb_build_object('key','test-'||number,'conversation','thread-'||number,'sender','orders@example.com','actual_sender','orders@example.com',
    'subject','Company - GPR - Field preparation','body','Original email','received',now(),'attachments',true);
  parsed:=jsonb_build_object('title','Imported work','order_number',number,'client_name','Integration issuer','description','GPR mapping','requirements','[]'::jsonb);
  r:=public.ingest_gpr_m365_email(c,l,msg,parsed);
  if r->>'status'<>'imported' then raise exception 'New mail did not create a work order'; end if;
  first_id:=(r->>'order_id')::uuid;
  perform set_config('gpr365.test_order',first_id::text,true);
  if (select count(*) from public.notifications where gpr_order_id=first_id)<>1 or not exists(
    select 1 from public.notifications where gpr_order_id=first_id and type='gpr_email_order_received'
      and recipient_id=current_setting('gpr365.admin')::uuid and not is_read and project_id is null and created_by is null
  ) then raise exception 'New import did not notify only the mailbox owner'; end if;
  r:=public.ingest_gpr_m365_email(c,l,msg,parsed);
  if r->>'status'<>'duplicate' then raise exception 'Same email was processed twice'; end if;
  update public.gpr_work_orders set title='Manual title',notes='Keep manual notes',status='completed' where id=first_id;
  r:=public.ingest_gpr_m365_email(c,l,msg||jsonb_build_object('key','reply-'||number,'subject','Work order update','body','GPR mapping update'),parsed);
  if r->>'status'<>'linked' or (r->>'order_id')::uuid<>first_id then raise exception 'Reply did not attach to the existing work'; end if;
  if not exists(select 1 from public.gpr_work_orders where id=first_id and title='Manual title' and notes='Keep manual notes' and status='completed' and source_email='Original email') then
    raise exception 'Incoming mail overwrote manual edits or original email'; end if;
  r:=public.ingest_gpr_m365_email(c,l,msg||jsonb_build_object('key','spoof-'||number,'actual_sender','attacker@example.com'),parsed);
  if r->>'status'<>'ignored' then raise exception 'Non-allowlisted sender accepted'; end if;
  if exists(select 1 from public.gpr_order_emails where message_key='spoof-'||number and body_text<>'') then raise exception 'Rejected body retained'; end if;
  r:=public.ingest_gpr_m365_email(c,l,msg||jsonb_build_object('key','ordinary-'||number,'subject','Meeting','body','Lunch tomorrow?'),parsed);
  if r->>'status'<>'ignored' then raise exception 'Ordinary sender correspondence became an order'; end if;
  r:=public.ingest_gpr_m365_email(c,l,msg||jsonb_build_object('key','missing-'||number),parsed||jsonb_build_object('order_number',''));
  if r->>'status'<>'review' then raise exception 'Unrecognized work was not held for review'; end if;
  insert into public.gpr_work_orders(title,order_number,created_by) values('Manual work without issuer',number||'-unknown',current_setting('gpr365.admin')::uuid);
  r:=public.ingest_gpr_m365_email(c,l,msg||jsonb_build_object('key','ambiguous-'||number,'conversation','different-thread'),parsed||jsonb_build_object('order_number',number||'-unknown'));
  if r->>'status'<>'review' then raise exception 'Ambiguous manual order was silently matched'; end if;
  if (select count(*) from public.notifications where type='gpr_email_order_received')<>before_count+1 then
    raise exception 'Duplicate, linked, ignored, review or manual work generated an extra notification'; end if;
  update public.gpr_m365_connections set lock_until=clock_timestamp()-interval '1 minute' where id=c;
  begin
    perform public.ingest_gpr_m365_email(c,l,msg||jsonb_build_object('key','expired-'||number),parsed);
    raise exception 'Expired lease was accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if has_table_privilege('authenticated','public.gpr_m365_connections','SELECT') or has_table_privilege('authenticated','public.gpr_m365_oauth_states','SELECT') then
    raise exception 'Browser clients can read connector credentials'; end if;
  if has_function_privilege('authenticated','public.ingest_gpr_m365_email(uuid,uuid,jsonb,jsonb)','EXECUTE') or has_function_privilege('anon','public.ingest_gpr_m365_email(uuid,uuid,jsonb,jsonb)','EXECUTE') then
    raise exception 'Browser clients can invoke ingestion'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('gpr365.admin'),true);
do $$ begin
  if (select count(*) from public.gpr_order_emails where connection_id=current_setting('gpr365.connection')::uuid and mailbox='integration@example.com')<>6 then raise exception 'Admin email history access failed'; end if;
  if (select count(*) from public.notifications n left join public.gpr_work_orders g on g.id=n.gpr_order_id
    where n.gpr_order_id=current_setting('gpr365.test_order')::uuid and g.title='Manual title')<>1 then
    raise exception 'Mailbox owner cannot read the notification and linked work'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.gpr_order_emails) then raise exception 'Email data leaked to non-admin'; end if;
  if exists(select 1 from public.notifications where gpr_order_id=current_setting('gpr365.test_order')::uuid) then
    raise exception 'Private GPR notification leaked to another user'; end if;
  update public.notifications set is_read=true where gpr_order_id=current_setting('gpr365.test_order')::uuid;
  if found then raise exception 'Another user could mark the private notification as read'; end if;
end $$;
reset role;
rollback;
select 'Microsoft intake, private notifications, deduplication, sender filters, ambiguity, leases and permissions passed; fixtures rolled back.' as result;
