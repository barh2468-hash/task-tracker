-- Two accounting tiers: 'accounting_main' (everything: year-end table + fuel)
-- and 'accounting' (regular: fuel only for now).

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'field_worker', 'drafter', 'accounting', 'accounting_main'));

-- The year-end / card-balance tables are main-accounting only.
create or replace function public.is_accounting()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'accounting_main'
  );
$$;
grant execute on function public.is_accounting() to authenticated;

-- cochavam becomes main accounting for now.
update public.profiles
set role = 'accounting_main'
where lower(email) like 'cochavam@%';
