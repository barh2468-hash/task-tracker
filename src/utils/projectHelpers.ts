import type { AppTab, Profile, Project } from "@/src/types";
import { reviewStatus } from "@/src/constants/statuses";
import { buildProjectExceptions } from "./exceptions";

export function getProjectFieldWorkerIds(project: Project) {
  return Array.from(
    new Set(
      [
        project.assigned_to,
        ...(project.project_workers || [])
          .filter((worker) => !worker.profiles?.role || worker.profiles.role === "field_worker")
          .map((worker) => worker.worker_id),
      ].filter(Boolean) as string[],
    ),
  );
}

export function filterVisibleProjects({
  projects,
  query,
  statusFilter,
  tab,
  profile,
  userId,
}: {
  projects: Project[];
  query: string;
  statusFilter: string;
  tab: AppTab;
  profile: Profile | null;
  userId?: string;
}) {
  return projects.filter((project) => {
    const text =
      `${project.name} ${project.location} ${project.contact_phone || ""} ${project.contact_email || ""} ${project.client_name || ""} ${project.description || ""}`.toLowerCase();
    const okQuery = !query || text.includes(query.toLowerCase());
    const okStatus = !statusFilter || project.status === statusFilter;
    const okArchive = tab === "archive" ? !!project.is_archived : !project.is_archived;
    const okTab =
      tab === "unassigned"
        ? !project.assigned_to
        : tab !== "mine" || profile?.role !== "manager" || project.assigned_to === userId;
    return okQuery && okStatus && okArchive && okTab;
  });
}

export function buildProjectStats(activeProjects: Project[], archivedCount: number) {
  return {
    total: activeProjects.length,
    field: activeProjects.filter((p) => p.status === "בעבודה בשטח").length,
    gpr: activeProjects.filter((p) => p.status === "נדרש GPR").length,
    drafting: activeProjects.filter((p) => p.status === "עבר לשרטוט").length,
    review: activeProjects.filter((p) => p.status === reviewStatus).length,
    done: activeProjects.filter((p) => p.status === "הושלם").length,
    unassigned: activeProjects.filter((p) => !p.assigned_to).length,
    archived: archivedCount,
    openTasks: activeProjects.reduce(
      (sum, p) => sum + (p.project_tasks || []).filter((t) => !t.is_done).length,
      0,
    ),
    activeWork: activeProjects.reduce(
      (sum, p) => sum + (p.work_sessions || []).filter((w) => !w.ended_at).length,
      0,
    ),
    exceptions: buildProjectExceptions(activeProjects).length,
  };
}
