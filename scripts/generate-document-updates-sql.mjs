// Builds tmp/vehicle-import/documents-update.sql from the per-file reading of every
// document (all-results.json, plus the first-pass extracted.json) for the Supabase SQL editor:
//  - corrects doc_type / valid_to of each uploaded vehicle_documents row
//  - adds historical insurance policies and license expiries (inspections), linked to their document
//  - fills lease dates / ownership / manufacture year only where the vehicle field is empty
// Idempotent. Files whose printed plate differs from their folder are never applied
// and are listed in tmp/vehicle-import/documents-skipped.json.
//
//   node scripts/generate-document-updates-sql.mjs
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('tmp/vehicle-import');
const read = (name) => JSON.parse(fs.readFileSync(path.join(OUT, name), 'utf8'));
const plan = read('plan.json');
const second = read('all-results.json');
const first = read('extracted.json');
const digits = (plate) => String(plate ?? '').replace(/\D/g, '');
const isDate = (value) => typeof value === 'string' && /^20\d\d-\d\d-\d\d$/.test(value);
const date = (value) => (isDate(value) ? value : null);

const DOC_TYPE = {
  registration: 'registration', policy_mandatory: 'insurance_mandatory', policy_comprehensive: 'insurance_comprehensive',
  policy_endorsement: 'insurance_comprehensive', insurance_letter: 'insurance_comprehensive', lease_contract: 'lease_contract',
  inspection: 'inspection', fine: 'fine', fine_payment: 'fine_payment', photo: 'condition_photo',
  ownership_transfer: 'other', invoice: 'other', service: 'other', other: 'other',
};

// the first pass kept no doc_kind: infer it from the requested kind
function fromFirst(entry) {
  if (!entry?.ok) return null;
  const f = entry.fields;
  const docKind = f.insurer !== undefined || f.policy_number !== undefined || f.also_mandatory
    ? (f.kind === 'mandatory' ? 'policy_mandatory' : 'policy_comprehensive')
    : 'registration';
  return { ok: true, doc_kind: docKind, fields: f, uncertain: entry.uncertain || [] };
}

const normalizeKey = (key) => key.replace(/^(\d+\|)(\d{4})(?=[^\\\d])/, '$1$2\\');
const results = new Map();
for (const [key, value] of Object.entries(first)) results.set(key, fromFirst(value));
for (const [key, value] of Object.entries(second)) results.set(normalizeKey(key), value);

const skipped = [];
const vehicles = [];
const bestPolicy = (current, next) => (!current ? next : (next.valid_from ? 1 : 0) + (next.premium_ils != null ? 1 : 0) > (current.valid_from ? 1 : 0) + (current.premium_ils != null ? 1 : 0) ? next : current);

for (const v of plan.vehicles) {
  const d = digits(v.plate_number);
  const entry = { plate: v.plate_number, docs: [], inspections: [], lease: null, ownership: null, manufacture_year: null, ownership_label: '' };
  const policies = new Map();
  const inspections = new Map();

  for (const file of v.files) {
    if (!file.importable) continue;
    const result = results.get(`${d}|${file.rel}`);
    if (!result?.ok) continue;
    const f = result.fields || {};
    if (f.plate_mismatch || (f.plate_number && digits(f.plate_number) !== d)) {
      skipped.push({ plate: v.plate_number, file: file.rel, printed: f.plate_number, reason: 'מספר רישוי במסמך שונה' });
      continue;
    }
    const uncertain = new Set(result.uncertain || []);
    const kind = result.doc_kind;
    const docRef = { name: file.name, size: file.size };
    const validTo = ['registration', 'policy_mandatory', 'policy_comprehensive', 'inspection'].includes(kind) && !uncertain.has('valid_to') ? date(f.valid_to) : null;
    entry.docs.push({ ...docRef, doc_type: DOC_TYPE[kind] || 'other', valid_to: validTo });

    if (kind === 'registration') {
      if (validTo) inspections.set(validTo, { valid_to: validTo, doc: docRef });
      if (f.ownership && !uncertain.has('ownership')) entry.ownership = entry.ownership || f.ownership;
      if (Number.isInteger(f.manufacture_year) && f.manufacture_year >= 1980 && !uncertain.has('manufacture_year')) entry.manufacture_year = entry.manufacture_year || f.manufacture_year;
    } else if (kind === 'policy_mandatory' || kind === 'policy_comprehensive') {
      const policyKind = ['mandatory', 'comprehensive', 'third_party'].includes(f.kind) ? f.kind : kind === 'policy_mandatory' ? 'mandatory' : 'comprehensive';
      const premium = (value) => (typeof value === 'number' && value >= 0 ? value : null);
      const from = (value) => (date(value) && date(f.valid_to) && date(value) <= date(f.valid_to) ? date(value) : null);
      const add = (policy) => { if (policy.valid_to && !uncertain.has('kind')) policies.set(`${policy.kind}|${policy.valid_to}`, bestPolicy(policies.get(`${policy.kind}|${policy.valid_to}`), policy)); };
      add({ kind: policyKind, insurer: f.insurer || '', agent: f.agent || '', policy_number: f.policy_number || '', valid_from: from(f.valid_from), valid_to: validTo, premium_ils: premium(f.premium_ils), doc: docRef });
      const m = f.also_mandatory;
      if (m && date(m.valid_to)) add({ kind: 'mandatory', insurer: f.insurer || '', agent: f.agent || '', policy_number: m.policy_number || '', valid_from: date(m.valid_from) && date(m.valid_from) <= date(m.valid_to) ? date(m.valid_from) : null, valid_to: date(m.valid_to), premium_ils: premium(m.premium_ils), doc: docRef });
    } else if (kind === 'lease_contract' && date(f.lease_start) && date(f.lease_end) && f.lease_end >= f.lease_start && !uncertain.has('lease_end')) {
      if (!entry.lease || f.lease_end > entry.lease.end) entry.lease = { start: f.lease_start, end: f.lease_end, lessor: f.lessor || '' };
    }
  }
  entry.policies = [...policies.values()];
  entry.inspections = [...inspections.values()];
  vehicles.push(entry);
}

