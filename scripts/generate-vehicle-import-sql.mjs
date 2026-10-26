// Builds tmp/vehicle-import/import.sql from plan.json (folder scan) and
// extracted.json (document data read by Claude) for the Supabase SQL editor.
// Idempotent: new plates are inserted, existing vehicles only get EMPTY fields
// filled, policies/inspections are added when the same (vehicle, kind, valid_to)
// is not there yet. Uncertain or plate-mismatched documents are left out and
// listed in tmp/vehicle-import/sql-skipped.json.
//
//   node scripts/generate-vehicle-import-sql.mjs
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('tmp/vehicle-import');
const plan = JSON.parse(fs.readFileSync(path.join(OUT, 'plan.json'), 'utf8'));
const extracted = JSON.parse(fs.readFileSync(path.join(OUT, 'extracted.json'), 'utf8'));
const digits = (plate) => String(plate ?? '').replace(/\D/g, '');
const CRITICAL = { policy: ['valid_to', 'kind'], registration: ['valid_to'] };

const skipped = [];
const vehicles = [];

for (const v of plan.vehicles) {
  const d = digits(v.plate_number);
  const entry = {
    plate: v.plate_number, kind: v.kind, make_model: v.make_model, driver_name: v.driver_name,
    retired_reason: v.retiredReason || '', retired_on: v.retiredOn || null,
    ownership: null, is_electric: false, agent: '', policies: [], inspections: [],
    folder: v.folder,
  };
  const seenPolicy = new Set();
  const addPolicy = (p) => {
    const key = `${p.kind}|${p.valid_to}`;
    if (!p.valid_to || seenPolicy.has(key)) return;
    seenPolicy.add(key);
    entry.policies.push(p);
  };

  for (const item of v.analyze) {
    const [kind, ...rest] = item.split(': ');
    const rel = rest.join(': ');
    const result = extracted[`${d}|${rel}`];
    if (!result?.ok) { skipped.push({ plate: v.plate_number, file: rel, reason: result?.error || 'לא פוענח' }); continue; }
    const f = result.fields;
    const unsure = (result.uncertain || []).filter((k) => CRITICAL[kind]?.includes(k));
    if (f.plate_number && digits(f.plate_number) !== d) {
      skipped.push({ plate: v.plate_number, file: rel, reason: `מספר רישוי במסמך שונה: ${f.plate_number}` }); continue;
    }
    if (unsure.length || CRITICAL[kind].some((k) => !f[k])) {
      skipped.push({ plate: v.plate_number, file: rel, reason: `שדות לא ודאיים: ${unsure.join(',') || 'חסר'}`, fields: f }); continue;
    }
    if (kind === 'registration') {
      if (f.make_model) entry.make_model = f.make_model;
      if (f.ownership) entry.ownership = f.ownership;
      if (f.is_electric) entry.is_electric = true;
      entry.inspections.push({ valid_to: f.valid_to });
    } else {
      if (f.agent) entry.agent = entry.agent || f.agent;
      addPolicy({ kind: f.kind, insurer: f.insurer || '', agent: f.agent || '', policy_number: f.policy_number || '', valid_from: f.valid_from || null, valid_to: f.valid_to, premium_ils: f.premium_ils >= 0 ? f.premium_ils : null });
      const m = f.also_mandatory;
      if (m?.valid_to) addPolicy({ kind: 'mandatory', insurer: f.insurer || '', agent: f.agent || '', policy_number: m.policy_number || '', valid_from: m.valid_from || null, valid_to: m.valid_to, premium_ils: m.premium_ils >= 0 ? m.premium_ils : null });
    }
  }
  vehicles.push(entry);
}

