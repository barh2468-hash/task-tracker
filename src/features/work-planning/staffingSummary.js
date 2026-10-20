import { resolvePlanWorker } from './projectChoices.js';

const normalized = (name) => (name || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

export function planWorkerNames(rows) {
  return rows.flatMap((row) => [row.leader, row.helpers])
    .flatMap((value) => (value || '').split(/[,;\n]+/))
    .map((name) => name.trim()).filter(Boolean);
}

export function getStaffingSummary(rows, rosterNames, workers = []) {
  const identify = (name) => {
    const result = resolvePlanWorker(name, workers);
    return { key: result.worker ? `worker:${result.worker.id}` : `name:${normalized(name)}`,
      name, status: result.status };
  };
  const unique = (names, identifyName = identify) => [...new Map(names.filter((name) => normalized(name))
    .map((name) => { const entry = identifyName(name); return [entry.key, entry]; })).values()];
  const planned = unique(planWorkerNames(rows));
  const plannedKeys = new Set(planned.map((entry) => entry.key));
  const explicitRosterKeys = new Set(unique(rosterNames).filter((entry) => entry.status === 'matched').map((entry) => entry.key));
  const roster = unique(rosterNames, (name) => {
    const entry = identify(name);
    // A full name selected in the plan can clarify a short name in the source.
    // Never infer this when the short name remains, two candidates are present,
    // or that employee already has a separate entry in the reference roster.
    if (entry.status !== 'ambiguous' || plannedKeys.has(entry.key)) return entry;
    const candidates = [...new Map(workers.filter((worker) => worker.id
      && normalized(worker.full_name).split(' ')[0] === normalized(name)
      && plannedKeys.has(`worker:${worker.id}`))
      .map((worker) => [worker.id, worker])).values()];
    return candidates.length === 1 && !explicitRosterKeys.has(`worker:${candidates[0].id}`)
      ? { ...entry, key: `worker:${candidates[0].id}`, status: 'matched' } : entry;
  });
  const rosterKeys = new Set(roster.map((entry) => entry.key));
  const missing = roster.filter((entry) => !plannedKeys.has(entry.key));
  const additional = planned.filter((entry) => !rosterKeys.has(entry.key));
  // An ambiguous first name must never silently stand in for two different people.
  const review = [...new Map([...roster, ...planned].filter((entry) => entry.status === 'ambiguous')
    .map((entry) => [entry.key, entry])).values()];
  return { uniqueCount: planned.length, total: roster.length, assigned: roster.length - missing.length,
    missing, additional, review, complete: roster.length > 0 && missing.length === 0 && review.length === 0 };
}
