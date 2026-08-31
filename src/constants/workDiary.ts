import type { WorkKindKey, LeakKindKey, WorkDiaryProject, WorkDiaryForm } from "@/src/types";
import { toDateInputValue } from "@/src/utils/dates";

export const workKinds: Array<{ key: WorkKindKey; label: string }> = [
  { key: "color_marking", label: "איתור וסימון בצבע / יתדות" },
  { key: "sketch_marking", label: "איתור וסימון בסקיצה (לצרף סקיצה)" },
  { key: "autocad_mapping", label: "איתור ומיפוי אוטוקד" },
  { key: "excavation_escort", label: "ליווי חפירות" },
  { key: "cable_fault", label: "איתור תקלה בכבל" },
  { key: "suction_small", label: "שאיבת עפר קטנה" },
  { key: "suction_large", label: "שאיבת עפר גדולה" },
  { key: "gpr_usage", label: "שימוש ב-GPR" },
];

export const leakKinds: Array<{ key: LeakKindKey; label: string }> = [
  { key: "leak_detection", label: "איתור דלף" },
  { key: "point_leak", label: "דלף נקודתי" },
  { key: "depreciation_survey", label: "סקר פחת" },
];

export function emptyDiary(project: WorkDiaryProject, teamLeadName: string): WorkDiaryForm {
  return {
    work_date: toDateInputValue(),
    contact_name: "",
    contact_phone: project.contact_phone || "",
    start_time: "",
    end_time: "",
    site: project.location,
    role: "",
    infrastructure_type: "",
    color_marking: false,
    sketch_marking: false,
    autocad_mapping: false,
    excavation_escort: false,
    cable_fault: false,
    suction_small: false,
    suction_large: false,
    gpr_usage: false,
    work_day: "",
    area_sqm: "",
    infrastructure_length: "",
    units_to_meter: "",
    units_over_meter: "",
    units_depth: "",
    leak_detection: false,
    point_leak: false,
    depreciation_survey: false,
    leak_notes: "",
    additional_services: "",
    maya_equipment: "",
    customer_equipment: "",
    equipment_name: "",
    existing_map_marking: "",
    miscellaneous: "",
    customer_name: "",
    customer_phone: project.contact_phone || "",
    team_lead_name: teamLeadName,
    team_lead_phone: "",
    additional_notes: "",
  };
}
