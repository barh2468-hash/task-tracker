import { supabase } from '../supabase.js';

const touch = (payload) => ({ ...payload, updated_at: new Date().toISOString() });

// ---- vehicles
export function getVehicles() {
  return supabase.from('vehicles').select('*').order('plate_number');
}

export function getVehicle(vehicleId) {
  return supabase.from('vehicles').select('*').eq('id', vehicleId).maybeSingle();
}

export function insertVehicle(payload) {
  return supabase.from('vehicles').insert(payload).select('*').single();
}

export function insertVehicles(payloads) {
  return supabase.from('vehicles').insert(payloads).select('id, plate_number');
}

export function updateVehicle(vehicleId, payload) {
  return supabase.from('vehicles').update(touch(payload)).eq('id', vehicleId).select('*').single();
}

export function deleteVehicle(vehicleId) {
  return supabase.from('vehicles').delete().eq('id', vehicleId);
}

// ---- driver lookup (security-definer function; see fleet_driver_lookup migration)
export function getDriverCandidates() {
  return supabase.rpc('fleet_driver_candidates');
}

// ---- assignments
export function getVehicleAssignments(vehicleId) {
  return supabase
    .from('vehicle_assignments')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('started_at', { ascending: false });
}

// ---- insurance quotes
export function getVehicleQuotes(vehicleId) {
  return supabase.from('vehicle_insurance_quotes').select('*').eq('vehicle_id', vehicleId).order('created_at', { ascending: false });
}

export function getPendingQuotes() {
  return supabase.from('vehicle_insurance_quotes').select('id, vehicle_id, created_at').eq('status', 'pending');
}

export function insertQuote(payload) {
  return supabase.from('vehicle_insurance_quotes').insert(payload).select('*').single();
}

/** Decides only a still-pending quote, so the first decision wins. Resolves null data if someone was faster. */
export function decidePendingQuote(quoteId, payload) {
  return supabase.from('vehicle_insurance_quotes').update(payload).eq('id', quoteId).eq('status', 'pending').select('*').maybeSingle();
}

export function deleteQuote(quoteId) {
  return supabase.from('vehicle_insurance_quotes').delete().eq('id', quoteId);
}

export function getAllAssignments() {
  return supabase.from('vehicle_assignments').select('*').order('started_at', { ascending: false });
}

// ---- fines
const FINE_SELECT =
  '*, vehicle:vehicles!vehicle_id(plate_number, make_model), document:vehicle_documents!document_id(file_path)';

export function getFines() {
  return supabase.from('vehicle_fines').select(FINE_SELECT).order('created_at', { ascending: false }).limit(500);
}

export function getVehicleFines(vehicleId) {
  return supabase.from('vehicle_fines').select(FINE_SELECT).eq('vehicle_id', vehicleId).order('offense_at', { ascending: false });
}

export function insertFine(payload) {
  return supabase.from('vehicle_fines').insert(payload).select(FINE_SELECT).single();
}

export function updateFine(fineId, payload) {
  return supabase.from('vehicle_fines').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', fineId).select(FINE_SELECT).single();
}

export function deleteFine(fineId) {
  return supabase.from('vehicle_fines').delete().eq('id', fineId);
}

export function rpcFineHolderAt(vehicleId, at) {
  return supabase.rpc('fine_holder_at', { p_vehicle: vehicleId, p_at: at });
}

// ---- insurance policies
export function getAllInsurancePolicies() {
  return supabase.from('vehicle_insurance_policies').select('*').order('valid_to', { ascending: false });
}

export function getInsurancePolicies(vehicleId) {
  return supabase
    .from('vehicle_insurance_policies')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('valid_to', { ascending: false });
}

export function insertInsurancePolicies(payloads) {
  return supabase.from('vehicle_insurance_policies').insert(payloads).select('*');
}

export function updateInsurancePolicy(policyId, payload) {
  return supabase.from('vehicle_insurance_policies').update(payload).eq('id', policyId).select('*').single();
}

export function deleteInsurancePolicy(policyId) {
  return supabase.from('vehicle_insurance_policies').delete().eq('id', policyId);
}

// ---- inspections (טסט)
export function getAllInspections() {
  return supabase.from('vehicle_inspections').select('*').order('valid_to', { ascending: false });
}

export function getInspections(vehicleId) {
  return supabase
    .from('vehicle_inspections')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('valid_to', { ascending: false });
}

export function insertInspection(payload) {
  return supabase.from('vehicle_inspections').insert(payload).select('*').single();
}

export function updateInspection(inspectionId, payload) {
  return supabase.from('vehicle_inspections').update(payload).eq('id', inspectionId).select('*').single();
}

export function deleteInspection(inspectionId) {
  return supabase.from('vehicle_inspections').delete().eq('id', inspectionId);
}

// ---- toll subscriptions
export function getAllTollSubscriptions() {
  return supabase.from('vehicle_toll_subscriptions').select('*');
}

export function getTollSubscriptions(vehicleId) {
  return supabase.from('vehicle_toll_subscriptions').select('*').eq('vehicle_id', vehicleId);
}

export function upsertTollSubscriptions(payloads) {
  return supabase
    .from('vehicle_toll_subscriptions')
    .upsert(payloads, { onConflict: 'vehicle_id,kind' })
    .select('*');
}

export function deleteTollSubscription(subscriptionId) {
  return supabase.from('vehicle_toll_subscriptions').delete().eq('id', subscriptionId);
}

// ---- odometer readings
export function getAllOdometerReadings(fromMonth) {
  return supabase
    .from('vehicle_odometer_readings')
    .select('vehicle_id, reading_month, odometer_km')
    .gte('reading_month', fromMonth);
}

export function getOdometerReadings(vehicleId) {
  return supabase
    .from('vehicle_odometer_readings')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('reading_month', { ascending: false });
}

export function upsertOdometerReading(payload) {
  return supabase
    .from('vehicle_odometer_readings')
    .upsert(payload, { onConflict: 'vehicle_id,reading_month' })
    .select('*')
    .single();
}

export function deleteOdometerReading(readingId) {
  return supabase.from('vehicle_odometer_readings').delete().eq('id', readingId);
}

// ---- documents
export function getVehicleDocuments(vehicleId) {
  return supabase
    .from('vehicle_documents')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('uploaded_at', { ascending: false });
}

export function insertVehicleDocument(payload) {
  return supabase.from('vehicle_documents').insert(payload).select('*').single();
}

export function deleteVehicleDocument(documentId) {
  return supabase.from('vehicle_documents').delete().eq('id', documentId);
}
