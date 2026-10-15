-- Manager vehicle register from חוברת1.xlsx (גיליון1, A1:O34).
-- Text fields preserve mixed source values: V, dates, '-', notes in the year
-- column and supplementary codes on the second line of a plate-number cell.
create table public.manager_vehicles (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null,
  plate_key text generated always as (
    regexp_replace(split_part(replace(plate_number, E'\r', ''), E'\n', 1), '[^0-9]', '', 'g')
  ) stored unique,
  vehicle_type text not null default '',
  manufacture_year text not null default '',
  entered_on text not null default '',
  fuel_card text not null default '',
  paskal text not null default '',
  paskal_number text not null default '',
  route6_updated_on text not null default '',
  carmel_tunnels text not null default '',
  cross_north text not null default '',
  ownership text not null default '',
  insurance_agent text not null default '',
  driver_age text not null default '',
  driving_seniority text not null default '',
  driver_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  constraint manager_vehicles_valid_plate check (
    btrim(split_part(replace(plate_number, E'\r', ''), E'\n', 1)) ~ '^[0-9 -]+$'
    and plate_key ~ '^[0-9]{7,8}$'
  )
);

alter table public.manager_vehicles enable row level security;
revoke all on public.manager_vehicles from anon, authenticated;
grant select, insert, update on public.manager_vehicles to authenticated;
grant all on public.manager_vehicles to service_role;

create policy "managers read vehicles" on public.manager_vehicles
for select to authenticated using ((select public.is_manager()));
create policy "managers insert vehicles" on public.manager_vehicles
for insert to authenticated with check ((select public.is_manager()));
create policy "managers update vehicles" on public.manager_vehicles
for update to authenticated using ((select public.is_manager()))
with check ((select public.is_manager()));

create function public.stamp_manager_vehicle_update()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  new.updated_by = (select auth.uid());
  return new;
end;
$$;
revoke all on function public.stamp_manager_vehicle_update() from public, anon, authenticated;
create trigger stamp_manager_vehicle_update
before insert or update on public.manager_vehicles
for each row execute function public.stamp_manager_vehicle_update();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.manager_vehicles;
  end if;
end;
$$;

