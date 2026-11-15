create table public.quote_feature_access (
  user_id uuid primary key references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.quote_feature_access enable row level security;
revoke all on public.quote_feature_access from anon, authenticated;
grant all on public.quote_feature_access to service_role;
create policy quote_private_server_only on public.quote_feature_access
  for all to service_role using(true) with check(true);

-- Resolve the verified accounts from profiles; do not grant every manager access.
insert into public.quote_feature_access(user_id)
select id from public.profiles where lower(email) in ('bar@maya-tm.com','peleg@maya-tm.com');
do $$ begin
  if (select count(*) from public.quote_feature_access)<>2 then
    raise exception 'Both verified quote accounts must exist before rollout';
  end if;
end $$;
