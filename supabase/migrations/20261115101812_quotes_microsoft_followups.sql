-- Independent quote workspaces and mailbox lifecycle. No existing GPR connection is changed.
create table public.quote_workspaces (
  owner_id uuid primary key references public.profiles(id),
  revision bigint not null default 0,
  data jsonb not null,
  lock_token uuid,
  lock_until timestamptz,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(data)='object')
);
create table public.quote_mailbox_connections (
  owner_id uuid primary key references public.profiles(id),
  mailbox text not null,
  folder_name text not null default 'Quotes',
  folder_id text,
  enabled boolean not null default false,
  automation_enabled boolean not null default false,
  config_version uuid not null default gen_random_uuid(),
  refresh_cipher text,
  mailbox_object_id text,
  cursor_url text,
  last_sync_at timestamptz,
  connected_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  check (not automation_enabled or enabled)
);
create table public.quote_oauth_states (
  state_hash text primary key,
  owner_id uuid not null references public.quote_mailbox_connections(owner_id) on delete cascade,
  config_version uuid not null,
  verifier_cipher text not null,
  return_origin text not null,
  expires_at timestamptz not null
);
create table public.quote_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.quote_workspaces(owner_id),
  quote_id uuid not null,
  cycle text not null,
  round_no integer not null check(round_no between 1 and 10),
  recipient text not null,
  status text not null default 'pending' check(status in ('pending','drafted','sending','sent','failed','cancelled','unknown')),
  graph_id text,
  token_hash text unique,
  token_cipher text,
  expires_at timestamptz,
  responded_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(owner_id,quote_id,cycle,round_no)
);
create table public.quote_incoming_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.quote_workspaces(owner_id),
  message_key text not null,
  created_at timestamptz not null default now(),
  unique(owner_id,message_key)
);
create table public.quote_response_requests (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.quote_delivery_jobs(id),
  request_key uuid not null,
  created_at timestamptz not null default now(),
  unique(job_id,request_key)
);
create index quote_delivery_ready on public.quote_delivery_jobs(owner_id,status,created_at);
create index quote_oauth_expiry on public.quote_oauth_states(expires_at);
create index quote_response_rate on public.quote_response_requests(job_id,created_at);
alter table public.notifications add column if not exists quote_id uuid;

-- Server-only mutation surface, including encrypted credentials. No browser grants.
alter table public.quote_workspaces enable row level security;
alter table public.quote_mailbox_connections enable row level security;
alter table public.quote_oauth_states enable row level security;
alter table public.quote_delivery_jobs enable row level security;
alter table public.quote_incoming_messages enable row level security;
alter table public.quote_response_requests enable row level security;
revoke all on public.quote_workspaces, public.quote_mailbox_connections, public.quote_oauth_states,
  public.quote_delivery_jobs,public.quote_incoming_messages,public.quote_response_requests from anon,authenticated;
grant all on public.quote_workspaces, public.quote_mailbox_connections, public.quote_oauth_states,
  public.quote_delivery_jobs,public.quote_incoming_messages,public.quote_response_requests to service_role;
create policy quote_server_only on public.quote_workspaces for all to service_role using(true) with check(true);
create policy quote_server_only on public.quote_mailbox_connections for all to service_role using(true) with check(true);
create policy quote_server_only on public.quote_oauth_states for all to service_role using(true) with check(true);
create policy quote_server_only on public.quote_delivery_jobs for all to service_role using(true) with check(true);
create policy quote_server_only on public.quote_incoming_messages for all to service_role using(true) with check(true);
create policy quote_server_only on public.quote_response_requests for all to service_role using(true) with check(true);

-- One expiring lease serializes UI edits, receiving and sending for an owner.
-- A UI cancellation cannot be overwritten by a worker with a stale snapshot.
create function public.claim_quote_workspace(p_owner uuid,p_lock uuid)
returns setof public.quote_workspaces language sql set search_path='' as $$
  update public.quote_workspaces set lock_token=p_lock,lock_until=now()+interval '90 seconds'
  where owner_id=p_owner and (lock_until is null or lock_until<now()) returning *;
$$;
create function public.commit_quote_workspace(p_owner uuid,p_lock uuid,p_revision bigint,p_data jsonb)
returns setof public.quote_workspaces language sql set search_path='' as $$
  update public.quote_workspaces set data=p_data,revision=revision+1,updated_at=now()
  where owner_id=p_owner and lock_token=p_lock and lock_until>now() and revision=p_revision
  returning *;
$$;
revoke all on function public.claim_quote_workspace(uuid,uuid) from public,anon,authenticated;
revoke all on function public.commit_quote_workspace(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.claim_quote_workspace(uuid,uuid) to service_role;
grant execute on function public.commit_quote_workspace(uuid,uuid,bigint,jsonb) to service_role;

-- Only the new worker is scheduled. Empty/disconnected mailboxes do no work.
select cron.schedule('quote-mailbox-worker','*/5 * * * *',$job$
  select net.http_post(
    url:='https://qopsdkmzvncamjrxjwni.supabase.co/functions/v1/quotes-microsoft',
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='maya_cron_secret' limit 1)),
    body:='{"action":"run"}'::jsonb,timeout_milliseconds:=60000
  ) where exists(select 1 from public.quote_mailbox_connections where enabled);
$job$);
