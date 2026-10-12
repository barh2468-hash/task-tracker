import {
  deleteFine,
  getFines,
  insertFine,
  rpcFineHolderAt,
  updateFine,
  deleteInsurancePolicy,
  deleteInspection,
  deleteOdometerReading,
  deleteTollSubscription,
  deleteVehicle,
  deleteVehicleDocument,
  getAllInspections,
  getAllInsurancePolicies,
  getAllOdometerReadings,
  getAllTollSubscriptions,
  getVehicleAssignments,
  getDriverCandidates,
  getInspections,
  getInsurancePolicies,
  getOdometerReadings,
  getTollSubscriptions,
  getVehicle,
  getVehicleDocuments,
  getVehicles,
  insertInspection,
  insertInsurancePolicies,
  insertVehicle,
  insertVehicleDocument,
  insertVehicles,
  updateInspection,
  updateInsurancePolicy,
  updateVehicle,
  upsertOdometerReading,
  upsertTollSubscriptions,
} from '../../services/api/vehicles.js';
import { createSignedUrl, removeFiles, safeFileName, uploadFile } from '../../services/api/storage.js';
import { analyzeVehicleDocument } from '../../services/api/edgeFunctions.js';
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, VEHICLE_BUCKET } from './constants.js';
import { currentMonthString } from './utils/vehicleStatus.js';

function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}

export function isSchemaMissing(error) {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

// Users a vehicle's driver can be linked to. Empty (not an error) while the
// lookup function is missing, so the register still loads before that
// migration has been applied.
export async function loadDriverCandidates() {
  const { data, error } = await getDriverCandidates();
  if (error) return [];
  return data || [];
}

/** links: [{ vehicleId, driverId }] - sets the account a vehicle's driver_name refers to. */
export async function linkVehicleDrivers(links) {
  await Promise.all(
    links.map(async ({ vehicleId, driverId }) => unwrap(await updateVehicle(vehicleId, { driver_id: driverId }))),
  );
}

// ---- register overview (list + alerts)
export async function loadFleetOverview() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 1);
  const [vehicles, policies, inspections, tolls, readings, drivers] = await Promise.all([
    getVehicles().then(unwrap),
    getAllInsurancePolicies().then(unwrap),
    getAllInspections().then(unwrap),
    getAllTollSubscriptions().then(unwrap),
    getAllOdometerReadings(currentMonthString(sixMonthsAgo)).then(unwrap),
    loadDriverCandidates(),
  ]);
  return { vehicles, policies, inspections, tolls, readings, drivers };
}

export async function loadVehicleDetail(vehicleId) {
  const vehicle = unwrap(await getVehicle(vehicleId));
  if (!vehicle) return null;
  const [policies, inspections, tolls, readings, documents] = await Promise.all([
    getInsurancePolicies(vehicleId).then(unwrap),
    getInspections(vehicleId).then(unwrap),
    getTollSubscriptions(vehicleId).then(unwrap),
    getOdometerReadings(vehicleId).then(unwrap),
    getVehicleDocuments(vehicleId).then(unwrap),
  ]);
  return { vehicle, policies, inspections, tolls, readings, documents };
}

// ---- assignments
export async function loadVehicleAssignments(vehicleId) {
  return unwrap(await getVehicleAssignments(vehicleId));
}

// ---- vehicles
export async function createVehicle(payload, userId) {
  return unwrap(await insertVehicle({ ...payload, created_by: userId }));
}

export async function saveVehicle(vehicleId, payload) {
  return unwrap(await updateVehicle(vehicleId, payload));
}

export async function removeVehicle(vehicleId, documents) {
  const paths = (documents || []).map((document) => document.file_path);
  unwrap(await deleteVehicle(vehicleId));
  // Rows are gone; a failed storage cleanup only leaves orphaned files.
  if (paths.length) await removeFiles(VEHICLE_BUCKET, paths);
}

