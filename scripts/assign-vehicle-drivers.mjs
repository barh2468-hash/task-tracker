// Links vehicles' free-text driver_name to system users (vehicles.driver_id),
// using the same matching as the "התאמת נהגים" screen. Only confident matches
// are written; everything else is listed for manual review in the app.
//
//   node scripts/assign-vehicle-drivers.mjs dry-run
//   node scripts/assign-vehicle-drivers.mjs apply
//
// Auth (either): SUPABASE_SERVICE_ROLE_KEY, or MAYA_EMAIL + MAYA_PASSWORD of a
// manager / fleet user. Read from the environment only.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { buildDriverMatches } from '../src/features/vehicles/utils/matchDrivers.js';

const MODE = process.argv[2] || 'dry-run';
const write = MODE === 'apply';
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
    return { client: createClient(url, serviceKey, { auth: { persistSession: false } }), service: true };
  }
  const anon = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  const { MAYA_EMAIL: email, MAYA_PASSWORD: password } = process.env;
  if (!email || !password) throw new Error('הגדירי SUPABASE_SERVICE_ROLE_KEY, או MAYA_EMAIL ו-MAYA_PASSWORD');
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`התחברות נכשלה: ${error.message}`);
  return { client, service: false };
}

const { client, service } = await connect();

// fleet_driver_candidates() checks auth.uid(), so the service role reads profiles directly.
const candidates = service
  ? must(await client.from('profiles').select('id, full_name, email'))
  : must(await client.rpc('fleet_driver_candidates'));
const vehicles = must(await client.from('vehicles').select('id, plate_number, holder_type, driver_name, driver_id'));
console.log(`${vehicles.length} רכבים, ${candidates.length} משתמשים. מצב: ${write ? 'כתיבה' : 'קריאה בלבד (dry-run)'}\n`);

const rows = buildDriverMatches(vehicles, candidates);
const confident = rows.filter((row) => row.preselected);
const review = rows.filter((row) => !row.preselected);

console.log(`== התאמות ודאיות (${confident.length}) — ישויכו ==`);
for (const { vehicle, preselected } of confident) {
  console.log(`${vehicle.plate_number}\t"${vehicle.driver_name}"  →  ${preselected.full_name}`);
}

console.log(`\n== לבדיקה ידנית באפליקציה (${review.length}) — לא ישויכו ==`);
for (const { vehicle, suggestions } of review) {
  const hint = suggestions.length
    ? suggestions.map(({ candidate, score }) => `${candidate.full_name} (${score})`).join(', ')
    : 'אין הצעה';
  console.log(`${vehicle.plate_number}\t"${vehicle.driver_name}"  ?  ${hint}`);
}

if (!write) {
  console.log('\ndry-run בלבד, לא נכתב דבר. להרצה: node scripts/assign-vehicle-drivers.mjs apply');
} else {
  let done = 0;
  for (const { vehicle, preselected } of confident) {
    const { error } = await client.from('vehicles').update({ driver_id: preselected.id }).eq('id', vehicle.id);
    if (error) console.error(`נכשל ${vehicle.plate_number}: ${error.message}`);
    else done += 1;
  }
  console.log(`\nשויכו ${done} מתוך ${confident.length}.`);
}