const json = JSON.stringify(vehicles).replace(/\$json\$/g, '');
const sql = `-- Document-level updates from reading every vehicle file (${vehicles.length} vehicles).
-- Idempotent; fills only empty vehicle fields; run once the documents are uploaded.
do $docs$
declare
  d jsonb := $json$${json}$json$::jsonb;
  v jsonb; x jsonb; vid uuid; doc_id uuid;
  n_docs int := 0; n_pol int := 0; n_insp int := 0; n_missing int := 0;
begin
  for v in select * from jsonb_array_elements(d) loop
    select id into vid from public.vehicles
      where regexp_replace(plate_number, '\\D', '', 'g') = regexp_replace(v->>'plate', '\\D', '', 'g');
    if vid is null then n_missing := n_missing + 1; continue; end if;

    for x in select * from jsonb_array_elements(v->'docs') loop
      update public.vehicle_documents set doc_type = x->>'doc_type', valid_to = coalesce(nullif(x->>'valid_to', '')::date, valid_to)
      where vehicle_id = vid and original_name = x->>'name' and size_bytes = (x->>'size')::bigint
        and (doc_type <> x->>'doc_type' or (nullif(x->>'valid_to', '') is not null and valid_to is distinct from (x->>'valid_to')::date));
      if found then n_docs := n_docs + 1; end if;
    end loop;

    for x in select * from jsonb_array_elements(v->'policies') loop
      select id into doc_id from public.vehicle_documents
        where vehicle_id = vid and original_name = x->'doc'->>'name' and size_bytes = (x->'doc'->>'size')::bigint limit 1;
      if not exists (select 1 from public.vehicle_insurance_policies
                     where vehicle_id = vid and kind = x->>'kind' and valid_to = (x->>'valid_to')::date) then
        insert into public.vehicle_insurance_policies
          (vehicle_id, kind, insurer, agent, policy_number, valid_from, valid_to, premium_ils, source, document_id)
        values (vid, x->>'kind', coalesce(x->>'insurer', ''), coalesce(x->>'agent', ''), coalesce(x->>'policy_number', ''),
                nullif(x->>'valid_from', '')::date, (x->>'valid_to')::date, nullif(x->>'premium_ils', '')::numeric, 'ai', doc_id);
        n_pol := n_pol + 1;
      else
        update public.vehicle_insurance_policies set document_id = doc_id
        where vehicle_id = vid and kind = x->>'kind' and valid_to = (x->>'valid_to')::date and document_id is null and doc_id is not null;
      end if;
    end loop;

    for x in select * from jsonb_array_elements(v->'inspections') loop
      select id into doc_id from public.vehicle_documents
        where vehicle_id = vid and original_name = x->'doc'->>'name' and size_bytes = (x->'doc'->>'size')::bigint limit 1;
      if not exists (select 1 from public.vehicle_inspections where vehicle_id = vid and valid_to = (x->>'valid_to')::date) then
        insert into public.vehicle_inspections (vehicle_id, valid_to, notes, document_id)
        values (vid, (x->>'valid_to')::date, 'פוענח מרישיון הרכב', doc_id);
        n_insp := n_insp + 1;
      else
        update public.vehicle_inspections set document_id = doc_id
        where vehicle_id = vid and valid_to = (x->>'valid_to')::date and document_id is null and doc_id is not null;
      end if;
    end loop;

    update public.vehicles set
      ownership = coalesce(ownership, nullif(v->>'ownership', '')),
      manufacture_year = coalesce(manufacture_year, nullif(v->>'manufacture_year', '')::int),
      lease_start = case when lease_start is null and lease_end is null and v->'lease' <> 'null'::jsonb then nullif(v->'lease'->>'start', '')::date else lease_start end,
      lease_end = case when lease_start is null and lease_end is null and v->'lease' <> 'null'::jsonb then nullif(v->'lease'->>'end', '')::date else lease_end end
    where id = vid;
  end loop;
  raise notice 'documents fixed: %, policies added: %, inspections added: %, vehicles not found: %', n_docs, n_pol, n_insp, n_missing;
end
$docs$;

select (select count(*) from public.vehicle_documents) as documents,
       (select count(*) from public.vehicle_documents where doc_type = 'other') as other_documents,
       (select count(*) from public.vehicle_insurance_policies) as policies,
       (select count(*) from public.vehicle_inspections) as inspections;
`;

fs.writeFileSync(path.join(OUT, 'documents-update.sql'), sql);
fs.writeFileSync(path.join(OUT, 'documents-skipped.json'), JSON.stringify(skipped, null, 2));
const count = (key) => vehicles.reduce((s, x) => s + x[key].length, 0);
console.log(`${vehicles.length} vehicles; docs ${count('docs')}, policies ${count('policies')}, inspections ${count('inspections')}, leases ${vehicles.filter((x) => x.lease).length}; skipped ${skipped.length}`);
console.log(`SQL: ${path.join(OUT, 'documents-update.sql')} (${(sql.length / 1024).toFixed(0)} KB)`);
