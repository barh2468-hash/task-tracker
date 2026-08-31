export type AppTab =
  | "mine"
  | "all"
  | "assignments"
  | "today"
  | "liveMap"
  | "projectStatus"
  | "tasks"
  | "unassigned"
  | "archive"
  | "exceptions"
  | "new"
  | "history"
  | "report"
  | "notifications";

export type LiveMapPoint = {
  id: string;
  workerId: string;
  workerName: string;
  projectId: string;
  projectName: string;
  projectLocation: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  reportedAt: string;
  isActive: boolean;
};

export type ProjectException = {
  project: Project;
  type: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
};
