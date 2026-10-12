// Suggests which system user a vehicle's free-text driver name refers to.
// Names come from a hand-kept table ("משה סירי", "חיים חדידה / משאית חדשה",
// "משרד\עידן שטיינברג"), so matching is by name tokens, order-insensitive,
// and only strong matches are pre-selected — everything else is a suggestion
// the secretary confirms.

const PRESELECT_SCORE = 0.85;
const MIN_SUGGESTION_SCORE = 0.4;

function tokens(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/["'׳״`.,()\-–]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Free-text cells often hold "name / note" or "משרד\name": try every segment. */
function segments(driverName) {
  return String(driverName ?? '')
    .split(/[\\/]/)
    .map(tokens)
    .filter((parts) => parts.length > 0 && !(parts.length === 1 && parts[0] === 'משרד'));
}

function scoreTokens(driverTokens, candidateTokens) {
  const candidate = new Set(candidateTokens);
  const shared = driverTokens.filter((token) => candidate.has(token)).length;
  if (shared === 0) return 0;
  const driver = new Set(driverTokens);
  if (shared === driver.size && shared === candidate.size) return 1;
  if (shared === Math.min(driver.size, candidate.size) && shared >= 2) return 0.9;
  if (shared >= 2) return 0.6;
  // One shared token (usually just a first or last name) — a weak hint only.
  return driverTokens.length === 1 || candidateTokens.length === 1 ? 0.45 : 0.4;
}

export function scoreName(driverName, candidateName) {
  const candidateTokens = tokens(candidateName);
  return segments(driverName).reduce(
    (best, parts) => Math.max(best, scoreTokens(parts, candidateTokens)),
    0,
  );
}

/**
 * For every vehicle with a named driver and no linked user, returns
 * { vehicle, suggestions: [{ candidate, score }], preselected: candidate|null }.
 */
export function buildDriverMatches(vehicles, candidates) {
  return vehicles
    .filter((vehicle) => vehicle.holder_type !== 'company' && vehicle.driver_name && !vehicle.driver_id)
    .map((vehicle) => {
      const suggestions = candidates
        .map((candidate) => ({ candidate, score: scoreName(vehicle.driver_name, candidate.full_name) }))
        .filter(({ score }) => score >= MIN_SUGGESTION_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
      const [top, second] = suggestions;
      const confident = top && top.score >= PRESELECT_SCORE && (!second || top.score - second.score >= 0.1);
      return { vehicle, suggestions, preselected: confident ? top.candidate : null };
    });
}
