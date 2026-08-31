export type WorkDiaryProject = {
  id: string;
  name: string;
  client_name: string | null;
  location: string;
  contact_phone?: string | null;
};

export type WorkDiaryForm = {
  work_date: string;
  contact_name: string;
  contact_phone: string;
  start_time: string;
  end_time: string;
  site: string;
  role: string;
  infrastructure_type: string;
  color_marking: boolean;
  sketch_marking: boolean;
  autocad_mapping: boolean;
  excavation_escort: boolean;
  cable_fault: boolean;
  suction_small: boolean;
  suction_large: boolean;
  gpr_usage: boolean;
  work_day: string;
  area_sqm: string;
  infrastructure_length: string;
  units_to_meter: string;
  units_over_meter: string;
  units_depth: string;
  leak_detection: boolean;
  point_leak: boolean;
  depreciation_survey: boolean;
  leak_notes: string;
  paper_locating?: string;
  point_page?: string;
  additional_services: string;
  maya_equipment: string;
  customer_equipment: string;
  equipment_name: string;
  existing_map_marking: string;
  miscellaneous: string;
  customer_name: string;
  customer_phone: string;
  team_lead_name: string;
  team_lead_phone: string;
  additional_notes: string;
};

export type WorkDiaryRecord = {
  id: string;
  diary_number: number;
  project_id: string;
  form_data: WorkDiaryForm;
  customer_signature: string;
  team_lead_signature: string;
  signed_at: string;
  created_at: string;
  profiles?: { full_name: string } | null;
};

export type WorkKindKey =
  | "color_marking"
  | "sketch_marking"
  | "autocad_mapping"
  | "excavation_escort"
  | "cable_fault"
  | "suction_small"
  | "suction_large"
  | "gpr_usage";

export type LeakKindKey = "leak_detection" | "point_leak" | "depreciation_survey";
