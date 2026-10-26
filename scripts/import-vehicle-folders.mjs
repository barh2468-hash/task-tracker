// One-off migration: reads a folder of per-vehicle folders, matches each to the
// register by plate, and (in apply mode) fills empty fields, uploads documents
// and runs the AI document analysis.
//
//   node scripts/import-vehicle-folders.mjs scan    [rootDir]   no login, writes the plan
//   node scripts/import-vehicle-folders.mjs dry-run [rootDir]   logs in, read-only comparison
//   node scripts/import-vehicle-folders.mjs apply   [rootDir]   writes (idempotent, safe to re-run)
//
// Login (dry-run/apply): set MAYA_EMAIL and MAYA_PASSWORD of a manager account.
// The password is only read from the environment, never stored or printed.
// Existing values are never overwritten; uncertain AI results go to review.json
// instead of the database.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const MODE = process.argv[2] || 'scan';
const ROOT = process.argv[3] || 'D:\\רכבים פרטי';
const OUT = path.resolve('tmp/vehicle-import');
const BUCKET = 'vehicle-documents';
const MAX_BYTES = 10 * 1024 * 1024;
const MIME = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
const SKIP_DIRS = new Set(['תיקיית רכבים לניתאי']); // reported, not imported: mixed collection

// ------------------------------------------------------------------ naming
const digits = (plate) => String(plate ?? '').replace(/\D/g, '');
function formatPlate(raw) {
  const d = digits(raw);
  if (d.length === 7) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  if (d.length === 8) return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
  return raw;
}

const RETIRED_WORDS = [
  [/נמכר[הו]?/, 'נמכר'], [/נגנב[הו]?/, 'נגנב'], [/הושבת[הו]?|מושבת/, 'הושבת'],
  [/הוחזר[הו]?/, 'הוחזר'], [/הורד[הו]? מהכביש/, 'הורד מהכביש'],
];

function parseFolderName(name) {
  const match = name.match(/(\d{2,3})-(\d{2,3})-(\d{2,3})/);
  if (!match) return null;
  const before = name.slice(0, match.index).replace(/[\s-]+$/, '').trim();
  let after = name.slice(match.index + match[0].length).replace(/^[\s-]+/, '').trim();
  let retiredReason = '';
  let retiredOn = null;
  for (const [pattern, label] of RETIRED_WORDS) {
    if (pattern.test(after) || pattern.test(before)) retiredReason = retiredReason || label;
  }
  const dateMatch = after.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dateMatch) retiredOn = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
  after = after.replace(/[-\s]*(נמכר[הו]?|נגנב[הו]?|הושבת[הו]?!?|מושבת|הוחזר[הו]?|חדש|הורד[הו]? מהכביש)[\s\d.]*/g, ' ').replace(/\s+-\s*$/, '').trim();
  const isTrailer = /נגרר/.test(before);
  return {
    plate_number: formatPlate(match[0]),
    kind: isTrailer ? 'trailer' : 'car',
    make_model: isTrailer ? 'נגרר' : before === 'רכב' ? '' : before,
    driver_name: after.replace(/\s*-\s*/g, ' / ').trim(),
    retiredReason,
    retiredOn,
  };
}

// ------------------------------------------------------------ file classes
function classify(fileName) {
  const n = fileName.toLowerCase();
  if (/רישיון|רשיון|רישיןו|carlicense|license/.test(n)) return 'registration';
  if (/חובה/.test(n)) return 'insurance_mandatory';
  if (/מבוטח|פוליסה|מקיף|חידוש/.test(n)) return 'insurance_comprehensive';
  if (/שעבוד|משעבד|ליסינג|חוזה/.test(n)) return 'lease_contract';
  if (/דוח|דו"ח|דו״ח/.test(n)) return 'fine';
  return 'other';
}

function yearRank(relDir) {
  const years = [...relDir.matchAll(/(?:^|[\\/])(20\d\d)(?:-(20\d\d))?(?=$|[\\/])/g)].map((m) => Number(m[2] || m[1]));
  return years.length ? Math.max(...years) : 0;
}

function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [{ full, rel: path.relative(base, full), name: entry.name }];
  });
}

