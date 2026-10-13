import { isManagerRole } from '../../../utils/roles.js';
import { isDrafterCandidate } from './drafters.js';

export function isProjectTeamMember(profile) {
  return profile?.role === 'field_worker' || isManagerRole(profile?.role);
}

export function getProjectTeamAssignments(project) {
  return (project?.project_workers || []).filter(
    (assignment) => !assignment.profiles?.role || isProjectTeamMember(assignment.profiles),
  );
}

export function isProjectAssignedTo(project, userId) {
  return Boolean(userId) && (project.assigned_to === userId ||
    (project.project_workers || []).some((assignment) => assignment.worker_id === userId));
}

export function getProjectAssignmentChanges(project, selectedWorkerIds) {
  const assignments = project?.project_workers || [];
  const previousTeamIds = new Set(getProjectTeamAssignments(project).map((row) => row.worker_id));
  const selectedIds = [...new Set(selectedWorkerIds || [])];
  // Dedicated drafters are managed separately. Managers shown in the team
  // picker, including legacy drafter candidates, follow the checkbox selection.
  const preservedDrafterIds = assignments
    .filter((row) => isDrafterCandidate(row.profiles) && !isProjectTeamMember(row.profiles))
    .map((row) => row.worker_id);
  const nextIds = new Set([...selectedIds, ...preservedDrafterIds]);
  const previousIds = new Set(assignments.map((row) => row.worker_id));
  return {
    addedExtraWorkers: selectedIds.filter((id) => !previousTeamIds.has(id)),
    removedAssignmentIds: [...previousIds].filter((id) => !nextIds.has(id)),
    addedAssignmentIds: [...nextIds].filter((id) => !previousIds.has(id)),
  };
}
