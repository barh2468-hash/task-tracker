export const planColumns = ['leader', 'helpers', 'work', 'start', 'client', 'contact', 'notes', 'vehicle'];

export function createPlanRow(values = {}) {
  return { id: crypto.randomUUID(), ...Object.fromEntries(planColumns.map((key) => [key, ''])), projectId: '', ...values };
}

export function emptyPlan(rows = []) {
  return { version: 1, revision: 0, rows, publishedRows: null, publishedAt: null, savedAt: null };
}

export function planStorageKey(scope, date) {
  return `maya:daily-work-plan:v1:${encodeURIComponent(scope)}:${date}`;
}

function isRow(row) {
  return row && typeof row.id === 'string' && typeof row.projectId === 'string' &&
    planColumns.every((column) => typeof row[column] === 'string');
}

function isPlan(value) {
  return value?.version === 1 && Number.isInteger(value.revision) && value.revision >= 0 &&
    Array.isArray(value.rows) && value.rows.every(isRow) &&
    (value.publishedRows === null || (Array.isArray(value.publishedRows) && value.publishedRows.every(isRow))) &&
    (value.savedAt === null || (typeof value.savedAt === 'string' && Number.isFinite(Date.parse(value.savedAt)))) &&
    (value.publishedAt === null || (typeof value.publishedAt === 'string' && Number.isFinite(Date.parse(value.publishedAt))));
}

export class PlanStorageError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function readPlan(storage, key) {
  let raw;
  try { raw = storage.getItem(key); } catch { throw new PlanStorageError('storage'); }
  if (raw === null) return null;
  let value;
  try { value = JSON.parse(raw); } catch { throw new PlanStorageError('invalid'); }
  if (!isPlan(value)) throw new PlanStorageError('invalid');
  return value;
}

export function writePlan(storage, key, plan) {
  const current = readPlan(storage, key);
  if ((current?.revision ?? 0) !== plan.revision) throw new PlanStorageError('conflict');
  const next = { ...plan, revision: plan.revision + 1, savedAt: new Date().toISOString() };
  if (!isPlan(next)) throw new PlanStorageError('invalid');
  try { storage.setItem(key, JSON.stringify(next)); } catch { throw new PlanStorageError('storage'); }
  return next;
}

export function shiftPlanDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function todayPlanDate() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Hebron', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function applyProject(row, project) {
  if (!project) return { ...row, projectId: '' };
  return {
    ...row, projectId: project.id,
    work: [project.name, project.location].filter(Boolean).join('\n'),
    client: project.client_name || '',
    contact: [project.contact_name, project.contact_phone, project.contact_email].filter(Boolean).join('\n'),
  };
}

export function copyPlanRows(rows) {
  return rows.map((row) => ({ ...row, id: crypto.randomUUID() }));
}
