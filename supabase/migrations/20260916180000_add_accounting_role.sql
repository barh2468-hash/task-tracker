-- Add 'accounting' as a valid profiles.role value.
-- No RLS policies grant this role any special access yet — accounting
-- profiles get the same default (minimal) access as any other non-manager
-- profile until dedicated features/policies are built for them.
--
-- Also formally allows 'drafter', which the app already treats as a role
-- (roleLabel, AuthContext.isDrafter, and the review-workflow RLS policy in
-- 20260909120000_review_workflow_and_document_types.sql all reference it)
-- but which the old constraint never actually permitted.

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%role%';

  if constraint_name is not null then
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.profiles
add constraint profiles_role_check
check (role in ('manager', 'field_worker', 'drafter', 'accounting'));
