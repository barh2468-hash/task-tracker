import { supabase } from '../supabase.js';

export function insertSickLeaveCertificate(payload) {
  return supabase.from('sick_leave_certificates').insert(payload).select().single();
}

export function updateSickLeaveCertificate(certificateId, payload) {
  return supabase
    .from('sick_leave_certificates')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', certificateId)
    .select()
    .single();
}

export function deleteSickLeaveCertificate(certificateId) {
  return supabase.from('sick_leave_certificates').delete().eq('id', certificateId);
}
