-- APPLY: sets vehicles.driver_id for the confident matches (see assign-vehicle-drivers.sql).
with veh as (
  select id, plate_number, driver_name
  from public.vehicles
  where coalesce(holder_type, '') <> 'company'
    and nullif(trim(driver_name), '') is not null
    and driver_id is null
),
segs as (
  select v.id as vehicle_id,
         array(
           select distinct t
           from unnest(regexp_split_to_array(
             trim(regexp_replace(lower(s), '["''׳״`.,()–-]', ' ', 'g')), '\s+')) t
           where t <> ''
         ) as toks
  from veh v, regexp_split_to_table(v.driver_name, '[/\\]') s
),
segs_ok as (
  select * from segs where cardinality(toks) > 0 and toks <> array['משרד']
),
cand as (
  select p.id, p.full_name,
         array(
           select distinct t
           from unnest(regexp_split_to_array(
             trim(regexp_replace(lower(p.full_name), '["''׳״`.,()–-]', ' ', 'g')), '\s+')) t
           where t <> ''
         ) as toks
  from public.profiles p
),
pair as (
  select s.vehicle_id, c.id as user_id, c.full_name,
         max(case
           when sh = 0 then 0
           when sh = cardinality(s.toks) and sh = cardinality(c.toks) then 1
           when sh = least(cardinality(s.toks), cardinality(c.toks)) and sh >= 2 then 0.9
           when sh >= 2 then 0.6
           else 0.4
         end) as score
  from segs_ok s
  cross join cand c
  cross join lateral (select count(*) as sh from unnest(s.toks) t where t = any(c.toks)) x
  group by s.vehicle_id, c.id, c.full_name
),
ranked as (
  select *,
         row_number() over (partition by vehicle_id order by score desc, full_name) as rn,
         lead(score) over (partition by vehicle_id order by score desc, full_name) as next_score
  from pair
),
confident as (
  select * from ranked
  where rn = 1 and score >= 0.85 and (next_score is null or score - next_score >= 0.1)
)
update public.vehicles v
set driver_id = c.user_id
from confident c
where v.id = c.vehicle_id and v.driver_id is null
returning v.plate_number, v.driver_name, v.driver_id;
