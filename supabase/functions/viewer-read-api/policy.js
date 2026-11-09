import { COLUMN_NAMES } from './columns.js';
export const VIEWER_EMAIL = 'johnny-maya@clients.maya.invalid';
// Business records only. OAuth credentials, push keys and delivery queues are excluded.
export const TABLES = new Set([
  'profiles','projects','project_workers','project_tasks','project_task_reports',
  'project_documents','project_photos','project_review_files','project_drawing_batches',
  'project_drawing_batch_events','project_manhole_layouts','status_history',
  'work_diaries','work_sessions','attendance_sessions','sick_leave_certificates',
  'crew_helpers','chat_conversations','chat_members','chat_messages',
  'notifications','personal_notes','field_equipment_records','field_equipment_imports',
  'payment_devices','payment_device_updates','demo_project_showcases','demo_case_studies',
  'demo_case_study_media','demo_project_access',
]);
const SAFE_RELATIONS = new Set([...TABLES,
  'assigned_to','worker_id','created_by','changed_by','uploaded_by','assigned_drafter',
  'recipient_id','sender_id','owner_id','user_id','driver_id','reported_by','entered_by',
  'requested_by','decided_by','approved_by','project_id','drawing_batch_id','task_id',
  'latest_report_id','work_session_id',
]);
const BUCKETS = new Set(['project-photos','project-documents','project-review-files',
  'manhole-layouts','sick-leave-certificates','demo-case-studies']);
const identifier = /^[a-z_][a-z0-9_]*$/i;

// Parse the small PostgREST projection grammar used by the app. Unknown embeds,
// quoted names, computed columns and arbitrary RPCs are never forwarded.
export function validProjection(select = '*') {
  let position = 0;
  function list(nested = false) {
    let count = 0;
    while (position < select.length) {
      while (/\s/.test(select[position] || '') && position < select.length) position++;
      const start = position;
      while (position < select.length && !'(),'.includes(select[position])) position++;
      const token = select.slice(start,position).trim();
      const parts = token.split(':');
      if (parts.length > 2 || (parts.length === 2 && !identifier.test(parts[0]))) return false;
      const name = parts.at(-1);
      if (select[position] === '(') {
        const [relation,...hints] = name.split('!');
        if (!SAFE_RELATIONS.has(relation) || hints.some(hint=>!identifier.test(hint))) return false;
        position++;
        if (!list(true)) return false;
      } else if (name !== '*' && (!identifier.test(name) || !COLUMN_NAMES.has(name))) return false;
      count++;
      while (/\s/.test(select[position] || '') && position < select.length) position++;
      if (select[position] === ',') {position++; continue;}
      if (nested && select[position] === ')') {position++; return count > 0;}
      return !nested && position === select.length && count > 0;
    }
    return !nested && count > 0;
  }
  return typeof select === 'string' && select.length <= 12000 && list() && position === select.length;
}

export function viewerAuthorized(user, profile) {
  return user?.email?.toLowerCase() === VIEWER_EMAIL &&
    user?.app_metadata?.maya_view_all === true && profile?.role === 'demo';
}

export function readRequest(payload) {
  if (!payload || typeof payload.path !== 'string' || payload.path.length > 50000 ||
      !payload.path.startsWith('/') || payload.path.startsWith('//') || /[#\\\r\n]/.test(payload.path))
    throw new Error('viewer.readOnly');
  const url = new URL(payload.path,'https://viewer.invalid');
  if (url.origin !== 'https://viewer.invalid') throw new Error('viewer.readOnly');
  const method = String(payload.method || 'GET').toUpperCase();
  const match = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
  if (match && TABLES.has(match[1]) && ['GET','HEAD'].includes(method)) {
    if (url.searchParams.getAll('select').length > 1) throw new Error('viewer.readOnly');
    if (!validProjection(url.searchParams.get('select') || '*')) throw new Error('viewer.readOnly');
    if (url.searchParams.has('limit')) url.searchParams.set('limit', String(Math.min(1000,Math.max(1,Number(url.searchParams.get('limit')) || 1000))));
    return {path:url.pathname+url.search, method, body:undefined};
  }
  const storage = url.pathname.match(/^\/storage\/v1\/object\/sign\/([a-z-]+)(?:\/(.+))?$/);
  if (storage && BUCKETS.has(storage[1]) && method === 'POST') {
    let body;
    try {body = typeof payload.body === 'string' ? JSON.parse(payload.body) : payload.body;} catch {throw new Error('viewer.readOnly');}
    if (!body || !Number.isFinite(body.expiresIn) || body.expiresIn < 1) throw new Error('viewer.readOnly');
    const paths = storage[2] ? [decodeURIComponent(storage[2])] : body.paths;
    if (!Array.isArray(paths) || !paths.length || paths.length > 100 || paths.some(path =>
      typeof path !== 'string' || !path || path.startsWith('/') || path.split('/').includes('..') || /[\x00\\]/.test(path)))
      throw new Error('viewer.readOnly');
    return {path:url.pathname,method:'POST',body:JSON.stringify({expiresIn:Math.min(body.expiresIn,3600),...(storage[2] ? {} : {paths})})};
  }
  throw new Error('viewer.readOnly');
}
