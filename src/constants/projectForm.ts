import type { NewProject } from "@/src/types";

export const emptyProject: NewProject = {
  name: "",
  client_name: "",
  location: "",
  contact_phone: "",
  contact_email: "",
  description: "",
  assigned_to: "",
  assigned_workers: [],
  due_date: "",
  requires_work_diary: false,
};
