import { supabase } from '../supabase.js';

export function getPaymentDevices() {
  return supabase.from('payment_devices').select('*').order('created_at', { ascending: true });
}
export function updatePaymentDevice(id, payload) {
  return supabase
    .from('payment_devices')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
}
export function insertPaymentDevice(payload) {
  return supabase.from('payment_devices').insert(payload).select().single();
}
export function insertPaymentDeviceUpdates(rows) {
  return supabase.from('payment_device_updates').insert(rows);
}
