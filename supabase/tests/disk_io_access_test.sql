-- Run with psql against a disposable or linked database. All changes roll back.
-- Captures every existing account, plus anon, before and after the migration.
begin;
set local statement_timeout = '30s';

create function pg_temp.disk_io_access_snapshot()
returns table(actor_id uuid, actor_role text, relation_name text, row_count bigint, row_digest text)
language plpgsql security invoker as $$
declare actor record; relation text; identity_expression text;
begin
  for actor in select id, role from public.profiles union all select null::uuid, 'anon' loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', actor.id, 'role',
      case when actor.id is null then 'anon' else 'authenticated' end)::text, true);
    perform set_config('request.jwt.claim.sub', coalesce(actor.id::text, ''), true);
    if actor.id is null then execute 'set local role anon';
    else execute 'set local role authenticated'; end if;
    foreach relation in array array['profiles','projects','project_workers','project_tasks','project_task_reports','status_history'] loop
      identity_expression := case when relation = 'project_workers' then 'project_id::text || '':'' || worker_id::text' else 'id::text' end;
      actor_id := actor.id;
      actor_role := actor.role;
      relation_name := relation;
      begin
        execute format('select count(*), md5(coalesce(string_agg(%1$s, '','' order by %1$s), '''')) from public.%2$I',
          identity_expression, relation) into row_count, row_digest;
      exception when insufficient_privilege then
        row_count := null;
        row_digest := 'denied:42501';
      end;
      return next;
    end loop;
    execute 'reset role';
  end loop;
end $$;

create temp table access_before as select * from pg_temp.disk_io_access_snapshot();
create temp table policy_shape_before as
  select oid, polrelid, polname, polcmd, polpermissive, polroles, polwithcheck::text as write_check
  from pg_policy;

\ir ../migrations/20261103135625_reduce_disk_io.sql

create temp table access_after as select * from pg_temp.disk_io_access_snapshot();
do $$ begin
  assert exists (select 1 from access_before where actor_role = 'admin' and relation_name = 'projects' and row_count > 0),
    'The authenticated admin baseline must see projects';
  assert not exists (
    (select * from access_before except select * from access_after)
    union all (select * from access_after except select * from access_before)
  ), 'Read visibility changed for an existing account or anon';
  assert not exists (
    (select * from policy_shape_before except select oid,polrelid,polname,polcmd,polpermissive,polroles,polwithcheck::text from pg_policy)
    union all
    (select oid,polrelid,polname,polcmd,polpermissive,polroles,polwithcheck::text from pg_policy except select * from policy_shape_before)
  ), 'Policy commands, roles, permissiveness or write checks changed';
end $$;
select 'Access parity passed' as result, count(distinct actor_id) as accounts_checked,
  count(*) filter (where actor_role = 'anon') as anonymous_table_checks from access_after;
rollback;
