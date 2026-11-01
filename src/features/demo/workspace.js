export function getDemoRoute(path) {
  const url = new URL(path, 'https://demo.invalid');
  return {
    view:
      url.pathname === '/app/overview'
        ? 'overview'
        : url.searchParams.get('view') === 'cases'
          ? 'cases'
          : 'projects',
    projectId: url.pathname === '/app/overview' ? null : url.searchParams.get('project'),
  };
}

export function selectDemoProjects(projects, { query = '', onlyCases = false } = {}) {
  const normalized = query.trim().toLocaleLowerCase();
  return projects.filter(
    (project) =>
      (!onlyCases || project.demo_case_studies?.length > 0) &&
      [project.title, project.summary, project.location].some((value) =>
        String(value || '')
          .toLocaleLowerCase()
          .includes(normalized),
      ),
  );
}

export function demoProjectPath(projectId, onlyCases = false) {
  return (
    '/app/projects?' +
    new URLSearchParams({
      ...(onlyCases ? { view: 'cases' } : {}),
      project: projectId,
    })
  );
}

export function getDemoStats(projects) {
  return {
    total: projects.length,
    caseStudies: projects.reduce(
      (count, project) => count + (project.demo_case_studies?.length || 0),
      0,
    ),
  };
}
