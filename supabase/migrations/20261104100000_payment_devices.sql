-- Installment-payment tracking for leased devices (Spatial Perception
-- Technologies). Main accounting only (is_accounting() = accounting_main).
-- Base columns (base_month / base_payment_no) are the fixed reference; the
-- current due month / payment number are derived from them each month.

create table if not exists public.payment_devices (
  id uuid primary key default gen_random_uuid(),
  device_label text not null,
  invoice_no text,
  purchase_month date,
  monthly_payment numeric(12,2) not null check (monthly_payment >= 0),
  total_payments integer not null check (total_payments > 0),
  base_month date not null,
  base_payment_no integer not null check (base_payment_no >= 0),
  due_month date not null,
  payment_no integer not null check (payment_no >= 0),
  status text not null default 'active' check (status in ('active', 'closed')),
  notes text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_device_updates (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.payment_devices(id) on delete cascade,
  month date not null,
  payment_no integer not null,
  balance numeric(14,2) not null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.payment_devices enable row level security;
alter table public.payment_device_updates enable row level security;

create policy payment_devices_main_accounting on public.payment_devices
  for all to authenticated using (public.is_accounting()) with check (public.is_accounting());
create policy payment_device_updates_main_accounting on public.payment_device_updates
  for all to authenticated using (public.is_accounting()) with check (public.is_accounting());

-- Seed: rows 11-23 of the source workbook.
insert into public.payment_devices
  (device_label, invoice_no, purchase_month, monthly_payment, total_payments, base_month, base_payment_no, due_month, payment_no, notes)
select v.label, v.inv, v.pm::date, v.pay, v.total, '2026-10-01', v.n, '2026-10-01', v.n, v.notes
from (values
  ('4693','22933','2026-05-01',1534,35,5,'חייבו 56.6 כולל 48 לא כולל - בטעות החל מ-8.7.26 מתשלום 2/35'),
  ('4654','22934','2026-05-01',1534,35,5,'חייבו 56.6 כולל 48 לא כולל - בטעות החל מ-8.7.26 מתשלום 2/35'),
  ('4665','22935','2026-05-01',1534,35,5,'חייבו 56.6 כולל 48 לא כולל - בטעות החל מ-8.7.26 מתשלום 2/35'),
  ('9438','2104','2024-02-01',1888,36,32,null),
  ('9462','2105','2024-03-01',1888,36,31,null),
  ('1308','2030','2025-01-01',1743,30,21,null),
  ('1344','2014','2024-11-01',1888,30,23,null),
  ('1350','2015','2025-01-01',1888,28,21,null),
  ('1351','2016','2025-03-01',1888,26,19,'בקובץ המקורי היתרה חושבה ב-1872 ולא ב-1888'),
  ('1309','2017','2025-03-01',1888,26,19,'בקובץ המקורי היתרה חושבה ב-1872 ולא ב-1888'),
  ('6026','2631','2024-11-01',1590,35,23,null),
  ('6017','2632','2024-11-01',1739,35,23,null),
  ('4660986','22002','2025-12-01',1739,35,10,null)
) as v(label, inv, pm, pay, total, n, notes)
where not exists (select 1 from public.payment_devices);
