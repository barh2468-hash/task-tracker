import { supabase } from '../supabase.js';

// Worker-facing vehicle functions. Workers have no direct access to the fleet tables;
// these security-definer RPCs check auth.uid() and return only non-sensitive columns.

export function rpcMyVehicles() {
  return supabase.rpc('worker_my_vehicles');
}

export function rpcAvailableVehicles() {
  return supabase.rpc('worker_available_vehicles');
}

export function rpcMyForms() {
  return supabase.rpc('worker_my_forms');
}

export function rpcMyFuelReports() {
  return supabase.rpc('worker_my_fuel_reports');
}

export function rpcReportOdometer(vehicleId, km) {
  return supabase.rpc('worker_report_odometer', { p_vehicle_id: vehicleId, p_km: km });
}

export function rpcReportFuel({ vehicleId, month, liters, amount }) {
  return supabase.rpc('worker_report_fuel', {
    p_vehicle_id: vehicleId,
    p_month: month,
    p_liters: liters,
    p_amount: amount ?? null,
  });
}

export function rpcDeclareVehicle(payload) {
  return supabase.rpc('worker_declare_vehicle', {
    p_action: payload.action,
    p_vehicle_id: payload.vehicleId,
    p_returned_vehicle_id: payload.returnedVehicleId ?? null,
    p_use: payload.use,
    p_is_regular: payload.isRegular,
    p_odometer: payload.odometer ?? null,
    p_returned_odometer: payload.returnedOdometer ?? null,
    p_place: payload.place || '',
    p_happened_at: payload.happenedAt || null,
    p_checklist: payload.checklist || {},
    p_signature: payload.signature || null,
    p_liability_ack: payload.liabilityAck,
  });
}

// ---- manager side: forms and fuel reports of a vehicle
export function getVehicleForms(vehicleId) {
  return supabase
    .from('vehicle_declaration_forms')
    .select('id, user_id, user_name, action, vehicle_use, is_regular_driver, happened_at, place, odometer, returned_odometer, checklist, liability_ack_at, status, approved_at, created_at')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });
}

export function getFormSignature(formId) {
  return supabase.from('vehicle_declaration_forms').select('signature_data').eq('id', formId).maybeSingle();
}

export function approveForm(formId, userId) {
  return supabase
    .from('vehicle_declaration_forms')
    .update({ status: 'approved', approved_by: userId, approved_at: new Date().toISOString() })
    .eq('id', formId)
    .select('id')
    .single();
}

export function getVehicleFuelReports(vehicleId) {
  return supabase
    .from('vehicle_fuel_reports')
    .select('id, reported_by, report_month, liters, amount_ils, updated_at, reporter:profiles!vehicle_fuel_reports_reported_by_fkey(full_name)')
    .eq('vehicle_id', vehicleId)
    .order('report_month', { ascending: false });
}
