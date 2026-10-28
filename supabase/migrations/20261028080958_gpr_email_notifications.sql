-- Notify only the owner of the connected mailbox, atomically with a new import.
-- Existing imports, linked replies, review items and manual work are not backfilled.
alter table public.notifications
  add column gpr_order_id uuid references public.gpr_work_orders(id) on delete cascade;
create index notifications_gpr_order_idx on public.notifications(gpr_order_id)
  where gpr_order_id is not null;
create unique index notifications_gpr_email_order_once on public.notifications(recipient_id,gpr_order_id)
  where type='gpr_email_order_received' and gpr_order_id is not null;

-- Mailbox-wide intake: GPR can appear in the subject or body. Sender validation and leases remain mandatory.
create or replace function public.ingest_gpr_m365_email(p_connection uuid, p_lock uuid, p_message jsonb, p_order jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.gpr_m365_connections; m public.gpr_order_emails; target uuid; n integer;
  issuer text; number text; outcome text; why text; candidates uuid[];
begin
  select * into c from public.gpr_m365_connections where id=p_connection for update;
  if not found or not c.enabled or p_lock is null or c.sync_lock is distinct from p_lock or c.lock_until is null or c.lock_until < clock_timestamp()
    or not exists(select 1 from public.profiles where id=c.admin_id and role='admin') then
    raise insufficient_privilege using message='Inactive synchronization lease';
  end if;
  select * into m from public.gpr_order_emails where mailbox=c.mailbox and message_key=p_message->>'key';
  if found then return jsonb_build_object('status','duplicate','order_id',m.order_id); end if;
  outcome := 'review';
  if not (lower(p_message->>'sender')=any(c.allowed_senders)) or concat(coalesce(p_message->>'subject',''),' ',coalesce(p_message->>'body','')) !~* '\mGPR\M'
    or (coalesce(p_message->>'actual_sender','')<>'' and not (lower(p_message->>'actual_sender')=any(c.allowed_senders))) then
    outcome := 'ignored'; why := 'sender_or_content';
  elsif p_order is null then why := coalesce(p_message->>'reason','unrecognized');
  else
    issuer := btrim(coalesce(p_order->>'client_name','')); number := btrim(coalesce(p_order->>'order_number',''));
    if number='' then why := 'missing_order_number';
    else
      perform pg_advisory_xact_lock(hashtextextended(lower(issuer)||'|'||lower(number),0));
      select array_agg(distinct order_id) into candidates from public.gpr_order_emails
      where mailbox=c.mailbox and conversation_id=coalesce(p_message->>'conversation','') and conversation_id<>'' and order_id is not null;
      n := coalesce(cardinality(candidates),0);
      if n=1 then
        if exists(select 1 from public.gpr_work_orders where id=candidates[1] and lower(btrim(order_number))=lower(number)) then target:=candidates[1];
        else why:='ambiguous_match'; end if;
      elsif n>1 then why:='ambiguous_match';
      else
        select id into target from public.gpr_work_orders where lower(btrim(client_name))=lower(issuer) and lower(btrim(order_number))=lower(number);
        if target is null and exists(select 1 from public.gpr_work_orders where btrim(client_name)='' and lower(btrim(order_number))=lower(number)) then why:='ambiguous_match'; end if;
      end if;
      if why is null and target is null then
        insert into public.gpr_work_orders(title,order_number,client_name,location,description,contact_name,contact_phone,contact_email,
          planned_days,status,requirements,source_email,source_subject,created_by)
        values(coalesce(p_order->>'title',''),number,issuer,coalesce(p_order->>'location',''),coalesce(p_order->>'description',''),
          coalesce(p_order->>'contact_name',''),coalesce(p_order->>'contact_phone',''),coalesce(p_order->>'contact_email',''),
          nullif(p_order->>'planned_days','')::numeric,'new',coalesce(p_order->'requirements','[]'::jsonb),
          coalesce(p_message->>'body',''),coalesce(p_message->>'subject',''),c.admin_id) returning id into target;
        outcome:='imported';
      elsif target is not null and why is null then outcome:='linked'; end if;
    end if;
  end if;
  insert into public.gpr_order_emails(connection_id,mailbox,message_key,conversation_id,sender,subject,body_text,received_at,
    has_attachments,web_url,order_id,status,reason)
  values(c.id,c.mailbox,p_message->>'key',coalesce(p_message->>'conversation',''),lower(p_message->>'sender'),
    coalesce(p_message->>'subject',''),case when outcome='ignored' then '' else coalesce(p_message->>'body','') end,
    nullif(p_message->>'received','')::timestamptz,coalesce((p_message->>'attachments')::boolean,false),
    coalesce(p_message->>'web_url',''),target,outcome,why)
  on conflict(mailbox,message_key) do nothing returning * into m;
  if not found then return jsonb_build_object('status','duplicate'); end if;
  -- No project_id: this is an in-app notification only, never a manager fan-out,
  -- project/drafter email or client-side Push request. The mailbox owner is the recipient.
  if outcome='imported' then
    insert into public.notifications(recipient_id,type,title,body,gpr_order_id)
    values(c.admin_id,'gpr_email_order_received','New GPR work order received from email',
      'Open the GPR work order to review its details.',target)
    on conflict(recipient_id,gpr_order_id)
      where type='gpr_email_order_received' and gpr_order_id is not null do nothing;
  end if;
  return jsonb_build_object('status',outcome,'order_id',target,'email_id',m.id);
end $$;
revoke all on function public.ingest_gpr_m365_email(uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.ingest_gpr_m365_email(uuid,uuid,jsonb,jsonb) to service_role;
