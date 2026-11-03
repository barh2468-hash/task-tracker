export const emptyProjectSnapshot = {
  owner: null, projects: [], loading: true, settled: false, verified: false, error: false,
};

export function projectOwner(profile) {
  return profile?.id ? `${profile.id}:${profile.role}` : null;
}

// One read per account at a time. Only a complete server response can establish
// that a linked project is unavailable; cached data and failures cannot.
export function createProjectLoader({ read, readCache, writeCache, publish }) {
  let snapshot = emptyProjectSnapshot;
  let generation = 0;
  let pending = null;
  function update(changes) {
    snapshot = { ...snapshot, ...changes };
    publish(snapshot);
  }
  function activate(profile) {
    const owner = projectOwner(profile);
    if (owner === snapshot.owner) return;
    generation += 1;
    pending = null;
    snapshot = { ...emptyProjectSnapshot, owner };
    publish(snapshot);
  }
  function cancel() {
    generation += 1;
    pending = null;
  }
  function load(profile) {
    activate(profile);
    if (!profile?.id) return Promise.resolve();
    if (pending) return pending;
    const requestGeneration = generation;
    const current = () => generation === requestGeneration;
    const cacheKey = `projects:${profile.id}`;
    update({ loading: true, verified: false });
    pending = Promise.resolve().then(async () => {
      try {
        const projects = await read(profile);
        if (!current()) return;
        update({ projects, settled: true, verified: true, loading: false, error: false });
        // Device storage is optional. A cache failure must never undo a valid
        // network response or replace it with an older snapshot.
        void Promise.resolve().then(() => writeCache(cacheKey, projects)).catch(() => {});
      } catch {
        if (!current()) return;
        let projects = snapshot.projects;
        if (!snapshot.settled) {
          try { projects = (await readCache(cacheKey)) || []; } catch { /* Storage unavailable. */ }
        }
        if (current()) update({ projects, settled: true, verified: false, loading: false, error: true });
      } finally {
        if (current()) pending = null;
      }
    });
    return pending;
  }
  return {
    activate, cancel, load,
    setProjects: (value) => update({ projects: typeof value === 'function' ? value(snapshot.projects) : value }),
  };
}

export function resolveProjectLink(projectId, projects, verified) {
  if (!projectId) return 'none';
  if (projects.some((project) => project.id === projectId)) return 'available';
  return verified ? 'unavailable' : 'pending';
}
