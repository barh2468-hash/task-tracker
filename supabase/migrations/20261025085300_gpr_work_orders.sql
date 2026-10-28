-- Private administrator intake, separate from project tasks.
create table public.gpr_work_orders (
  id uuid primary key default gen_random_uuid(),
  title text not null default '' check (length(title) <= 300),
  order_number text not null default '' check (length(order_number) <= 254),
  client_name text not null default '' check (length(client_name) <= 254),
  location text not null default '' check (length(location) <= 254),
  description text not null default '' check (length(description) <= 10000),
  contact_name text not null default '' check (length(contact_name) <= 254),
  contact_phone text not null default '' check (length(contact_phone) <= 254),
  contact_email text not null default '' check (length(contact_email) <= 254),
  planned_days numeric check (planned_days > 0 and planned_days <= 3650),
  scheduled_for date,
  status text not null default 'new' check (status in ('new', 'clarification', 'approval', 'scheduled', 'completed', 'cancelled')),
  requirements jsonb not null default '[]'::jsonb check (jsonb_typeof(requirements) = 'array' and jsonb_array_length(requirements) <= 5),
  notes text not null default '' check (length(notes) <= 10000),
  source_email text not null default '' check (length(source_email) <= 100000),
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gpr_title_or_order check (length(btrim(title)) > 0 or length(btrim(order_number)) > 0)
);
-- Issuers can reuse each other's order numbers. Unknown issuers are treated
-- conservatively as the same source until the administrator supplies a name.
create unique index gpr_work_orders_issuer_number_key on public.gpr_work_orders
  (lower(btrim(client_name)), lower(btrim(order_number))) where btrim(order_number) <> '';
create index gpr_work_orders_project_idx on public.gpr_work_orders(project_id) where project_id is not null;
create index gpr_work_orders_creator_idx on public.gpr_work_orders(created_by);
create index gpr_work_orders_created_idx on public.gpr_work_orders(created_at desc);

alter table public.gpr_work_orders enable row level security;
revoke all on public.gpr_work_orders from anon, authenticated;
grant select, insert, update on public.gpr_work_orders to authenticated;
grant all on public.gpr_work_orders to service_role;
create policy "gpr admin read" on public.gpr_work_orders for select to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));
create policy "gpr admin insert" on public.gpr_work_orders for insert to authenticated
with check (created_by = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));
create policy "gpr admin update" on public.gpr_work_orders for update to authenticated
using (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'))
with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'));
create trigger gpr_work_orders_updated_at before update on public.gpr_work_orders
for each row execute function public.set_updated_at();
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.gpr_work_orders;
  end if;
end $$;
