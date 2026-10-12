-- Lets the fleet secretary and managers list system users (id, name, email)
-- so a vehicle's free-text driver name can be linked to a real account.
-- A function is used instead of widening RLS on public.profiles, so fleet
-- never gets read access to other profile columns (role, etc.).

create or replace function public.fleet_driver_candidates()
returns table (id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email
  from public.profiles p
  where public.can_view_fleet()
  order by p.full_name;
$$;

revoke all on function public.fleet_driver_candidates() from public;
grant execute on function public.fleet_driver_candidates() to authenticated;