/**
 * Imports parsed registry rows. Vehicles that already exist (same plate
 * digits) are skipped, never overwritten; returns the counts for the toast.
 */
export async function importVehicles(parsedVehicles, existingVehicles, userId) {
  const digits = (plate) => String(plate).replace(/\D/g, '');
  const known = new Set(existingVehicles.map((vehicle) => digits(vehicle.plate_number)));
  const fresh = parsedVehicles.filter((vehicle) => !known.has(digits(vehicle.plate_number)));
  if (!fresh.length) return { created: 0, skipped: parsedVehicles.length };

  const rows = fresh.map(({ tolls: _tolls, ...vehicle }) => ({ ...vehicle, created_by: userId }));
  const created = unwrap(await insertVehicles(rows));
  const idByPlate = new Map(created.map((row) => [digits(row.plate_number), row.id]));

  const tollRows = fresh.flatMap((vehicle) =>
    vehicle.tolls.map((toll) => ({
      ...toll,
      vehicle_id: idByPlate.get(digits(vehicle.plate_number)),
      created_by: userId,
    })),
  );
  if (tollRows.length) unwrap(await upsertTollSubscriptions(tollRows));
  return { created: created.length, skipped: parsedVehicles.length - fresh.length };
}

// ---- insurance / inspections / tolls / odometer
export async function addInsurancePolicy(vehicleId, payload, userId) {
  const [policy] = unwrap(await insertInsurancePolicies([{ ...payload, vehicle_id: vehicleId, created_by: userId }]));
  return policy;
}

export async function saveInsurancePolicy(policyId, payload) {
  return unwrap(await updateInsurancePolicy(policyId, payload));
}

export async function removeInsurancePolicy(policyId) {
  unwrap(await deleteInsurancePolicy(policyId));
}

export async function addInspection(vehicleId, payload, userId) {
  return unwrap(await insertInspection({ ...payload, vehicle_id: vehicleId, created_by: userId }));
}

export async function saveInspection(inspectionId, payload) {
  return unwrap(await updateInspection(inspectionId, payload));
}

export async function removeInspection(inspectionId) {
  unwrap(await deleteInspection(inspectionId));
}

export async function saveTollSubscription(vehicleId, payload, userId) {
  const [row] = unwrap(await upsertTollSubscriptions([{ ...payload, vehicle_id: vehicleId, created_by: userId }]));
  return row;
}

export async function removeTollSubscription(subscriptionId) {
  unwrap(await deleteTollSubscription(subscriptionId));
}

export async function saveOdometerReading(vehicleId, payload, userId) {
  return unwrap(await upsertOdometerReading({ ...payload, vehicle_id: vehicleId, entered_by: userId }));
}

export async function removeOdometerReading(readingId) {
  unwrap(await deleteOdometerReading(readingId));
}

