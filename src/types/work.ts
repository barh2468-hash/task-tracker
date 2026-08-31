export type GeoLocationPoint = { lat: number; lng: number; accuracy: number | null };

export type WorkSession = {
  id: string;
  project_id: string;
  worker_id: string;
  started_at: string;
  ended_at: string | null;
  started_lat: number | null;
  started_lng: number | null;
  started_accuracy: number | null;
  ended_lat: number | null;
  ended_lng: number | null;
  ended_accuracy: number | null;
  end_note?: string | null;
  created_at: string;
  profiles?: { full_name: string; email: string | null } | null;
  projects?: {
    name: string;
    client_name: string | null;
    location: string;
    contact_phone?: string | null;
  } | null;
};

export type ProjectWorkSession = Pick<
  WorkSession,
  | "id"
  | "worker_id"
  | "started_at"
  | "ended_at"
  | "started_lat"
  | "started_lng"
  | "started_accuracy"
  | "ended_lat"
  | "ended_lng"
  | "ended_accuracy"
  | "end_note"
>;
