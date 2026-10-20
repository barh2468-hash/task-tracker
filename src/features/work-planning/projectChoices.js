import { isProjectAssignedTo } from '../projects/utils/assignments.js';

function normalizedName(value) {
  return (value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function resolvePlanWorker(name, workers) {
  const normalized = normalizedName(name);
  if (!normalized) return { worker: null, status: 'missing' };
  // Workbook-only names have no system ID and must never manufacture assignments.
  const registered = [...new Map(workers.filter((worker) => worker.id && normalizedName(worker.full_name))
    .map((worker) => [worker.id, worker])).values()];
  const exact = registered.filter((worker) => normalizedName(worker.full_name) === normalized);
  if (exact.length === 1) return { worker: exact[0], status: 'matched' };
  if (exact.length > 1) return { worker: null, status: 'ambiguous' };
  // Preserve the original first names in the workbook; resolve only unique matches.
  const firstNameMatches = normalized.includes(' ') ? [] : registered.filter(
    (worker) => normalizedName(worker.full_name).split(' ')[0] === normalized,
  );
  if (firstNameMatches.length === 1) return { worker: firstNameMatches[0], status: 'matched' };
  return { worker: null, status: firstNameMatches.length > 1 ? 'ambiguous' : 'unknown' };
}

export function getPlanProjectChoices(name, workers, projects) {
  const result = resolvePlanWorker(name, workers);
  const unique = [...new Map(projects.map((project) => [project.id, project])).values()];
  return {
    ...result,
    projects: result.worker ? unique.filter((project) => !project.is_archived && isProjectAssignedTo(project, result.worker.id)) : [],
  };
}