// ---- AI document analysis (fine / policy / inspection scans)
/** Uploads a scan to a holding folder so the Edge Function can read it; the file is kept as the document when saved. */
export async function uploadScan(file) {
  const problem = validateDocumentFile(file);
  if (problem) throw new Error(problem);
  const path = `vehicles/_scans/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error } = await uploadFile(VEHICLE_BUCKET, path, file, { contentType: file.type });
  if (error) throw error;
  return { path, name: file.name, mime: file.type, size: file.size };
}

export async function discardScan(scan) {
  if (scan?.path) await removeFiles(VEHICLE_BUCKET, [scan.path]);
}

/** kind: 'fine' | 'policy' | 'inspection'. Resolves { ok, fields, uncertain } or { ok: false, error }. */
export async function analyzeScan(scan, kind) {
  const { data, error } = await analyzeVehicleDocument({ path: scan.path, kind });
  if (error) return { ok: false, error: 'ai_failed' };
  return data;
}

// ---- fines
const plateDigits = (plate) => String(plate ?? '').replace(/\D/g, '');

export function findVehicleByPlate(vehicles, plate) {
  const digits = plateDigits(plate);
  return digits ? vehicles.find((vehicle) => plateDigits(vehicle.plate_number) === digits) || null : null;
}

export async function loadFleetVehicles() {
  return unwrap(await getVehicles());
}

export async function loadFines() {
  return unwrap(await getFines());
}

/** Holder of the vehicle at the offense time (assignment covering it, else the regular driver). */
export async function resolveFineHolder(vehicleId, offenseAt) {
  const rows = unwrap(await rpcFineHolderAt(vehicleId, new Date(offenseAt).toISOString()));
  return rows?.[0] || { driver_id: null, driver_name: '' };
}

export async function createFine(payload, scan, userId) {
  let documentId = null;
  if (scan) {
    const document = unwrap(await insertVehicleDocument({
      vehicle_id: payload.vehicle_id, doc_type: 'fine', file_path: scan.path, original_name: scan.name,
      mime_type: scan.mime, size_bytes: scan.size, uploaded_by: userId,
    }));
    documentId = document.id;
  }
  return unwrap(await insertFine({
    ...payload,
    document_id: documentId,
    created_by: userId,
    amount_history: [{ amount: payload.amount_ils, at: new Date().toISOString() }],
  }));
}

export async function saveFine(fineId, payload) {
  return unwrap(await updateFine(fineId, payload));
}

/** A newer amount from the authority (e.g. after a late-payment increase). History is kept. */
export async function updateFineAmount(fine, amount) {
  const history = [...(fine.amount_history || []), { amount, at: new Date().toISOString() }];
  return unwrap(await updateFine(fine.id, { amount_ils: amount, amount_history: history }));
}

export async function forwardFine(fine) {
  return unwrap(await updateFine(fine.id, { status: 'forwarded' }));
}

export async function setFineStatus(fineId, status) {
  const extra = status === 'paid' ? { paid_at: new Date().toISOString() } : {};
  return unwrap(await updateFine(fineId, { status, ...extra }));
}

export async function removeFine(fine) {
  unwrap(await deleteFine(fine.id));
}

// ---- documents (private bucket, signed links)
export function validateDocumentFile(file) {
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) return 'ניתן להעלות PDF, JPG או PNG בלבד.';
  if (file.size > MAX_DOCUMENT_BYTES) return 'הקובץ גדול מ-10MB.';
  return '';
}

export async function uploadVehicleDocument(vehicleId, file, { docType, validTo, notes }, userId) {
  const problem = validateDocumentFile(file);
  if (problem) throw new Error(problem);

  const path = `vehicles/${vehicleId}/${docType}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error } = await uploadFile(VEHICLE_BUCKET, path, file, { contentType: file.type });
  if (error) throw error;

  try {
    return unwrap(
      await insertVehicleDocument({
        vehicle_id: vehicleId,
        doc_type: docType,
        file_path: path,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        valid_to: validTo || null,
        notes: notes || '',
        uploaded_by: userId,
      }),
    );
  } catch (insertError) {
    await removeFiles(VEHICLE_BUCKET, [path]);
    throw insertError;
  }
}

/** Registers an already-uploaded scan (see uploadScan) as a document of the vehicle. */
export async function attachScanDocument(vehicleId, scan, docType, userId, validTo) {
  return unwrap(await insertVehicleDocument({
    vehicle_id: vehicleId, doc_type: docType, file_path: scan.path, original_name: scan.name,
    mime_type: scan.mime, size_bytes: scan.size, valid_to: validTo || null, uploaded_by: userId,
  }));
}

export async function removeVehicleDocument(document) {
  unwrap(await deleteVehicleDocument(document.id));
  await removeFiles(VEHICLE_BUCKET, [document.file_path]);
}

export async function getDocumentUrl(document) {
  const { data, error } = await createSignedUrl(VEHICLE_BUCKET, document.file_path, 300);
  if (error) throw error;
  return data.signedUrl;
}
