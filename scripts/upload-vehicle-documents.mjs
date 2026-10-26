// Uploads the vehicle folder documents to Storage and registers them in
// vehicle_documents, then links each analysed file to its policy / inspection.
// Run after the SQL import (vehicles must already exist). Idempotent: a file with
// the same name + size on the same vehicle is skipped.
//
//   node scripts/upload-vehicle-documents.mjs dry-run
//   node scripts/upload-vehicle-documents.mjs apply
//
// Auth (either): SUPABASE_SERVICE_ROLE_KEY (Supabase > Project Settings > API),
// or MAYA_EMAIL + MAYA_PASSWORD of a manager. Read from the environment only.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const MODE = process.argv[2] || 'dry-run';
const OUT = path.resolve('tmp/vehicle-import');
const BUCKET = 'vehicle-documents';
const digits = (plate) => String(plate ?? '').replace(/\D/g, '');
const must = ({ data, error }) => { if (error) throw error; return data; };

function loadEnv() {
  const env = {};
  for (const file of ['.env.local', '.env']) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

async function connect() {
  const env = loadEnv();
  const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return { client: createClient(url, serviceKey, { auth: { persistSession: false } }), userId: null };
  }
  const anon = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  const { MAYA_EMAIL: email, MAYA_PASSWORD: password } = process.env;
  if (!email || !password) throw new Error('הגדירי SUPABASE_SERVICE_ROLE_KEY, או MAYA_EMAIL ו-MAYA_PASSWORD');
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`התחברות נכשלה: ${error.message}`);
  return { client, userId: data.user.id };
}

const plan = JSON.parse(fs.readFileSync(path.join(OUT, 'plan.json'), 'utf8'));
const extracted = JSON.parse(fs.readFileSync(path.join(OUT, 'extracted.json'), 'utf8'));
const write = MODE === 'apply';
const { client, userId } = await connect();

const vehicleRows = must(await client.from('vehicles').select('id, plate_number'));
const idByPlate = new Map(vehicleRows.map((r) => [digits(r.plate_number), r.id]));
console.log(`${vehicleRows.length} רכבים במערכת. מצב: ${write ? 'כתיבה' : 'קריאה בלבד'}`);

const report = { uploaded: 0, existing: 0, failed: [], missingVehicle: [], skipped: [], linked: 0 };

for (const vehicle of plan.vehicles) {
  const vehicleId = idByPlate.get(digits(vehicle.plate_number));
  if (!vehicleId) { report.missingVehicle.push(vehicle.plate_number); continue; }

  const stored = must(await client.from('vehicle_documents').select('id, original_name, size_bytes').eq('vehicle_id', vehicleId));
  const docByKey = new Map(stored.map((d) => [`${d.original_name}|${d.size_bytes}`, d]));
  const docByRel = new Map();
  let uploaded = 0;

  for (const file of vehicle.files) {
    if (!file.importable) { report.skipped.push(`${vehicle.plate_number}: ${file.rel} (${file.skipReason})`); continue; }
    const key = `${file.name}|${file.size}`;
    const known = docByKey.get(key);
    if (known) { docByRel.set(file.rel, known); report.existing += 1; continue; }
    if (!write) { uploaded += 1; continue; }
    const storagePath = `vehicles/${vehicleId}/${file.docType}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    try {
      const up = await client.storage.from(BUCKET).upload(storagePath, fs.readFileSync(path.join(vehicle.dir, file.rel)), { contentType: file.mime });
      if (up.error) throw up.error;
      const doc = must(await client.from('vehicle_documents').insert({
        vehicle_id: vehicleId, doc_type: file.docType, file_path: storagePath, original_name: file.name,
        mime_type: file.mime, size_bytes: file.size, uploaded_by: userId, notes: file.rank ? `שנה ${file.rank}` : '',
      }).select('id, original_name, size_bytes').single());
      docByRel.set(file.rel, doc);
      docByKey.set(key, doc);
      uploaded += 1;
    } catch (error) {
      report.failed.push(`${vehicle.plate_number}: ${file.rel}: ${error.message || error}`);
    }
  }
  report.uploaded += uploaded;

  // link analysed files to the policy / inspection they were read for
  if (write) {
    for (const item of vehicle.analyze) {
      const [kind, ...rest] = item.split(': ');
      const rel = rest.join(': ');
      const doc = docByRel.get(rel);
      const f = extracted[`${digits(vehicle.plate_number)}|${rel}`]?.fields;
      if (!doc || !f?.valid_to) continue;
      if (kind === 'registration') {
        const rows = must(await client.from('vehicle_inspections').update({ document_id: doc.id }).eq('vehicle_id', vehicleId).eq('valid_to', f.valid_to).is('document_id', null).select('id'));
        report.linked += rows.length;
      } else {
        for (const [policyKind, validTo] of [[f.kind, f.valid_to], ['mandatory', f.also_mandatory?.valid_to]]) {
          if (!policyKind || !validTo) continue;
          const rows = must(await client.from('vehicle_insurance_policies').update({ document_id: doc.id }).eq('vehicle_id', vehicleId).eq('kind', policyKind).eq('valid_to', validTo).is('document_id', null).select('id'));
          report.linked += rows.length;
        }
      }
    }
  }
  console.log(`${vehicle.plate_number} ${vehicle.make_model}: ${write ? 'הועלו' : 'להעלאה'} ${uploaded}, כבר היו ${stored.length}`);
}

fs.writeFileSync(path.join(OUT, `documents-${MODE}.json`), JSON.stringify(report, null, 2));
console.log(`\nסיכום: ${write ? 'הועלו' : 'יועלו'} ${report.uploaded}, כבר קיימים ${report.existing}, נכשלו ${report.failed.length}, לא הועלו (סוג/גודל) ${report.skipped.length}, רכבים שלא נמצאו ${report.missingVehicle.length}, קושרו לפוליסה/טסט ${report.linked}`);
console.log(`פירוט: ${path.join(OUT, `documents-${MODE}.json`)}`);
