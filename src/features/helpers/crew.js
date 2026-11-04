export function helperCrew(names) {
  // Keep legacy session format: the existing crew RPC stores helper IDs as null.
  return names.map((name) => ({ id: null, name, source: 'helper' }));
}

export function crewEditOptions(workers, helpers, session) {
  const options = [
    ...workers.filter((worker) => worker.id !== session.worker_id)
      .map((worker) => ({ id: worker.id, name: worker.full_name, source: 'system' })),
    ...helperCrew(helpers.filter((helper) => helper.is_active).map((helper) => helper.name)),
  ];
  // Old names survive renames/deactivation and remain selected when editing notes.
  for (const member of session.crew_members || []) {
    if (!options.some((option) => sameCrewMember(option, member))) options.push(member);
  }
  return options;
}

export function sameCrewMember(left, right) {
  return left.source === right.source && (left.id ? left.id === right.id : left.name === right.name);
}