const json = JSON.stringify(vehicles).replace(/\$json\$/g, '');
const sql = `-- Vehicle import generated from the vehicle folders (${vehicles.length} vehicles).
-- Safe to run more than once. Never overwrites existing values.
do $import$
declare
  d jsonb := $json$${json}$json$::jsonb;
  v jsonb;
  p jsonb;
  i jsonb;
  vid uuid;
  n_new int := 0;
  n_existing int := 0;
  n_pol int := 0;
  n_insp int := 0;
begin
  for v in select * from jsonb_array_elements(d) loop
    select id into vid from public.vehicles
      where regexp_replace(plate_number, '\\D', '', 'g') = regexp_replace(v->>'plate', '\\D', '', 'g');

    if vid is null then
      insert into public.vehicles (plate_number, kind, make_model, driver_name, ownership, is_electric, insurance_agent,
                                   status, retired_on, retired_reason, notes)
      values (v->>'plate', v->>'kind', coalesce(v->>'make_model', ''), coalesce(v->>'driver_name', ''),
              nullif(v->>'ownership', ''), coalesce((v->>'is_electric')::boolean, false), coalesce(v->>'agent', ''),
              case when coalesce(v->>'retired_reason', '') <> '' then 'retired' else 'in_use' end,
              nullif(v->>'retired_on', '')::date, coalesce(v->>'retired_reason', ''),
              'יובא מתיקיית הרכבים (' || (v->>'folder') || ')')
      returning id into vid;
      n_new := n_new + 1;
    else
      update public.vehicles set
        make_model = case when make_model = '' then coalesce(v->>'make_model', '') else make_model end,
        driver_name = case when driver_name = '' then coalesce(v->>'driver_name', '') else driver_name end,
        ownership = coalesce(ownership, nullif(v->>'ownership', '')),
        is_electric = is_electric or coalesce((v->>'is_electric')::boolean, false),
        insurance_agent = case when insurance_agent = '' then coalesce(v->>'agent', '') else insurance_agent end
      where id = vid;
      n_existing := n_existing + 1;
    end if;

    for p in select * from jsonb_array_elements(v->'policies') loop
      if not exists (select 1 from public.vehicle_insurance_policies
                     where vehicle_id = vid and kind = p->>'kind' and valid_to = (p->>'valid_to')::date) then
        insert into public.vehicle_insurance_policies
          (vehicle_id, kind, insurer, agent, policy_number, valid_from, valid_to, premium_ils, source)
        values (vid, p->>'kind', coalesce(p->>'insurer', ''), coalesce(p->>'agent', ''), coalesce(p->>'policy_number', ''),
                nullif(p->>'valid_from', '')::date, (p->>'valid_to')::date, (case when nullif(p->>'premium_ils', '')::numeric >= 0 then (p->>'premium_ils')::numeric end), 'ai');
        n_pol := n_pol + 1;
      end if;
    end loop;

    for i in select * from jsonb_array_elements(v->'inspections') loop
      if not exists (select 1 from public.vehicle_inspections
                     where vehicle_id = vid and valid_to = (i->>'valid_to')::date) then
        insert into public.vehicle_inspections (vehicle_id, valid_to, notes)
        values (vid, (i->>'valid_to')::date, 'פוענח מרישיון הרכב');
        n_insp := n_insp + 1;
      end if;
    end loop;
  end loop;
  raise notice 'new vehicles: %, existing: %, policies added: %, inspections added: %', n_new, n_existing, n_pol, n_insp;
end
$import$;

select (select count(*) from public.vehicles) as vehicles,
       (select count(*) from public.vehicle_insurance_policies) as policies,
       (select count(*) from public.vehicle_inspections) as inspections;
`;

fs.writeFileSync(path.join(OUT, 'import.sql'), sql);
fs.writeFileSync(path.join(OUT, 'sql-skipped.json'), JSON.stringify(skipped, null, 2));
console.log(`${vehicles.length} vehicles, ${vehicles.reduce((s, x) => s + x.policies.length, 0)} policies, ${vehicles.reduce((s, x) => s + x.inspections.length, 0)} inspections; ${skipped.length} documents skipped (see sql-skipped.json)`);
console.log(`SQL: ${path.join(OUT, 'import.sql')} (${(sql.length / 1024).toFixed(0)} KB)`);