-- Initial register. Conflict handling preserves later manager edits on replays.
insert into public.manager_vehicles (plate_number, vehicle_type, manufacture_year, entered_on, fuel_card, paskal, paskal_number, route6_updated_on, carmel_tunnels, cross_north, ownership, insurance_agent, driver_age, driving_seniority, driver_name) values
  ('56-642-31', 'משאית רנו', 'קטנה - חיים', '', 'V', 'מנוי פסקל', '605233662', '2015-02-01', 'V', 'V', 'פרטי - מאיר ליסינג', 'גלובן', '', '', 'משאית קטנה'),
  ('89-353-84', 'MAN משאית', 'גדולה -גבי', '2017-03-28', 'V', 'מנוי פסקל', '604151698', '2017-03-29', 'V', 'V', 'פרטי- מאיה', 'גלובן - מקיף
איגוד ליסינג - חובה', '', '', 'משאית גדולה'),
  ('453-63-903', 'MAN משאית  - סופר', 'גדולה', '2023-01-09', 'V', '604785682', '', '2023-01-09', 'V', 'V', 'פרטי- מאיה', '', '', '', 'משאית סופר מאן'),
  ('747-19-901', 'סקודה', '', '2019-06-24', 'V', 'מנוי פסקל', '605345543', '2019-06-24', 'V', 'V', 'פרטי- משה סירי', 'גלובן', '', '', 'עדן סירי'),
  ('621-31-603
*2323', 'לינק אנד קו', '', '2024-09-09', 'V', 'מנוי פסקל', '604863641', '2024-09-09', 'V', 'V', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'משה סירי'),
  ('174-23-303', 'קיה סיד', '2022', '2022-08-23', 'V', 'מנוי פסקל', '605003532', '2022-08-23', '2022-08-23', '2022-08-23', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'משרד\עידן שטיינברג'),
  ('284-70-703', 'רנו מגאן', '2022', '2022-11-09', 'V', 'מנוי פסקל', '605269763', '2022-11-09', '2022-11-09', '09-11-202', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'רז ינאי'),
  ('318-63-903', 'רנו מגאן', '2022', '2022-11-24', 'V', 'מנוי פסקל', '', '2022-11-24', '2022-11-24', '2022-11-24', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'אוהד מליחי'),
  ('424-42-202', 'דאציה רומניה', '2021', '2023-01-15', 'V', 'מנוי פסקל', '605711889', '2023-01-15', '2023-01-15', '2023-01-15', 'פרטי - משה סירי', 'גלובן', '', '', 'משרד'),
  ('226-26-903', 'פיג''ו בוקסר', '2023', '2023-01-24', 'V', 'מנוי פסקל', '605261815', '2023-01-24', '2023-01-24', '2023-01-24', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'חיים חדידה / 
משאית חדשה'),
  ('229-10-103', 'פולאריס', '2023', '2023-02-06', 'V', '', '', '', '', '', 'פרטי- מאיה', 'גלובן', '', '', 'רינג''ירס'),
  ('436-54-203
5341*', 'קיה סיד', '2023-03-15', '2023-03-15', 'V', 'מנוי פסקל', '605837043', '2023-03-15', '2023-03-19', '2023-03-19', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'משרד'),
  ('503-08-503', 'רנו מגאן', '2023', '2023-05-18', 'V', 'מנוי פסקל', '605851770', '2023-05-18', '2023-05-31', '2023-05-31', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'אילן חדידה'),
  ('553-30-203', 'קיה סיד', '2023', '2023-10-26', 'V', 'מנוי פסקל', '605268348', '2023-10-26', '2023-10-26', '2023-10-26', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'אופק פולק'),
  ('651-77-503', 'סיטרואן C4', '2024', '2024-03-06', 'V', 'מנוי פסקל', '605312924', '2024-02-06', '2024-03-06', '2024-03-06', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'איל ברנמן'),
  ('733-72-603', 'MG', '', '', 'חשמלי', 'מנוי פסקל', '605837531', '2024-06-27', '2024-06-27', '2024-06-27', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'עדנה סירי'),
  ('787-18-201
*1132', 'הונדה ג''ז', '', '2020-01-07', 'V', 'מנוי פסקל', '605030069', '2020-01-07', 'V', 'V', 'פרטי- עדנה סירי', 'ביטוח ישיר', '', '', 'יוני'),
  ('834-93-903', 'יונדאי אלנטרה', '2024', '2024-08-29', 'V', 'מנוי פסקל', '605492481', '2024-08-29', '2024-09-10', '2024-09-10', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'פלג שמואל'),
  ('110-19-704', 'סיאט', '2024', '2024-09-24', 'V', 'מנוי פסקל', '605837602', '2024-09-24', '2024-09-26', '2024-09-26', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'אושר עוזר'),
  ('708-15-503', 'סיטרואן ברלינגו', '2024', '2024-10-29', 'V', 'מנוי פסקל', '604995442', '2024-10-29', '2024-10-29', '2024-10-29', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'גבי חדידא'),
  ('112-61-004', 'סיאט', '2024', '2024-11-05', 'V', 'מנוי פסקל', '605837017', '2024-11-05', '2024-11-07', '2024-11-07', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'מיכאל צרויה'),
  ('751-43-803
*3313', 'MG3', '2026', '2025-01-16', 'V', 'מנוי פסקל', '605496168', '2026-01-16', '2026-01-23', '2026-01-23', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'בר חדידא'),
  ('874-46-603
*3231', 'MG3', '2026', '2025-01-23', 'V', 'מנוי פסקל', '605081540', '2026-01-23', '2026-01-23', '2026-01-23', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'דניאל גוטגרץ'),
  ('687-44-603', 'קיה נירו', '2026', '2025-07-29', 'חשמלי', 'מנוי פסקל', '605005728', '2026-07-29', '2026-07-29', '2026-07-29', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'קרן סירי'),
  ('883-93-803', 'MG3', '2026', '2025-07-24', 'V', 'מנוי פסקל', '605197167', '2026-08-14', '2026-08-14', '', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'איתי קדם'),
  ('495-78-004', 'דאצ''יה', '2026', '2025-11-24', 'V', 'מנוי פסקל', '604879994', '2026-11-24', '2026-11-24', '2026-11-24', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'גרמן'),
  ('581-09-604', 'ג''אקו 5', '2026', '2026-03-03', 'V', 'מנוי פסקל', '605824312', '2026-03-02', '2026-03-02', '2026-03-02', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'יניב סלינס'),
  ('650-72-004', 'MG', '2026', '2026-09-01', 'V', 'מנוי פסקל', '605830922', '2026-09-01', '2026-10-04', '2026-10-04', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'קרן סירי'),
  ('650-72-104', 'MG', '2026', '2026-09-07', 'V', 'מנוי פסקל', '605473047', '2026-09-07', '2026-10-04', '2026-10-04', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'עדן סירי'),
  ('577-11-804', 'MG', '2026', '2026-09-16', 'V', 'מנוי פסקל', '605094265', '2026-09-16', '2026-09-16', '2026-09-16', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'יקיר ינאי'),
  ('762-48-204', 'D.N.Y', '2026', '2026-09-28', 'V', 'מנוי פסקל', '605851733', '2026-09-28', '2026-10-04', '2026-10-04', 'פרטי- איגוד ליסינג', 'גלובן', '', '', 'משה סירי'),
  ('803-66-601', 'נגרר פתוח', '2019', '', '', '-', '-', '', '', '-', 'פרטי- מאיה', 'גלובן', '', '', 'חב'' מאיה'),
  ('416-31-703', 'נגרר פתוח (חיים)', '', '', '', '-', '-', '', '', '-', 'פרטי- מאיה', 'גלובן', '', '', 'חב'' מאיה')
on conflict (plate_key) do nothing;
