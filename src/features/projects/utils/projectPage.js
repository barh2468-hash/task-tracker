// Deep links should reveal their target without mounting every older project
// before it. Keep the normal page size and move only the permitted target first.
export function getProjectPage(projects, limit, linkedProjectId) {
  const page = projects.slice(0, limit);
  if (!linkedProjectId || !page.length) return page;

  const linkedProject = projects.find((project) => project.id === linkedProjectId);
  if (!linkedProject) return page;

  return [linkedProject, ...page.filter((project) => project.id !== linkedProjectId)].slice(0, limit);
}
