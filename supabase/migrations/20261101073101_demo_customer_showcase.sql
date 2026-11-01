-- Customer demos use a deliberately curated projection, never operational rows.
-- All new tables are empty and unpublished until a manager approves content.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','manager','field_worker','drafter','accounting','accounting_main','demo'));

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- Must bypass profiles RLS to avoid recursion. No caller-controlled identity.
create or replace function private.is_demo()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'demo'); $$;
revoke all on function private.is_demo() from public, anon;
grant execute on function private.is_demo() to authenticated, service_role;

create table public.demo_project_showcases (
  project_id uuid primary key references public.projects(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  summary text not null default '' check (length(summary) <= 6000),
  location text not null default '' check (length(location) <= 300),
  is_published boolean not null default false
);
create table public.demo_project_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.demo_project_showcases(project_id) on delete cascade,
  primary key(user_id, project_id)
);
create index demo_project_access_project_idx on public.demo_project_access(project_id);
create table public.demo_case_studies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.demo_project_showcases(project_id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  summary text not null default '' check (length(summary) <= 6000),
  file_path text not null unique,
  file_name text not null check (length(file_name) between 1 and 500),
  file_size bigint not null check (file_size > 0 and file_size <= 20971520),
  constraint demo_case_study_path check (
    file_path ~ ('^' || project_id::text || '/[0-9a-f-]{36}\.pdf$')
  )
);
create index demo_case_studies_project_idx on public.demo_case_studies(project_id);

alter table public.demo_project_showcases enable row level security;
alter table public.demo_project_access enable row level security;
alter table public.demo_case_studies enable row level security;
revoke all on public.demo_project_showcases, public.demo_project_access, public.demo_case_studies from anon;
grant select, insert, update, delete on public.demo_project_showcases, public.demo_project_access, public.demo_case_studies to authenticated;
grant all on public.demo_project_showcases, public.demo_project_access, public.demo_case_studies to service_role;

create policy demo_showcase_manage on public.demo_project_showcases for all to authenticated
  using ((select public.is_manager())) with check ((select public.is_manager()));
create policy demo_showcase_read on public.demo_project_showcases for select to authenticated
  using ((select private.is_demo()) and is_published and exists (
    select 1 from public.demo_project_access a where a.project_id = demo_project_showcases.project_id and a.user_id = (select auth.uid())
  ));
create policy demo_access_manage on public.demo_project_access for all to authenticated
  using ((select public.is_manager())) with check (
    (select public.is_manager()) and exists(select 1 from public.profiles p where p.id = user_id and p.role = 'demo')
  );
create policy demo_access_read on public.demo_project_access for select to authenticated
  using ((select private.is_demo()) and user_id = (select auth.uid()));
create policy demo_studies_manage on public.demo_case_studies for all to authenticated
  using ((select public.is_manager())) with check ((select public.is_manager()));
create policy demo_studies_read on public.demo_case_studies for select to authenticated
  using ((select private.is_demo()) and exists (
    select 1 from public.demo_project_showcases s where s.project_id = demo_case_studies.project_id
  ));

-- Existing permissive policies include broad authenticated access. Restrictive
-- policies intersect with them, preserving staff behavior and denying demos.
do $$ declare item record; begin
  for item in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
      and c.relname not in ('profiles','demo_project_showcases','demo_project_access','demo_case_studies')
  loop
    execute format('alter table public.%I enable row level security', item.relname);
    execute format('create policy demo_deny_operational on public.%I as restrictive for all to authenticated using (not (select private.is_demo())) with check (not (select private.is_demo()))', item.relname);
  end loop;
end $$;
create policy demo_profile_read on public.profiles as restrictive for select to authenticated
  using (not (select private.is_demo()) or id = (select auth.uid()));
create policy demo_profile_insert on public.profiles as restrictive for insert to authenticated
  with check (not (select private.is_demo()));
create policy demo_profile_update on public.profiles as restrictive for update to authenticated
  using (not (select private.is_demo())) with check (not (select private.is_demo()));
create policy demo_profile_delete on public.profiles as restrictive for delete to authenticated
  using (not (select private.is_demo()));

-- SECURITY DEFINER RPCs bypass RLS. Gate existing callable business functions
-- as well, including employee directories, chat and vehicle operations. Keep
-- boolean role helpers callable: their existing role checks return false.
create or replace function private.require_staff()
returns boolean language plpgsql stable security invoker set search_path = '' as $$
begin
  if private.is_demo() then
    raise insufficient_privilege using message = 'Demo accounts have read-only showcase access';
  end if;
  return true;
end $$;
revoke all on function private.require_staff() from public, anon;
grant execute on function private.require_staff() to authenticated, service_role;

do $$ declare item record; body text; definition text; begin
  for item in
    select p.oid, p.prosrc, l.lanname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid=p.prolang
    where n.nspname='public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('authenticated', p.oid, 'execute')
      and p.proname not in ('is_manager','is_accounting','is_fleet','can_view_fleet')
  loop
    definition := pg_get_functiondef(item.oid);
    if item.lanname = 'plpgsql' then
      body := regexp_replace(item.prosrc, '\mbegin\M', 'begin perform private.require_staff();', 'i');
      if body = item.prosrc then raise exception 'Cannot guard RPC %', item.oid::regprocedure; end if;
    elsif item.lanname = 'sql' then
      -- These SQL RPCs are SELECT statements; fail rather than wrapping an
      -- unexpected future mutating SQL routine.
      if item.prosrc !~* '^\s*(select|with)\M' then raise exception 'Unexpected SQL RPC %', item.oid::regprocedure; end if;
      body := 'select demo_guard.* from (' || regexp_replace(btrim(item.prosrc), ';\s*$', '') || ') demo_guard where private.require_staff()';
    else raise exception 'Unsupported RPC language: %', item.lanname;
    end if;
    -- pg_get_functiondef retains all signatures, defaults, ACLs and settings.
    definition := replace(definition, '$function$' || item.prosrc || '$function$', '$function$' || body || '$function$');
    if definition = pg_get_functiondef(item.oid) then raise exception 'Cannot rewrite RPC %', item.oid::regprocedure; end if;
    execute definition;
  end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('demo-case-studies','demo-case-studies',false,20971520,array['application/pdf']);

-- Demos may read only curated PDFs with a currently accessible parent project.
create policy demo_storage_boundary on storage.objects as restrictive for all to authenticated
  using ((not (select private.is_demo()) and bucket_id <> 'demo-case-studies') or (
    bucket_id='demo-case-studies' and ((select public.is_manager()) or (
      (select private.is_demo()) and exists(select 1 from public.demo_case_studies d where d.file_path = name)
    ))
  )) with check (not (select private.is_demo()) and (bucket_id <> 'demo-case-studies' or (select public.is_manager())));
create policy demo_storage_no_delete on storage.objects as restrictive for delete to authenticated
  using (not (select private.is_demo()));
create policy demo_pdf_read on storage.objects for select to authenticated
  using (bucket_id='demo-case-studies' and (
    (select public.is_manager()) or exists(select 1 from public.demo_case_studies d where d.file_path=name)
  ));
create policy demo_pdf_insert on storage.objects for insert to authenticated
  with check (bucket_id='demo-case-studies' and (select public.is_manager()) and exists (
    select 1 from public.demo_project_showcases s where s.project_id::text=(storage.foldername(name))[1]
  ));
create policy demo_pdf_delete on storage.objects for delete to authenticated
  using (bucket_id='demo-case-studies' and (select public.is_manager()));
