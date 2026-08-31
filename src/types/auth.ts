export type Role = "manager" | "field_worker" | "drafter";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
};
