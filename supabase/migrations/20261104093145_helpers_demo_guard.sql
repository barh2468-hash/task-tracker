create policy demo_deny_operational on public.crew_helpers as restrictive for all to authenticated
using (not (select private.is_demo())) with check (not (select private.is_demo()));
