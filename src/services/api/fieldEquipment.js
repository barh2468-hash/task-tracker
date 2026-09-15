import { supabase } from '../supabase.js';

export function getLatestFieldEquipmentImport() {
  return supabase
    .from('field_equipment_imports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

export function getFieldEquipmentRecords(importId) {
  return supabase
    .from('field_equipment_records')
    .select('*')
    .eq('import_id', importId)
    .order('source_row_number');
}

export function createFieldEquipmentImport(payload) {
  return supabase.from('field_equipment_imports').insert(payload).select('*').single();
}

export function insertFieldEquipmentRecords(records) {
  return supabase.from('field_equipment_records').insert(records);
}

export function createFieldEquipmentRecord(record) {
  return supabase.from('field_equipment_records').insert(record).select('*').single();
}

export function updateFieldEquipmentRecord(recordId, payload) {
  return supabase
    .from('field_equipment_records')
    .update(payload)
    .eq('id', recordId)
    .select('*')
    .single();
}

export function updateFieldEquipmentImport(importId, payload) {
  return supabase
    .from('field_equipment_imports')
    .update(payload)
    .eq('id', importId)
    .select('*')
    .single();
}

export function deleteFieldEquipmentImport(importId) {
  return supabase.from('field_equipment_imports').delete().eq('id', importId);
}
