export type AppNotification = {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string | null;
  project_id: string | null;
  task_id: string | null;
  created_by: string | null;
  is_read: boolean;
  created_at: string;
  profiles?: { full_name: string } | null;
  projects?: { name: string } | null;
};
