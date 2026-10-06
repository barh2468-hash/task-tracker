import { buildProjectExceptions, daysBetween } from './exceptions.js';

function withIssueAge(issue) {
  if (Number.isFinite(issue.descriptionValues?.days)) {
    return { ...issue, ageValue: issue.descriptionValues.days, ageUnit: 'days' };
  }
  if (Number.isFinite(issue.descriptionValues?.hours)) {
    return { ...issue, ageValue: issue.descriptionValues.hours, ageUnit: 'hours' };
  }
  // Assignment dates are not tracked; use a clearly labelled project creation date instead.
  if (issue.type === 'unassigned' && Number.isFinite(Date.parse(issue.project.created_at))) {
    return { ...issue, ageValue: daysBetween(issue.project.created_at), ageUnit: 'created' };
  }
  return issue;
}

function issueAgeDays(issue) {
  if (issue.ageUnit === 'created') return 0;
  return issue.ageUnit === 'hours' ? issue.ageValue / 24 : issue.ageValue || 0;
}

export function buildOverviewAttention(projects) {
  const grouped = new Map();
  const exceptions = buildProjectExceptions(projects.filter((project) => !project.is_archived));
  for (const issue of exceptions) {
    const issues = grouped.get(issue.project.id) || [];
    issues.push(withIssueAge(issue));
    grouped.set(issue.project.id, issues);
  }
  return [...grouped.values()]
    .map((issues) => {
      issues.sort(
        (left, right) =>
          issueAgeDays(right) - issueAgeDays(left) || left.type.localeCompare(right.type),
      );
      return { ...issues[0], issueCount: issues.length };
    })
    .sort(
      (left, right) =>
        new Date(left.project.updated_at || 0) - new Date(right.project.updated_at || 0) ||
        String(left.project.id).localeCompare(String(right.project.id)),
    );
}

export function getOverviewActivity(historyItems, projects, statuses) {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const allowedStatuses = new Set(statuses);
  return historyItems
    .filter(
      (item) =>
        projectById.has(item.project_id) &&
        allowedStatuses.has(item.new_status) &&
        item.old_status !== item.new_status &&
        Number.isFinite(Date.parse(item.created_at)),
    )
    .map((item) => ({ ...item, project: projectById.get(item.project_id) }))
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
    .slice(0, 4);
}
