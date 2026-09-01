// ProjectsPage derives the correct filter (mine/all/archive) itself from
// project.is_archived whenever a ?project=<id> deep link is present, so
// callers just need to point at the project id.
export function projectDeepLinkPath(project) {
  return `/app/projects?project=${project.id}`;
}
