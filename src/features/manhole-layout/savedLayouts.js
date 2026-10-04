export const LAYOUT_BUCKET = 'manhole-layouts';
export const MAX_LAYOUT_FILE_SIZE = 25 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateLayoutSource(source) {
  if (source?.version !== 1 || !source.draft || typeof source.draft !== 'object' || Array.isArray(source.draft)) throw new Error('נתוני הפרישה אינם תקינים.');
  const draft = source.draft;
  if (!UUID.test(draft.projectId || '') || typeof draft.num !== 'string' || !draft.num.trim() || draft.num.length > 80) throw new Error('יש לבחור פרויקט ולמלא מספר שוחה.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date || '') || !Number.isFinite(Date.parse(draft.date)) || new Date(draft.date).toISOString().slice(0, 10) !== draft.date) throw new Error('יש למלא תאריך ביצוע תקין.');
  if (!Array.isArray(draft.shaft) || !Array.isArray(draft.cover) || !Array.isArray(draft.groups)) throw new Error('נתוני הפרישה אינם תקינים.');
  if (draft.groups.length > 100 || draft.shaft.length > 10 || draft.cover.length > 10) throw new Error('נתוני הפרישה גדולים מדי.');
  for (const [key, value] of Object.entries(draft)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('נתוני הפרישה אינם תקינים.');
    if (!['groups', 'shaft', 'cover', 'walls'].includes(key) && (typeof value !== 'string' || value.length > 5000)) throw new Error('נתוני הפרישה אינם תקינים.');
  }
  if (draft.walls && (typeof draft.walls !== 'object' || Array.isArray(draft.walls) || Object.entries(draft.walls).some(([key, values]) =>
    ['__proto__', 'prototype', 'constructor'].includes(key) || !Array.isArray(values) || values.length > 30 || values.some(value => typeof value !== 'string' || value.length > 30)
  ))) throw new Error('נתוני הדפנות אינם תקינים.');
  for (const group of draft.groups) {
    if (!group || typeof group !== 'object' || Array.isArray(group) || !Array.isArray(group.cables) || group.cables.length > 192) throw new Error('נתוני הקנים אינם תקינים.');
    for (const [key, value] of Object.entries(group)) {
      if (!['wall', 'rows', 'cols', 'u', 'v', 'cables'].includes(key)) throw new Error('נתוני הקנים אינם תקינים.');
      if (key !== 'cables' && typeof value !== 'string') throw new Error('נתוני הקנים אינם תקינים.');
    }
    if (group.cables.some(value => value !== null && (typeof value !== 'string' || value.length > 40))) throw new Error('נתוני הקנים אינם תקינים.');
  }
  if (draft.shaft.some(value => typeof value !== 'string') || draft.cover.some(value => typeof value !== 'string')) throw new Error('נתוני הפרישה אינם תקינים.');
  if (!Array.isArray(source.photos) || source.photos.length > 30 || source.photos.some(photo =>
    !photo || typeof photo.src !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo.src) ||
    typeof photo.label !== 'string' || photo.label.length > 500 ||
    !Number.isFinite(photo.w) || !Number.isFinite(photo.h) || photo.w < 1 || photo.h < 1 || photo.w > 1600 || photo.h > 1600
  )) throw new Error('נתוני התמונות אינם תקינים.');
  return source;
}

export function prepareLayoutSave({ source, pdf, preview, fileName, userId, id, revisionOf = null }) {
  validateLayoutSource(source);
  if (!UUID.test(userId || '') || !UUID.test(id || '') || (revisionOf && !UUID.test(revisionOf))) throw new Error('יש להתחבר מחדש כדי לשמור.');
  if (!(pdf instanceof Blob) || pdf.type !== 'application/pdf' || pdf.size < 1 || pdf.size > MAX_LAYOUT_FILE_SIZE) throw new Error('קובץ ה־PDF גדול מדי. יש לצמצם תמונות ולנסות שוב.');
  if (typeof preview !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(preview)) throw new Error('התצוגה המקדימה אינה תקינה.');
  const sourceBlob = new Blob([JSON.stringify(source)], { type: 'application/json' });
  if (sourceBlob.size > MAX_LAYOUT_FILE_SIZE) throw new Error('נתוני הפרישה גדולים מדי. יש לצמצם תמונות ולנסות שוב.');
  const prefix = `${source.draft.projectId}/${userId}/${id}`;
  const safeName = Array.from(String(fileName || '')).filter(char => char.charCodeAt(0) >= 32 && char !== '/' && char !== '\\').join('').slice(0, 230);
  return {
    sourceBlob,
    row: {
      id, project_id: source.draft.projectId, created_by: userId,
      manhole_number: source.draft.num.trim(), infrastructure: (source.draft.infra || '').slice(0, 80),
      work_date: source.draft.date, file_name: safeName.endsWith('.pdf') ? safeName : `${safeName || 'פרישת שוחה'}.pdf`,
      pdf_path: `${prefix}/report.pdf`, source_path: `${prefix}/source.json`, preview_path: `${prefix}/preview.png`,
      pdf_size: pdf.size, revision_of: revisionOf,
    },
  };
}

export function filterSavedLayouts(rows, { projectId = '', workerId = '', search = '' } = {}) {
  const query = search.trim().toLocaleLowerCase();
  return rows.filter(row => (!projectId || row.project_id === projectId) && (!workerId || row.created_by === workerId) &&
    (!query || [row.project_name, row.manhole_number, row.infrastructure, row.created_by_name].join(' ').toLocaleLowerCase().includes(query)));
}
