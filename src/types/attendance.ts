export type AttendanceType = "field" | "office" | "vacation" | "sick" | "reserve_duty";

export type AttendanceSession = {
  id: string;
  worker_id: string;
  started_at: string;
  ended_at: string | null;
  started_lat: number | null;
  started_lng: number | null;
  started_accuracy: number | null;
  ended_lat: number | null;
  ended_lng: number | null;
  ended_accuracy: number | null;
  end_note: string | null;
  attendance_type: AttendanceType;
  attendance_date: string;
  is_all_day: boolean;
  created_at: string;
  profiles?: { full_name: string; email: string | null } | null;
};
