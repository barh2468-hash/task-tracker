import { LAYOUT_BUCKET, prepareLayoutSave } from './savedLayouts.js';

export async function persistLayout(client, payload) {
  const { row, sourceBlob } = prepareLayoutSave(payload);
  const previewBlob = await (await fetch(payload.preview)).blob();
  const uploads = [[row.pdf_path, payload.pdf], [row.source_path, sourceBlob], [row.preview_path, previewBlob]];
  let insertStarted = false;
  try {
    for (const [path, file] of uploads) {
      const { error } = await client.storage.from(LAYOUT_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
    }
    insertStarted = true;
    const { data, error } = await client.from('project_manhole_layouts').insert(row).select().single();
    if (error) throw error;
    return data;
  } catch (error) {
    const { data: committed } = await client.from('project_manhole_layouts').select('*').eq('id', row.id).maybeSingle();
    if (committed) return committed;
    // A lost insert response may race the commit. Never remove those files:
    // the subsequent record could otherwise reference deleted objects.
    const definiteFailure = /^(23\d{3}|42\d{3}|PGRST\d+)$/.test(error.code || '');
    if (!insertStarted || definiteFailure) {
      await client.storage.from(LAYOUT_BUCKET).remove(uploads.map(([path]) => path)).catch(() => {});
    }
    if (insertStarted && !definiteFailure) throw new Error('לא ניתן לאשר את השמירה. בדקו בלשונית פרישות שמורות לפני ניסיון נוסף.');
    throw new Error(error.code === '42501' ? 'אין הרשאה לשמור בפרויקט הזה. בדקו שהפרויקט עדיין משויך לכם ופעיל.' : 'שמירת הפרישה נכשלה. בדקו את החיבור ונסו שוב.');
  }
}
