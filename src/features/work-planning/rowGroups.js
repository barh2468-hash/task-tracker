import { resolvePlanWorker } from './projectChoices.js';

const normalized = (value) => (value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

// Merge display cells only. Each task keeps its own ID, fields and project.
export function getWorkerCellGroups(rows, workers = []) {
  const cells = rows.map(() => ({}));
  const identity = (name) => {
    if (!normalized(name)) return null;
    const { worker } = resolvePlanWorker(name, workers);
    return worker ? `worker:${worker.id}` : `name:${normalized(name)}`;
  };
  for (let start = 0; start < rows.length;) {
    const name = identity(rows[start].leader);
    const solo = Boolean(name && !normalized(rows[start].helpers));
    let end = start + 1;
    // A solo task occupies both worker columns, like a horizontal Excel merge.
    // Split at crew changes so a later solo task can also span both columns.
    while (name && end < rows.length && identity(rows[end].leader) === name
      && (!normalized(rows[end].helpers)) === solo) end += 1;
    const leader = { start, span: end - start, solo, rowIds: rows.slice(start, end).map((row) => row.id) };
    for (let index = start; index < end; index += 1) cells[index].leader = leader;
    for (let helperStart = start; helperStart < end;) {
      let helperEnd = helperStart + 1;
      while (helperEnd < end && normalized(rows[helperEnd].helpers) === normalized(rows[helperStart].helpers)) helperEnd += 1;
      const helpers = { start: helperStart, span: helperEnd - helperStart, solo, rowIds: rows.slice(helperStart, helperEnd).map((row) => row.id) };
      for (let index = helperStart; index < helperEnd; index += 1) cells[index].helpers = helpers;
      helperStart = helperEnd;
    }
    start = end;
  }
  return cells;
}

export function updateWorkerGroup(rows, ids, column, value) {
  const selected = new Set(ids);
  return rows.map((row) => selected.has(row.id) ? { ...row, [column]: value } : row);
}