function scanVehicleDir(dir, name, group) {
  const parsed = parseFolderName(name);
  if (!parsed) return null;
  const files = walk(dir).map((file) => {
    const ext = path.extname(file.name).toLowerCase();
    const stat = fs.statSync(file.full);
    const importable = Boolean(MIME[ext]) && stat.size <= MAX_BYTES;
    return {
      full: file.full, rel: file.rel, name: file.name, size: stat.size, mtime: stat.mtimeMs,
      mime: MIME[ext] || null,
      docType: classify(file.name),
      rank: yearRank(path.dirname(file.rel)),
      importable,
      skipReason: importable ? '' : !MIME[ext] ? `סוג ${ext || 'לא ידוע'}` : 'מעל 10MB',
    };
  }).filter((file) => file.name !== 'Thumbs.db');
  return { folder: name, group, dir, ...parsed, files };
}

function scanRoot() {
  const vehicles = [];
  const notes = [];
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(ROOT, entry.name);
    if (SKIP_DIRS.has(entry.name)) { notes.push(`דולגה: ${entry.name} (אוסף מעורב, לבדיקה נפרדת)`); continue; }
    if (entry.name.startsWith('א-')) { // archive: one sub-folder per old vehicle
      for (const sub of fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
        const v = scanVehicleDir(path.join(dir, sub.name), sub.name, 'archive');
        if (v) vehicles.push(v); else notes.push(`ארכיון: לא זוהה מספר רישוי בתיקייה ${sub.name}`);
      }
      continue;
    }
    const v = scanVehicleDir(dir, entry.name, 'active');
    if (v) vehicles.push(v); else notes.push(`לא זוהה מספר רישוי: ${entry.name}`);
  }
  return { vehicles, notes };
}

// Newest-year documents drive the records; older ones are uploaded as history only.
function filesToAnalyze(vehicle) {
  const pick = (types) => {
    const pool = vehicle.files.filter((f) => f.importable && types.includes(f.docType));
    if (!pool.length) return [];
    const top = Math.max(...pool.map((f) => f.rank));
    return pool.filter((f) => f.rank === top).sort((a, b) => b.mtime - a.mtime).slice(0, 2);
  };
  return [
    ...pick(['registration']).slice(0, 1).map((f) => ({ file: f, kind: 'registration' })),
    ...pick(['insurance_mandatory', 'insurance_comprehensive']).map((f) => ({ file: f, kind: 'policy' })),
  ];
}

// ----------------------------------------------------------------- session
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

async function login() {
  const env = loadEnv();
  const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  const { MAYA_EMAIL: email, MAYA_PASSWORD: password } = process.env;
  if (!url || !key) throw new Error('חסרים VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ב-.env.local');
  if (!email || !password) throw new Error('הגדירי MAYA_EMAIL ו-MAYA_PASSWORD (חשבון מנהלת) כמשתני סביבה');
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`התחברות נכשלה: ${error.message}`);
  return { client, userId: data.user.id };
}

const must = ({ data, error }) => { if (error) throw error; return data; };

// ------------------------------------------------------------------- apply
// Document data is extracted beforehand (read from the files by Claude) into
// tmp/vehicle-import/extracted.json, keyed "<plate digits>|<path relative to the vehicle folder>":
//   { ok: true, fields: {...}, uncertain: [...] }
// so the import needs no LLM connection from the server.
const EXTRACTED_FILE = path.join(OUT, 'extracted.json');
const EXTRACTED = fs.existsSync(EXTRACTED_FILE) ? JSON.parse(fs.readFileSync(EXTRACTED_FILE, 'utf8')) : {};
const extractedFor = (vehicle, file) => EXTRACTED[`${digits(vehicle.plate_number)}|${file.rel}`] || { ok: false, error: 'לא פוענח' };

const CRITICAL = { policy: ['valid_to', 'kind'], registration: ['valid_to'] };

