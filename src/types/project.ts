import type { Role } from "./auth";
import type { ProjectWorkSession } from "./work";

export type ProjectPhoto = {
  id: string;
  project_id?: string;
  file_path: string;
  category?: string | null;
  created_at: string;
};

export type ProjectReviewFile = {
  id: string;
  project_id: string;
  uploaded_by: string | null;
  file_path: string;
  file_name: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
};

export type ProjectTask = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  is_done: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string } | null;
};

export type Project = {
  id: string;
  name: string;
  client_name: string | null;
  location: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  description: string | null;
  assigned_to: string | null;
  status: string;
  progress: number;
  due_date: string | null;
  updated_at: string;
  is_archived?: boolean | null;
  archived_at?: string | null;
  requires_work_diary?: boolean;
  profiles?: { full_name: string } | null;
  project_photos?: ProjectPhoto[];
  project_tasks?: ProjectTask[];
  project_review_files?: ProjectReviewFile[];
  work_sessions?: ProjectWorkSession[];
  project_workers?: {
    worker_id: string;
    profiles?: { full_name: string; email: string | null; role: Role } | null;
  }[];
};

export type StatusHistory = {
  id: string;
  project_id: string;
  old_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
  project_photos?: ProjectPhoto[];
};

export type NewProject = {
  name: string;
  client_name: string;
  location: string;
  contact_phone: string;
  contact_email: string;
  description: string;
  assigned_to: string;
  assigned_workers: string[];
  due_date: string;
  requires_work_diary: boolean;
};
