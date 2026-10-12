-- Insurance quotes for vehicles about to arrive (or being re-insured): the
-- office uploads the agent's quote, a manager approves or rejects it. The
-- first decision closes the quote. Policy upload follows an approved quote.

create table if not exists public.vehicle_insurance_quotes (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  insurer text not null default '',
  agent text not null default '',
  premium_ils numeric(12, 2) check (premium_ils is null or premium_ils >= 0),
  notes text not null default '',
  document_id uuid references public.vehicle_documents(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid references public.profiles(id) on delete set null,
  requested_by_name text not null default '',
  decided_by uuid references public.profiles(id) on delete set null,
  decided_by_name text not null default '',
  decided_at timestamptz,
  decision_note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists vehicle_quotes_vehicle_idx
  on public.vehicle_insurance_quotes(vehicle_id, created_at desc);
create index if not exists vehicle_quotes_status_idx
  on public.vehicle_insurance_quotes(status) where status = 'pending';

alter table public.vehicle_insurance_quotes enable row level security;
drop policy if exists "vehicle_insurance_quotes fleet read" on public.vehicle_insurance_quotes;
drop policy if exists "vehicle_insurance_quotes fleet insert" on public.vehicle_insurance_quotes;
drop policy if exists "vehicle_insurance_quotes fleet update" on public.vehicle_insurance_quotes;
drop policy if exists "vehicle_insurance_quotes fleet delete" on public.vehicle_insurance_quotes;
create policy "vehicle_insurance_quotes fleet read" on public.vehicle_insurance_quotes
  for select using (public.can_view_fleet());
create policy "vehicle_insurance_quotes fleet insert" on public.vehicle_insurance_quotes
  for insert with check (public.is_fleet());
create policy "vehicle_insurance_quotes fleet update" on public.vehicle_insurance_quotes
  for update using (public.is_fleet()) with check (public.is_fleet());
create policy "vehicle_insurance_quotes fleet delete" on public.vehicle_insurance_quotes
  for delete using (public.is_fleet());
