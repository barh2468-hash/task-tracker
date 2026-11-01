-- Internal username aliases must never be auto-provisioned as employees.
-- Browser self-registration already permits only field_worker profiles; this
-- constraint additionally reserves all client aliases for read-only accounts.
alter table public.profiles add constraint client_username_read_only_role
check (email is null or lower(email) not like '%@clients.maya.invalid' or role = 'demo');
