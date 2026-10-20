import { emptyPlan, planStorageKey, PlanStorageError, readPlan, writePlan } from './localPlans.js';

// Import only into the local plan store. The uploaded workbook is not changed.
export function importWorkbookPlan(storage, scope, workbook) {
  const key = planStorageKey(scope, workbook.source.date);
  const current = readPlan(storage, key);
  if (current) {
    try { storage.setItem(`${key}:before-workbook-import`, JSON.stringify(current)); }
    catch { throw new PlanStorageError('storage'); }
  }
  const rows = structuredClone(workbook.rows);
  return writePlan(storage, key, {
    ...(current || emptyPlan()),
    rows,
    publishedRows: structuredClone(rows),
    publishedAt: new Date().toISOString(),
    sourceWorkbook: { ...workbook.source, importedAt: new Date().toISOString() },
  });
}
