import { supabase } from '../supabase.js';
import { LAYOUT_BUCKET, validateLayoutSource } from '../../features/manhole-layout/savedLayouts.js';
import { persistLayout } from '../../features/manhole-layout/persistLayout.js';

export async function listLayouts() {
  const { data, error } = await supabase.from('project_manhole_layouts').select('*').is('deleted_at', null).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export const saveLayout = payload => persistLayout(supabase, payload);

export async function deleteLayout(row) {
  const { data, error } = await supabase.rpc('delete_manhole_layout', { layout_id: row.id });
  if (error || data !== row.id) throw new Error('לא ניתן למחוק את הפרישה. בדקו את ההרשאות והחיבור ונסו שוב.');
}

export async function loadLayoutSource(row) {
  const { data, error } = await supabase.storage.from(LAYOUT_BUCKET).download(row.source_path);
  if (error) throw error;
  const source = validateLayoutSource(JSON.parse(await data.text()));
  if (source.draft.projectId !== row.project_id) throw new Error('הפרישה אינה תואמת לפרויקט.');
  return source;
}

export async function layoutUrl(row, kind = 'pdf', download = false) {
  const path = kind === 'preview' ? row.preview_path : row.pdf_path;
  const { data, error } = await supabase.storage.from(LAYOUT_BUCKET).createSignedUrl(path, 600, download ? { download: row.file_name } : {});
  if (error) throw error;
  return data.signedUrl;
}

export async function emailLayouts(payload) {
  const { data, error } = await supabase.functions.invoke('send-manhole-layouts', { body: payload });
  if (error) {
    let message = '';
    try { message = (await error.context?.json())?.error || ''; } catch { /* Network errors have no response body. */ }
    throw new Error(message || 'לא ניתן לאשר שהמייל נשלח. לחצו שוב כדי לבדוק את מצב השליחה.');
  }
  if (!data?.ok) throw new Error(data?.error || 'שליחת המייל נכשלה.');
  return data;
}