async function processVehicle(client, userId, vehicle, existing, write, review, log) {
  const row = existing.get(digits(vehicle.plate_number));
  const result = { plate: vehicle.plate_number, folder: vehicle.folder, action: row ? 'exists' : 'new', uploaded: 0, skippedDocs: 0, filled: [], ai: [], mismatches: [] };

  if (row && vehicle.retiredReason && row.status !== 'retired') {
    result.mismatches.push(`בתיקייה: ${vehicle.retiredReason}; במערכת: ${row.status}`);
  }
  if (!row) {
    if (!write) return result;
    const status = vehicle.retiredReason ? 'retired' : 'in_use';
    const payload = {
      plate_number: vehicle.plate_number, kind: vehicle.kind, make_model: vehicle.make_model,
      driver_name: vehicle.driver_name, status, created_by: userId, notes: `יובא מתיקיית הרכבים (${vehicle.folder})`,
      ...(status === 'retired' ? { retired_reason: vehicle.retiredReason, retired_on: vehicle.retiredOn } : {}),
    };
    const created = must(await client.from('vehicles').insert(payload).select().single());
    existing.set(digits(created.plate_number), created);
  }
  let vehicleRow = existing.get(digits(vehicle.plate_number));

  const fill = async (patch) => {
    const empty = Object.fromEntries(Object.entries(patch).filter(([k, v]) => {
      const current = vehicleRow?.[k];
      return v !== null && v !== '' && v !== undefined && (current === null || current === undefined || current === '');
    }));
    if (!Object.keys(empty).length) return;
    result.filled.push(...Object.keys(empty));
    if (write) { vehicleRow = must(await client.from('vehicles').update(empty).eq('id', vehicleRow.id).select().single()); existing.set(digits(vehicle.plate_number), vehicleRow); }
  };
  if (row) await fill({ make_model: vehicle.make_model, driver_name: vehicle.driver_name });
  if (!write) {
    result.wouldUpload = vehicle.files.filter((f) => f.importable).length;
    result.notImportable = vehicle.files.length - result.wouldUpload;
    return result;
  }

  // documents: skip anything already stored (same name + size)
  const stored = must(await client.from('vehicle_documents').select('id, original_name, size_bytes, file_path').eq('vehicle_id', vehicleRow.id));
  const byKey = new Map(stored.map((d) => [`${d.original_name}|${d.size_bytes}`, d]));
  const uploaded = new Map();
  for (const file of vehicle.files) {
    if (!file.importable) { result.skippedDocs += 1; continue; }
    const key = `${file.name}|${file.size}`;
    if (byKey.has(key)) { uploaded.set(file.full, byKey.get(key)); continue; }
    const storagePath = `vehicles/${vehicleRow.id}/${file.docType}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const up = await client.storage.from(BUCKET).upload(storagePath, fs.readFileSync(file.full), { contentType: file.mime });
    if (up.error) { log(`  ! העלאה נכשלה ${file.rel}: ${up.error.message}`); result.skippedDocs += 1; continue; }
    const doc = must(await client.from('vehicle_documents').insert({
      vehicle_id: vehicleRow.id, doc_type: file.docType, file_path: storagePath, original_name: file.name,
      mime_type: file.mime, size_bytes: file.size, uploaded_by: userId,
      notes: file.rank ? `שנה ${file.rank}` : '',
    }).select().single());
    uploaded.set(file.full, doc);
    result.uploaded += 1;
  }

  // AI: newest registration + policies only
  for (const { file, kind } of filesToAnalyze(vehicle)) {
    const doc = uploaded.get(file.full);
    if (!doc) continue;
    const ai = extractedFor(vehicle, file);
    if (!ai.ok) { review.push({ plate: vehicle.plate_number, file: file.rel, kind, problem: ai.error || 'ai_failed' }); result.ai.push(`${file.name}: ${ai.error}`); continue; }
    const f = ai.fields;
    const unsure = (ai.uncertain || []).filter((k) => (CRITICAL[kind] || []).includes(k));
    const plateOk = !f.plate_number || digits(f.plate_number) === digits(vehicle.plate_number);
    if (!plateOk || unsure.length || (CRITICAL[kind] || []).some((k) => !f[k])) {
      review.push({ plate: vehicle.plate_number, file: file.rel, kind, fields: f, uncertain: ai.uncertain, problem: plateOk ? 'שדות קריטיים לא ודאיים' : `מספר רישוי במסמך (${f.plate_number}) שונה` });
      result.ai.push(`${file.name}: לבדיקה ידנית`);
      continue;
    }
    if (kind === 'registration') {
      await fill({ make_model: f.make_model, manufacture_year: f.manufacture_year, ownership: f.ownership, is_electric: f.is_electric || undefined });
      const dup = must(await client.from('vehicle_inspections').select('id').eq('vehicle_id', vehicleRow.id).eq('valid_to', f.valid_to));
      if (!dup.length) {
        must(await client.from('vehicle_inspections').insert({ vehicle_id: vehicleRow.id, inspected_on: f.inspected_on || null, valid_to: f.valid_to, document_id: doc.id, created_by: userId, notes: 'פוענח מרישיון הרכב' }).select());
        result.ai.push(`טסט עד ${f.valid_to}`);
      }
    } else {
      const dup = must(await client.from('vehicle_insurance_policies').select('id').eq('vehicle_id', vehicleRow.id).eq('kind', f.kind).eq('valid_to', f.valid_to));
      if (!dup.length) {
        must(await client.from('vehicle_insurance_policies').insert({
          vehicle_id: vehicleRow.id, kind: f.kind, insurer: f.insurer || '', agent: f.agent || '', policy_number: f.policy_number || '',
          valid_from: f.valid_from || null, valid_to: f.valid_to, premium_ils: f.premium_ils ?? null, source: 'ai', document_id: doc.id, created_by: userId,
        }).select());
        result.ai.push(`פוליסה ${f.kind} עד ${f.valid_to}`);
      }
      // A combined copy also carries the mandatory (חובה) policy.
      const mandatory = f.also_mandatory;
      if (mandatory?.valid_to) {
        const dupMandatory = must(await client.from('vehicle_insurance_policies').select('id').eq('vehicle_id', vehicleRow.id).eq('kind', 'mandatory').eq('valid_to', mandatory.valid_to));
        if (!dupMandatory.length) {
          must(await client.from('vehicle_insurance_policies').insert({
            vehicle_id: vehicleRow.id, kind: 'mandatory', insurer: f.insurer || '', agent: f.agent || '', policy_number: mandatory.policy_number || '',
            valid_from: mandatory.valid_from || null, valid_to: mandatory.valid_to, premium_ils: mandatory.premium_ils ?? null, source: 'ai', document_id: doc.id, created_by: userId,
          }).select());
          result.ai.push(`פוליסת חובה עד ${mandatory.valid_to}`);
        }
      }
      if (f.agent) await fill({ insurance_agent: f.agent });
    }
  }
  return result;
}

// -------------------------------------------------------------------- main
fs.mkdirSync(OUT, { recursive: true });
const log = (line) => console.log(line);
const { vehicles, notes } = scanRoot();
fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify({ root: ROOT, notes, vehicles: vehicles.map(({ files, ...v }) => ({ ...v, files: files.map(({ full, ...f }) => f), analyze: filesToAnalyze({ files }).map((a) => `${a.kind}: ${a.file.rel}`) })) }, null, 2));

if (MODE === 'scan') {
  const byPlate = new Map();
  for (const v of vehicles) byPlate.set(digits(v.plate_number), [...(byPlate.get(digits(v.plate_number)) || []), v.folder]);
  log(`${vehicles.length} תיקיות רכב זוהו (${vehicles.filter((v) => v.group === 'archive').length} בארכיון).`);
  for (const [plate, folders] of byPlate) if (folders.length > 1) log(`כפילות לוחית ${plate}: ${folders.join(' | ')}`);
  for (const v of vehicles) {
    const skipped = v.files.filter((f) => !f.importable).length;
    log(`${v.plate_number}\t${v.kind}\t${v.make_model}\t${v.driver_name}\t${v.retiredReason}\tקבצים=${v.files.length} להעלאה=${v.files.length - skipped}`);
  }
  notes.forEach((n) => log(n));
  log(`התוכנית נכתבה ל-${path.join(OUT, 'plan.json')}`);
} else {
  const write = MODE === 'apply';
  const { client, userId } = await login();
  const rows = must(await client.from('vehicles').select('*'));
  const existing = new Map(rows.map((r) => [digits(r.plate_number), r]));
  log(`${rows.length} רכבים קיימים במערכת. מצב: ${write ? 'כתיבה' : 'קריאה בלבד'}`);
  const review = [];
  const results = [];
  for (const vehicle of vehicles) {
    try {
      const r = await processVehicle(client, userId, vehicle, existing, write, review, log);
      results.push(r);
      log(`${r.action === 'new' ? '＋' : '='} ${r.plate} ${vehicle.make_model} | הועלו ${r.uploaded} | עודכנו: ${r.filled.join(',') || '-'} | ${r.ai.join('; ') || '-'}${r.mismatches.length ? ' | ' + r.mismatches.join('; ') : ''}`);
    } catch (error) {
      results.push({ plate: vehicle.plate_number, error: String(error.message || error) });
      log(`! ${vehicle.plate_number}: ${error.message || error}`);
    }
  }
  fs.writeFileSync(path.join(OUT, `${MODE}-result.json`), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT, 'review.json'), JSON.stringify(review, null, 2));
  log(`סיום. חדשים: ${results.filter((r) => r.action === 'new').length}, קיימים: ${results.filter((r) => r.action === 'exists').length}, לבדיקה ידנית: ${review.length}`);
}
