-- A shared directory; session crew names remain immutable report snapshots.
create table public.crew_helpers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index crew_helpers_name_key on public.crew_helpers (lower(btrim(name)));
alter table public.crew_helpers enable row level security;
revoke all on public.crew_helpers from public, anon, authenticated;
grant select on public.crew_helpers to authenticated;
grant insert(name), update(name, is_active) on public.crew_helpers to authenticated;

create policy "staff read active helpers and admins read all" on public.crew_helpers
for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and (p.role = 'admin' or (is_active and p.role in ('manager', 'field_worker', 'drafter', 'accounting', 'accounting_main'))))
);
create policy "admins create helpers" on public.crew_helpers
for insert to authenticated with check (
  exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role = 'admin')
);
create policy "admins update helpers" on public.crew_helpers
for update to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.role = 'admin')
);

create function private.stamp_crew_helper() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.stamp_crew_helper() from public, anon, authenticated;
create trigger stamp_crew_helper before update on public.crew_helpers
for each row execute function private.stamp_crew_helper();

-- Import exactly the choices offered by existing clients; no reports are rewritten.
insert into public.crew_helpers(name) values
  ('יובל'), ('מתן'), ('חיים'), ('גבי'), ('אילן'), ('שקד'),
  ('גבריאל'), ('שי'), ('אופק מושנוב'), ('יצחק'), ('אלי');
