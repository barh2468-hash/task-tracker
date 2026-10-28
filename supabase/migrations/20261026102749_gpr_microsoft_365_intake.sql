-- Connector credentials and OAuth state are server-only, including for admins.
create table public.gpr_m365_connections (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null unique references public.profiles(id) on delete cascade,
  mailbox text not null default '',
  folder_name text not null default 'GPR' check (length(folder_name) between 1 and 100),
  allowed_senders text[] not null default '{}' check (cardinality(allowed_senders) <= 50),
  include_existing boolean not null default false,
  config_version uuid not null default gen_random_uuid(),
  enabled boolean not null default false,
  refresh_cipher text,
  mailbox_object_id text,
  folder_id text,
  connected_at timestamptz,
  delta_url text,
  sync_lock uuid,
  lock_until timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not enabled or (mailbox <> '' and refresh_cipher is not null and cardinality(allowed_senders) > 0))
);
create table public.gpr_m365_oauth_states (
  state_hash text primary key,
  connection_id uuid not null references public.gpr_m365_connections(id) on delete cascade,
  config_version uuid not null,
  verifier_cipher text not null,
  return_origin text not null,
  expires_at timestamptz not null
);
create index gpr_m365_states_connection_idx on public.gpr_m365_oauth_states(connection_id);
create table public.gpr_order_emails (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.gpr_m365_connections(id) on delete set null,
  mailbox text not null,
  message_key text not null check (length(message_key) <= 2048),
  conversation_id text not null default '',
  sender text not null,
  subject text not null default '' check (length(subject) <= 1000),
  body_text text not null default '' check (length(body_text) <= 100000),
  received_at timestamptz,
  has_attachments boolean not null default false,
  web_url text not null default '',
  order_id uuid references public.gpr_work_orders(id) on delete set null,
  status text not null check (status in ('imported','linked','review','ignored')),
  reason text,
  created_at timestamptz not null default now(),
  unique(mailbox, message_key)
);
create index gpr_order_emails_connection_idx on public.gpr_order_emails(connection_id);
create index gpr_order_emails_order_idx on public.gpr_order_emails(order_id);
create index gpr_order_emails_thread_idx on public.gpr_order_emails(mailbox, conversation_id) where conversation_id <> '';
alter table public.gpr_m365_connections enable row level security;
alter table public.gpr_m365_oauth_states enable row level security;
alter table public.gpr_order_emails enable row level security;
revoke all on public.gpr_m365_connections, public.gpr_m365_oauth_states, public.gpr_order_emails from anon, authenticated;
grant all on public.gpr_m365_connections, public.gpr_m365_oauth_states, public.gpr_order_emails to service_role;
grant select on public.gpr_order_emails to authenticated;
create policy "m365 connections server only" on public.gpr_m365_connections for all to service_role using (true) with check (true);
create policy "m365 oauth server only" on public.gpr_m365_oauth_states for all to service_role using (true) with check (true);
create policy "gpr email server write" on public.gpr_order_emails for all to service_role using (true) with check (true);
create policy "gpr email admin read" on public.gpr_order_emails for select to authenticated
using (exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create trigger gpr_m365_connection_updated before update on public.gpr_m365_connections
for each row execute function public.set_updated_at();

-- Service-only, transactional ingestion: locks, replay protection and matching
-- are checked together. Incoming updates append mail, never replace manual edits.
create function public.ingest_gpr_m365_email(p_connection uuid, p_lock uuid, p_message jsonb, p_order jsonb default null)
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
  if not (lower(p_message->>'sender')=any(c.allowed_senders)) or coalesce(p_message->>'subject','') !~* 'GPR'
    or (coalesce(p_message->>'actual_sender','')<>'' and not (lower(p_message->>'actual_sender')=any(c.allowed_senders))) then
    outcome := 'ignored'; why := 'sender_or_subject';
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
  return jsonb_build_object('status',outcome,'order_id',target,'email_id',m.id);
end $$;
revoke all on function public.ingest_gpr_m365_email(uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.ingest_gpr_m365_email(uuid,uuid,jsonb,jsonb) to service_role;

-- The existing scheduler authenticates using the existing Vault/Edge secret.
select cron.schedule('gpr-microsoft-365-sync','*/5 * * * *',$job$
  select net.http_post(url:='https://qopsdkmzvncamjrxjwni.supabase.co/functions/v1/gpr-microsoft',
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',
      coalesce((select decrypted_secret from vault.decrypted_secrets where name='maya_cron_secret' limit 1),'')),
    body:='{"action":"sync-all"}'::jsonb,timeout_milliseconds:=60000);
$job$);
