function normalizedName(profile) {
  return String(profile?.full_name || '')
    .trim()
    .toLocaleLowerCase();
}

export function isDrafterCandidate(profile) {
  if (!profile) return false;
  if (profile.role === 'drafter') return true;

  const nameParts = normalizedName(profile).split(/\s+/).filter(Boolean);
  return nameParts.some((part) => ['דודי', 'dudi', 'dudy'].includes(part));
}

export function findAssignedDrafter(project) {
  return (project?.project_workers || []).find((assignment) =>
    isDrafterCandidate(assignment.profiles),
  );
}
