-- Read-only assertions: no operational records or permission policies change.
do $$
declare settings text[];
begin
  select s.setconfig into settings from pg_db_role_setting s
  join pg_roles r on r.oid=s.setrole
  where r.rolname='authenticator' and s.setdatabase=0;
  assert settings @> array['transaction_timeout=60s'], 'API transaction recovery limit is missing';
  assert settings @> array['idle_in_transaction_session_timeout=30s'], 'API idle transaction recovery limit is missing';
  assert settings @> array['statement_timeout=8s'], 'Existing API statement limit must remain unchanged';
  assert not exists (
    select 1 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole
    where r.rolname in ('postgres','supabase_admin')
      and s.setconfig && array['transaction_timeout=60s','idle_in_transaction_session_timeout=30s']
  ), 'Background/admin connections must not receive the API recovery limits';
end $$;
