"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Bell,
  Camera,
  CheckCircle,
  ChevronDown,
  Clock,
  Download,
  FilePlus2,
  FileText,
  FolderKanban,
  History,
  LogOut,
  MapPin,
  Pencil,
  Phone,
  PlayCircle,
  PlusCircle,
  RotateCcw,
  Search,
  Shield,
  Square,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { envReady, statusProgress, statuses, supabase } from "@/lib/supabase";

type Role = "manager" | "field_worker" | "drafter";
type Profile = {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
};
type ProjectPhoto = {
  id: string;
  project_id?: string;
  file_path: string;
  category?: string | null;
  created_at: string;
};
type ProjectReviewFile = {
  id: string;
  project_id: string;
  uploaded_by: string | null;
  file_path: string;
  file_name: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
};

type ProjectTask = {
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
type AppNotification = {
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
type WorkSession = {
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
type ProjectWorkSession = Pick<
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

type Project = {
  id: string;
  name: string;
  client_name: string | null;
  location: string;
  contact_phone?: string | null;
  description: string | null;
  assigned_to: string | null;
  status: string;
  progress: number;
  due_date: string | null;
  updated_at: string;
  is_archived?: boolean | null;
  archived_at?: string | null;
  profiles?: { full_name: string } | null;
  project_photos?: ProjectPhoto[];
  project_tasks?: ProjectTask[];
  project_review_files?: ProjectReviewFile[];
  work_sessions?: ProjectWorkSession[];
  project_workers?: { worker_id: string; profiles?: { full_name: string; email: string | null } | null }[];
};
type StatusHistory = {
  id: string;
  project_id: string;
  old_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
  project_photos?: ProjectPhoto[];
};

type NewProject = {
  name: string;
  client_name: string;
  location: string;
  contact_phone: string;
  description: string;
  assigned_to: string;
  assigned_workers: string[];
  due_date: string;
};

const emptyProject: NewProject = {
  name: "",
  client_name: "",
  location: "",
  contact_phone: "",
  description: "",
  assigned_to: "",
  assigned_workers: [],
  due_date: "",
};
const photoCategories = [
  "תמונת שטח",
  "תשתית שנמצאה",
  "בעיה / חסם",
  "סימון בשטח",
  "אישור סיום",
  "אחר",
];

type GeoLocationPoint = { lat: number; lng: number; accuracy: number | null };

function toDateInputValue(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getMonthRange(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end),
    month: `${year}-${String(month + 1).padStart(2, "0")}`,
  };
}

function sessionStartedInRange(
  item: WorkSession,
  fromDate: string,
  toDate: string,
) {
  const started = item.started_at.slice(0, 10);
  return (!fromDate || started >= fromDate) && (!toDate || started <= toDate);
}

const reviewStatus = "נשלח להגהה";
const appStatuses = (statuses as readonly string[]).includes(reviewStatus) ? statuses : [...statuses, reviewStatus];

const roleLabel: Record<Role, string> = {
  manager: "מנהל מערכת",
  field_worker: "עובד שטח",
  drafter: "שרטט",
};

export default function Page() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [historyItems, setHistoryItems] = useState<StatusHistory[]>([]);
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [tab, setTab] = useState<
    | "mine"
    | "all"
    | "assignments"
    | "today"
    | "projectStatus"
    | "unassigned"
    | "archive"
    | "exceptions"
    | "new"
    | "history"
    | "report"
    | "notifications"
  >("mine");
  const isManager = profile?.role === "manager";
  const isDrafter = profile?.role === "drafter";
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const defaultReportRange = getMonthRange();
  const [reportWorkerId, setReportWorkerId] = useState("all");
  const [reportMonth, setReportMonth] = useState(defaultReportRange.month);
  const [reportFromDate, setReportFromDate] = useState(defaultReportRange.from);
  const [reportToDate, setReportToDate] = useState(defaultReportRange.to);
  const [message, setMessage] = useState("");
  const [newProject, setNewProject] = useState<NewProject>(emptyProject);

  useEffect(() => {
    if (!envReady) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    loadProfileAndData();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session || !message) return;
    const timeout = window.setTimeout(() => setMessage(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [message, session]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel("infrastructure-tracker-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        () => loadProjects(profile),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "status_history" },
        () => loadHistory(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_photos" },
        () => loadProjects(profile),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_tasks" },
        () => loadProjects(profile),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_sessions" },
        () => {
          loadProjects(profile);
          loadWorkSessions(profile);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => loadNotifications(profile),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  async function login() {
    setMessage("");
    if (!email || !password) {
      setMessage("יש למלא מייל וסיסמה.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setMessage(error ? translateAuthError(error.message) : "התחברת בהצלחה.");
  }

  async function signup() {
    setMessage("");
    if (!email || !password) {
      setMessage("יש למלא מייל וסיסמה.");
      return;
    }
    if (password.length < 6) {
      setMessage("הסיסמה חייבת להכיל לפחות 6 תווים.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName || email.split("@")[0] } },
    });

    setMessage(
      error
        ? translateAuthError(error.message)
        : "המשתמש נוצר. אם נדרש אישור מייל ב-Supabase, אשר את המשתמש דרך Authentication > Users.",
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setProjects([]);
    setHistoryItems([]);
    setNotifications([]);
  }

  async function loadProfileAndData() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    setMessage("");

    let { data: prof, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    // Safety fallback: if the profile was created manually and the app somehow fails to fetch by id,
    // try by email before creating a default field_worker profile.
    if (!prof && user.email && !profileError) {
      const byEmail = await supabase
        .from("profiles")
        .select("*")
        .eq("email", user.email)
        .maybeSingle();
      prof = byEmail.data;
      profileError = byEmail.error;
    }

    if (!prof && !profileError) {
      const fullNameFromAuth =
        (user.user_metadata?.full_name as string) ||
        user.email?.split("@")[0] ||
        "עובד שטח";
      const created = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          full_name: fullNameFromAuth,
          role: "field_worker",
        })
        .select("*")
        .maybeSingle();
      prof = created.data;
      profileError = created.error;
    }

    if (!prof) {
      setProfile(null);
      setProjects([]);
      setHistoryItems([]);
      setMessage(
        profileError?.message ||
          "לא נמצא פרופיל למשתמש המחובר. בדוק את טבלת profiles ואת הרשאות RLS.",
      );
      return;
    }

    const typedProfile = prof as Profile;
    setProfile(typedProfile);
    if (typedProfile.role === "manager") setTab("all");
    await Promise.all([
      loadProjects(typedProfile),
      loadWorkers(typedProfile),
      loadHistory(typedProfile),
      loadWorkSessions(typedProfile),
      loadNotifications(typedProfile),
    ]);
  }

  async function loadWorkers(activeProfile = profile) {
    if (activeProfile?.role !== "manager") {
      setWorkers([]);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    if (error) {
      setMessage(error.message);
      setWorkers([]);
      return;
    }
    setWorkers((data || []) as Profile[]);
  }

  async function loadProjects(activeProfile = profile) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user || !activeProfile) return;

    let request = supabase
      .from("projects")
      .select(
        "*, profiles:assigned_to(full_name), project_workers(worker_id,profiles:worker_id(full_name,email)), project_photos(id,file_path,category,created_at), project_tasks(id,project_id,title,description,is_done,created_by,created_at,updated_at,profiles:created_by(full_name)), project_review_files(id,project_id,uploaded_by,file_path,file_name,created_at,profiles:uploaded_by(full_name)), work_sessions(id,worker_id,started_at,ended_at,started_lat,started_lng,started_accuracy,ended_lat,ended_lng,ended_accuracy,end_note)",
      )
      .order("updated_at", { ascending: false });

    if (activeProfile.role === "drafter") {
      request = request.in("status", ["עבר לשרטוט", reviewStatus]);
    } else if (activeProfile.role !== "manager") {
      const { data: extraAssignments } = await supabase
        .from("project_workers")
        .select("project_id")
        .eq("worker_id", user.id);
      const extraIds = Array.from(
        new Set((extraAssignments || []).map((row: any) => row.project_id).filter(Boolean)),
      );
      const filters = [`assigned_to.eq.${user.id}`];
      if (extraIds.length) filters.push(`id.in.(${extraIds.join(",")})`);
      request = request.or(filters.join(","));
    }

    const { data, error } = await request;
    if (error) setMessage(error.message);
    setProjects((data || []) as Project[]);
  }

  async function loadHistory(_activeProfile = profile) {
    const { data } = await supabase
      .from("status_history")
      .select("*, profiles:changed_by(full_name)")
      .order("created_at", { ascending: false })
      .limit(100);
    setHistoryItems((data || []) as StatusHistory[]);
  }

  async function loadWorkSessions(activeProfile = profile) {
    if (activeProfile?.role !== "manager") {
      setWorkSessions([]);
      return;
    }

    const { data, error } = await supabase
      .from("work_sessions")
      .select(
        "*, profiles:worker_id(full_name,email), projects:project_id(name,client_name,location)",
      )
      .order("started_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setWorkSessions([]);
      return;
    }

    setWorkSessions((data || []) as WorkSession[]);
  }

  async function loadNotifications(_activeProfile = profile) {
    const { data, error } = await supabase
      .from("notifications")
      .select("*, profiles:created_by(full_name), projects:project_id(name)")
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) {
      // The table may not exist until the SQL migration is run, so do not block the app.
      console.warn("Notifications load failed:", error.message);
      setNotifications([]);
      return;
    }

    setNotifications((data || []) as AppNotification[]);
  }

  async function markNotificationRead(notificationId: string) {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
    await loadNotifications();
  }

  async function markAllNotificationsRead() {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false);
    await loadNotifications();
  }

  async function startWork(project: Project) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const openSession = project.work_sessions?.find(
      (w) => w.worker_id === user.id && !w.ended_at,
    );
    if (openSession) {
      setMessage(
        "כבר קיימת שעת התחלה פתוחה לפרויקט הזה. לחץ סיים עבודה כדי לסגור אותה.",
      );
      return;
    }

    setMessage("מבקש הרשאת מיקום מהמכשיר...");
    const location = await getCurrentLocationWithFallback();
    if (location === false) {
      setMessage("התחלת העבודה בוטלה כי לא התקבל אישור מיקום.");
      return;
    }

    const startedAt = new Date();
    const { error } = await supabase.from("work_sessions").insert({
      project_id: project.id,
      worker_id: user.id,
      started_at: startedAt.toISOString(),
      started_lat: location?.lat ?? null,
      started_lng: location?.lng ?? null,
      started_accuracy: location?.accuracy ?? null,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    const locationText = location
      ? ` · מיקום התחלה: ${formatLocation(location)}`
      : " · מיקום התחלה לא נשמר";
    await supabase.from("status_history").insert({
      project_id: project.id,
      old_status: null,
      new_status: "התחלת עבודה",
      changed_by: user.id,
      note: `שעת התחלה: ${startedAt.toLocaleString("he-IL")}${locationText}`,
    });

    if (profile?.role === "field_worker") {
      await createManagerNotification(
        "work_started",
        `התחלת עבודה: ${project.name}`,
        `${profile.full_name} התחיל עבודה בפרויקט ${project.name}.${location ? ` מיקום: ${formatLocation(location)}` : ""}`,
        project.id,
      );
    }

    setMessage(
      `נרשמה שעת התחלה עבור ${project.name}${location ? " כולל מיקום" : ""}`,
    );
    await Promise.all([loadProjects(), loadHistory(), loadWorkSessions()]);
  }

  async function endWork(project: Project) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const openSession = project.work_sessions?.find(
      (w) => w.worker_id === user.id && !w.ended_at,
    );
    if (!openSession) {
      setMessage("לא נמצאה שעת התחלה פתוחה לפרויקט הזה.");
      return;
    }

    setMessage("מבקש מיקום סיום מהמכשיר...");
    const location = await getCurrentLocationWithFallback();
    if (location === false) {
      setMessage("סיום העבודה בוטל כי לא התקבל אישור מיקום.");
      return;
    }

    const endNote = window.prompt("הערת סיום עבודה, אופציונלי:", "") || "";
    const endedAt = new Date();
    const startedAt = new Date(openSession.started_at);
    const minutes = Math.max(
      0,
      Math.round((endedAt.getTime() - startedAt.getTime()) / 60000),
    );

    const { error } = await supabase
      .from("work_sessions")
      .update({
        ended_at: endedAt.toISOString(),
        ended_lat: location?.lat ?? null,
        ended_lng: location?.lng ?? null,
        ended_accuracy: location?.accuracy ?? null,
        end_note: endNote.trim() || null,
      })
      .eq("id", openSession.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    const locationText = location
      ? ` · מיקום סיום: ${formatLocation(location)}`
      : " · מיקום סיום לא נשמר";
    await supabase.from("status_history").insert({
      project_id: project.id,
      old_status: null,
      new_status: "סיום עבודה",
      changed_by: user.id,
      note: `שעת סיום: ${endedAt.toLocaleString("he-IL")} · זמן עבודה: ${formatDuration(minutes)}${locationText}${endNote.trim() ? ` · הערת סיום: ${endNote.trim()}` : ""}`,
    });

    if (profile?.role === "field_worker") {
      await createManagerNotification(
        "work_ended",
        `סיום עבודה: ${project.name}`,
        `${profile.full_name} סיים עבודה בפרויקט ${project.name}. זמן עבודה: ${formatDuration(minutes)}.${location ? ` מיקום: ${formatLocation(location)}` : ""}${endNote.trim() ? ` הערת סיום: ${endNote.trim()}` : ""}`,
        project.id,
      );
    }

    setMessage(
      `נרשמה שעת סיום עבור ${project.name}. זמן עבודה: ${formatDuration(minutes)}${location ? " כולל מיקום" : ""}`,
    );
    await Promise.all([loadProjects(), loadHistory(), loadWorkSessions()]);
  }

  function exportWorkReport(
    workerId = reportWorkerId,
    fromDate = reportFromDate,
    toDate = reportToDate,
  ) {
    const filteredSessions = workSessions
      .filter((item) => workerId === "all" || item.worker_id === workerId)
      .filter((item) => sessionStartedInRange(item, fromDate, toDate));

    if (!filteredSessions.length) {
      setMessage(
        workerId === "all"
          ? "אין נתוני שעות לייצוא בטווח התאריכים שנבחר."
          : "אין נתוני שעות לעובד שנבחר בטווח התאריכים.",
      );
      return;
    }

    const rows = buildWorkReportRows(filteredSessions);
    const headers = [
      "מתאריך",
      "עד תאריך",
      "עובד",
      "מייל",
      "פרויקט",
      "לקוח",
      "מיקום",
      "תאריכי עבודה",
      "מספר ימים",
      "סה״כ דקות",
      "סה״כ שעות",
      "כניסות פתוחות",
      "מיקומי התחלה",
      "מיקומי סיום",
    ];
    const csvRows = [
      headers,
      ...rows.map((r) => [
        fromDate || "",
        toDate || "",
        r.workerName,
        r.email,
        r.projectName,
        r.clientName,
        r.location,
        r.workDates.join(" | "),
        String(r.days),
        String(r.totalMinutes),
        formatHoursDecimal(r.totalMinutes),
        String(r.openSessions),
        r.startMapLinks.join(" | "),
        r.endMapLinks.join(" | "),
      ]),
    ];
    const csv =
      "\uFEFF" + csvRows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const selectedWorker = workers.find((w) => w.id === workerId);
    const workerPart = selectedWorker
      ? `-${selectedWorker.full_name.replace(/\s+/g, "-")}`
      : "-כל-העובדים";
    const rangePart = `${fromDate || "ללא-התחלה"}-עד-${toDate || "ללא-סיום"}`;
    a.download = `דוח-שעות-עובדים${workerPart}-${rangePart}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function createManagerNotification(
    type: string,
    title: string,
    body: string,
    projectId?: string,
    taskId?: string,
  ) {
    const { error } = await supabase.rpc("create_manager_notifications", {
      p_type: type,
      p_title: title,
      p_body: body,
      p_project_id: projectId || null,
      p_task_id: taskId || null,
    });
    if (error) console.warn("Internal notification failed:", error.message);
  }

  async function createUserNotification(
    userId: string | null | undefined,
    type: string,
    title: string,
    body: string,
    projectId?: string,
    taskId?: string,
  ) {
    if (!userId) return;
    const { error } = await supabase.rpc("create_user_notification", {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_body: body,
      p_project_id: projectId || null,
      p_task_id: taskId || null,
    });
    if (error) console.warn("User notification failed:", error.message);
  }

  async function updateStatus(
    project: Project,
    newStatus: string,
    note: string,
  ) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const nextProgress = newStatus === reviewStatus ? 85 : statusProgress[newStatus] ?? project.progress;
    const { error } = await supabase
      .from("projects")
      .update({ status: newStatus, progress: nextProgress })
      .eq("id", project.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    const { error: historyError } = await supabase
      .from("status_history")
      .insert({
        project_id: project.id,
        old_status: project.status,
        new_status: newStatus,
        changed_by: user.id,
        note: note || "עדכון סטטוס מהשטח",
      });

    if (historyError) {
      setMessage(historyError.message);
      return;
    }

    // Internal + email notifications are sent when a field worker changes status.
    // If the Edge Function is not configured yet, the status update still succeeds.
    if (profile?.role === "field_worker") {
      await createManagerNotification(
        "status_change",
        `עדכון סטטוס: ${project.name}`,
        `${profile.full_name} עדכן סטטוס בפרויקט ${project.name}: ${project.status} → ${newStatus}${note ? `. הערה: ${note}` : ""}`,
        project.id,
      );

      const { error: notifyError } = await supabase.functions.invoke(
        "notify-status-change",
        {
          body: {
            projectId: project.id,
            projectName: project.name,
            clientName: project.client_name,
            location: project.location,
            oldStatus: project.status,
            newStatus,
            note: note || "",
            changedByName: profile.full_name,
            changedByEmail: profile.email,
            changedByRole: profile.role,
            appUrl: typeof window !== "undefined" ? window.location.origin : "",
          },
        },
      );

      if (notifyError) {
        console.warn("Email notification failed:", notifyError.message);
        setMessage(
          `הסטטוס עודכן ל: ${newStatus}. שים לב: התראת המייל לא נשלחה (${notifyError.message}).`,
        );
        await Promise.all([loadProjects(), loadHistory()]);
        return;
      }
    }

    setMessage(`הסטטוס של ${project.name} עודכן ל: ${newStatus}`);
    await Promise.all([loadProjects(), loadHistory()]);
  }

  async function uploadPhoto(
    projectId: string,
    file: File,
    category = "תמונת שטח",
  ) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${projectId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage
      .from("project-photos")
      .upload(path, file, { upsert: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase
      .from("project_photos")
      .insert({
        project_id: projectId,
        uploaded_by: user.id,
        file_path: path,
        category,
      });
    await supabase
      .from("status_history")
      .insert({
        project_id: projectId,
        old_status: null,
        new_status: "הועלתה תמונה",
        changed_by: user.id,
        note: `${category}: ${file.name}`,
      });
    setMessage("התמונה הועלתה ונשמרה בפרויקט");
    await loadHistory();
  }

  async function sendProjectAssignmentEmail(
    workerId: string,
    project: {
      id: string;
      name: string;
      client_name?: string | null;
      location?: string | null;
      contact_phone?: string | null;
      description?: string | null;
      due_date?: string | null;
    },
  ) {
    const { error } = await supabase.functions.invoke(
      "notify-project-assigned",
      {
        body: {
          workerId,
          projectId: project.id,
          projectName: project.name,
          clientName: project.client_name || null,
          location: project.location || null,
          contactPhone: project.contact_phone || null,
          description: project.description || null,
          dueDate: project.due_date || null,
          assignedByName: profile?.full_name || "מנהל מערכת",
          appUrl:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      },
    );

    if (error) {
      console.warn("Project assignment email failed:", error.message);
      return false;
    }

    return true;
  }

  function getProjectFieldWorkerIds(project: Project) {
    return Array.from(
      new Set(
        [project.assigned_to, ...(project.project_workers || []).map((worker) => worker.worker_id)]
          .filter(Boolean) as string[],
      ),
    );
  }

  async function sendProjectToReview(project: Project, file: File, note: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user || !profile) return;
    if (profile.role !== "drafter" && profile.role !== "manager") {
      setMessage("רק שרטט או מנהל יכולים לשלוח פרויקט להגהה.");
      return;
    }
    if (project.status !== "עבר לשרטוט") {
      setMessage("אפשר לשלוח להגהה רק פרויקט שנמצא בסטטוס עבר לשרטוט.");
      return;
    }
    if (!file) {
      setMessage("יש לבחור קובץ PDF לפני שליחה להגהה.");
      return;
    }
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setMessage("אפשר להעלות להגהה קובץ PDF בלבד.");
      return;
    }

    setMessage("מעלה PDF ושולח את הפרויקט להגהה...");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${project.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("project-review-files")
      .upload(path, file, { upsert: false, contentType: "application/pdf" });
    if (uploadError) {
      setMessage(uploadError.message);
      return;
    }

    const { error: fileError } = await supabase.from("project_review_files").insert({
      project_id: project.id,
      uploaded_by: user.id,
      file_path: path,
      file_name: file.name,
    });
    if (fileError) {
      setMessage(fileError.message);
      return;
    }

    const nextProgress = 85;
    const { error: projectError } = await supabase
      .from("projects")
      .update({ status: reviewStatus, progress: nextProgress })
      .eq("id", project.id);
    if (projectError) {
      setMessage(projectError.message);
      return;
    }

    const cleanNote = note.trim();
    await supabase.from("status_history").insert({
      project_id: project.id,
      old_status: project.status,
      new_status: reviewStatus,
      changed_by: user.id,
      note: `נשלח להגהה על ידי ${profile.full_name}. PDF: ${file.name}${cleanNote ? ` · הערה: ${cleanNote}` : ""}`,
    });

    const workerIds = getProjectFieldWorkerIds(project);
    for (const workerId of workerIds) {
      await createUserNotification(
        workerId,
        "project_review_sent",
        `נשלח להגהה: ${project.name}`,
        `השרטט ${profile.full_name} שלח את הפרויקט להגהה וצירף PDF לבדיקה.${cleanNote ? ` הערה: ${cleanNote}` : ""}`,
        project.id,
      );
    }

    const { error: notifyError } = await supabase.functions.invoke("notify-project-review", {
      body: {
        projectId: project.id,
        projectName: project.name,
        clientName: project.client_name,
        location: project.location,
        contactPhone: project.contact_phone || null,
        pdfFileName: file.name,
        pdfFilePath: path,
        note: cleanNote,
        changedByName: profile.full_name,
        changedByEmail: profile.email,
        appUrl: typeof window !== "undefined" ? window.location.origin : "",
      },
    });

    if (notifyError) {
      console.warn("Review email notification failed:", notifyError.message);
      setMessage(`הפרויקט נשלח להגהה והעובדים קיבלו התראה פנימית. שים לב: מייל ההגהה לא נשלח (${notifyError.message}).`);
      await Promise.all([loadProjects(), loadHistory(), loadNotifications()]);
      return;
    }

    setMessage("הפרויקט נשלח להגהה, ה-PDF נשמר ונשלחו התראות ומיילים.");
    await Promise.all([loadProjects(), loadHistory(), loadNotifications()]);
  }

  async function deleteProjectReviewFile(file: ProjectReviewFile, projectId: string) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user || !profile) return;
    if (profile.role !== "manager" && profile.role !== "drafter") {
      setMessage("רק מנהל או שרטט יכולים למחוק קובץ PDF של הגהה.");
      return;
    }

    const ok = window.confirm(`למחוק את קובץ ההגהה "${file.file_name || "קובץ PDF"}"? פעולה זו מוחקת רק את ה-PDF ולא את הפרויקט.`);
    if (!ok) return;

    const { error: storageError } = await supabase.storage
      .from("project-review-files")
      .remove([file.file_path]);

    if (storageError) {
      setMessage(`מחיקת הקובץ מהאחסון נכשלה: ${storageError.message}`);
      return;
    }

    const { error: deleteError } = await supabase
      .from("project_review_files")
      .delete()
      .eq("id", file.id);

    if (deleteError) {
      setMessage(`הקובץ נמחק מהאחסון, אבל מחיקת הרשומה נכשלה: ${deleteError.message}`);
      return;
    }

    await supabase.from("status_history").insert({
      project_id: projectId,
      old_status: null,
      new_status: "נמחק קובץ הגהה",
      changed_by: user.id,
      note: file.file_name || "קובץ PDF",
    });

    setMessage("קובץ ה-PDF נמחק מההגהה. הפרויקט עצמו לא נמחק.");
    await Promise.all([loadProjects(), loadHistory()]);
  }


  async function saveProject(
    projectId: string,
    changes: Partial<NewProject & { status: string; progress: number }>,
  ) {
    if (profile?.role !== "manager") return;

    const originalProject = projects.find((item) => item.id === projectId);
    const previousAssignedTo = originalProject?.assigned_to || null;
    const nextAssignedTo = changes.assigned_to || null;

    const payload = {
      name: changes.name,
      client_name: changes.client_name || null,
      location: changes.location,
      contact_phone: changes.contact_phone || null,
      description: changes.description || null,
      assigned_to: nextAssignedTo,
      due_date: changes.due_date || null,
    };

    const { error } = await supabase
      .from("projects")
      .update(payload)
      .eq("id", projectId);
    if (error) {
      setMessage(error.message);
      return;
    }

    const previousExtraWorkers = new Set((originalProject?.project_workers || []).map((w) => w.worker_id));
    const nextExtraWorkers = new Set(changes.assigned_workers || []);
    const addedExtraWorkers = Array.from(nextExtraWorkers).filter((id) => !previousExtraWorkers.has(id));

    await supabase.from("project_workers").delete().eq("project_id", projectId);
    if (nextExtraWorkers.size) {
      const user = (await supabase.auth.getUser()).data.user;
      await supabase.from("project_workers").insert(
        Array.from(nextExtraWorkers).map((workerId) => ({
          project_id: projectId,
          worker_id: workerId,
          assigned_by: user?.id || null,
        })),
      );
    }

    let assignmentEmailSent = true;
    const projectNameForNotify = changes.name || originalProject?.name || "פרויקט";
    const managerNameForNotify = profile?.full_name || "מנהל מערכת";
    for (const workerId of addedExtraWorkers) {
      await createUserNotification(
        workerId,
        "project_assigned",
        `שויך אליך פרויקט חדש: ${projectNameForNotify}`,
        `${managerNameForNotify} צירף אותך לפרויקט ${projectNameForNotify}.${changes.location ? ` מיקום: ${changes.location}` : ""}`,
        projectId,
      );
      const ok = await sendProjectAssignmentEmail(workerId, {
        id: projectId,
        name: projectNameForNotify,
        client_name: changes.client_name || originalProject?.client_name || null,
        location: changes.location || originalProject?.location || null,
        contact_phone: changes.contact_phone || originalProject?.contact_phone || null,
        description: changes.description || originalProject?.description || null,
        due_date: changes.due_date || originalProject?.due_date || null,
      });
      if (!ok) assignmentEmailSent = false;
    }

    if (nextAssignedTo && nextAssignedTo !== previousAssignedTo) {
      const projectName = changes.name || originalProject?.name || "פרויקט";
      const managerName = profile?.full_name || "מנהל מערכת";
      await createUserNotification(
        nextAssignedTo,
        "project_assigned",
        `שויך אליך פרויקט חדש: ${projectName}`,
        `${managerName} שייך אליך את הפרויקט ${projectName}.${changes.location ? ` מיקום: ${changes.location}` : ""}`,
        projectId,
      );

      assignmentEmailSent = await sendProjectAssignmentEmail(nextAssignedTo, {
        id: projectId,
        name: projectName,
        client_name:
          changes.client_name || originalProject?.client_name || null,
        location: changes.location || originalProject?.location || null,
        contact_phone: changes.contact_phone || originalProject?.contact_phone || null,
        description:
          changes.description || originalProject?.description || null,
        due_date: changes.due_date || originalProject?.due_date || null,
      });
    }

    const assignmentChanged =
      (nextAssignedTo && nextAssignedTo !== previousAssignedTo) || addedExtraWorkers.length > 0;
    setMessage(
      assignmentChanged
        ? assignmentEmailSent
          ? "הפרויקט עודכן והעובדים החדשים קיבלו התראה במערכת ומייל"
          : "הפרויקט עודכן והעובדים החדשים קיבלו התראה במערכת. שים לב: חלק מהמיילים לא נשלחו"
        : "הפרויקט עודכן בהצלחה",
    );
    await Promise.all([loadProjects(), loadNotifications()]);
  }

  async function deleteProject(project: Project) {
    if (profile?.role !== "manager") return;
    const ok = window.confirm(
      `למחוק את הפרויקט "${project.name}"? פעולה זו תמחק גם היסטוריה ותמונות שמקושרות אליו.`,
    );
    if (!ok) return;

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", project.id);
    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("הפרויקט נמחק");
    await Promise.all([loadProjects(), loadHistory()]);
  }

  async function archiveProject(project: Project) {
    if (profile?.role !== "manager") return;
    const ok = window.confirm(
      `להעביר את הפרויקט "${project.name}" לארכיון? הפרויקט לא יופיע ברשימת הפרויקטים הפעילים, אבל כל הנתונים יישמרו.`,
    );
    if (!ok) return;

    const { error } = await supabase
      .from("projects")
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq("id", project.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (user) {
      await supabase.from("status_history").insert({
        project_id: project.id,
        old_status: project.status,
        new_status: "הועבר לארכיון",
        changed_by: user.id,
        note: "הפרויקט נשמר בארכיון ואינו מוצג ברשימת הפרויקטים הפעילים",
      });
    }

    setMessage("הפרויקט הועבר לארכיון");
    await Promise.all([loadProjects(), loadHistory()]);
  }

  async function restoreProject(project: Project) {
    if (profile?.role !== "manager") return;

    const { error } = await supabase
      .from("projects")
      .update({ is_archived: false, archived_at: null })
      .eq("id", project.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (user) {
      await supabase.from("status_history").insert({
        project_id: project.id,
        old_status: project.status,
        new_status: "שוחזר מהארכיון",
        changed_by: user.id,
        note: "הפרויקט חזר לרשימת הפרויקטים הפעילים",
      });
    }

    setMessage("הפרויקט שוחזר מהארכיון");
    await Promise.all([loadProjects(), loadHistory()]);
  }

  async function addProjectTask(
    projectId: string,
    title: string,
    description: string,
  ) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user || profile?.role !== "manager") return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setMessage("יש למלא כותרת למשימה.");
      return;
    }

    const { error } = await supabase.from("project_tasks").insert({
      project_id: projectId,
      title: cleanTitle,
      description: description.trim() || null,
      created_by: user.id,
      is_done: false,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("status_history").insert({
      project_id: projectId,
      old_status: null,
      new_status: "נוספה משימה",
      changed_by: user.id,
      note: cleanTitle,
    });

    const project = projects.find((p) => p.id === projectId);
    if (project?.assigned_to) {
      await createUserNotification(
        project.assigned_to,
        "task_added",
        `משימה חדשה: ${project.name}`,
        `נוספה משימה חדשה לפרויקט ${project.name}: ${cleanTitle}`,
        projectId,
      );
    }

    setMessage("המשימה נוספה לפרויקט");
    await Promise.all([loadProjects(), loadHistory(), loadNotifications()]);
  }

  async function toggleProjectTask(task: ProjectTask, project: Project) {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user || !profile) return;

    const isAssignedWorker =
      profile.role === "field_worker" && project.assigned_to === user.id;
    if (!isManager && !isAssignedWorker) return;

    const nextDone = !task.is_done;
    const { error } = await supabase
      .from("project_tasks")
      .update({ is_done: nextDone })
      .eq("id", task.id);
    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.from("status_history").insert({
      project_id: project.id,
      old_status: null,
      new_status: nextDone ? "משימה בוצעה" : "משימה נפתחה מחדש",
      changed_by: user.id,
      note: task.title,
    });

    if (nextDone && profile.role === "field_worker") {
      await createManagerNotification(
        "task_done",
        `משימה בוצעה: ${project.name}`,
        `${profile.full_name} סימן משימה כבוצעה בפרויקט ${project.name}: ${task.title}`,
        project.id,
        task.id,
      );

      const { error: notifyError } = await supabase.functions.invoke(
        "notify-task-done",
        {
          body: {
            projectId: project.id,
            projectName: project.name,
            clientName: project.client_name,
            location: project.location,
            taskId: task.id,
            taskTitle: task.title,
            taskDescription: task.description,
            changedByName: profile.full_name,
            changedByEmail: profile.email,
            appUrl: typeof window !== "undefined" ? window.location.origin : "",
          },
        },
      );

      if (notifyError) {
        console.warn("Task email notification failed:", notifyError.message);
        setMessage(
          `המשימה סומנה כבוצעה. שים לב: התראת המייל לא נשלחה (${notifyError.message}).`,
        );
        await Promise.all([loadProjects(), loadHistory(), loadNotifications()]);
        return;
      }
    }

    setMessage(nextDone ? "המשימה סומנה כבוצעה" : "המשימה סומנה כפתוחה");
    await Promise.all([loadProjects(), loadHistory(), loadNotifications()]);
  }

  async function deleteProjectTask(task: ProjectTask) {
    if (profile?.role !== "manager") return;
    const ok = window.confirm(`למחוק את המשימה "${task.title}"?`);
    if (!ok) return;
    const { error } = await supabase
      .from("project_tasks")
      .delete()
      .eq("id", task.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("המשימה נמחקה");
    await loadProjects();
  }

  async function createProject() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user || profile?.role !== "manager") return;
    if (!newProject.name || !newProject.location) {
      setMessage("חובה למלא שם פרויקט ומיקום. שיוך לעובד אפשר לבצע גם בהמשך.");
      return;
    }

    const { data: insertedProject, error } = await supabase
      .from("projects")
      .insert({
        name: newProject.name,
        client_name: newProject.client_name || null,
        location: newProject.location,
        contact_phone: newProject.contact_phone || null,
        description: newProject.description || null,
        assigned_to: newProject.assigned_to || null,
        due_date: newProject.due_date || null,
        created_by: user.id,
        status: "בעבודה בשטח",
        progress: 25,
      })
      .select("id")
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    let assignmentEmailSent = true;
    if (insertedProject?.id && newProject.assigned_workers.length) {
      await supabase.from("project_workers").insert(
        newProject.assigned_workers.map((workerId) => ({
          project_id: insertedProject.id,
          worker_id: workerId,
          assigned_by: user.id,
        })),
      );
    }

    if (newProject.assigned_to && insertedProject?.id) {
      await createUserNotification(
        newProject.assigned_to,
        "project_assigned",
        `שויך אליך פרויקט חדש: ${newProject.name}`,
        `${profile.full_name} שייך אליך את הפרויקט ${newProject.name}. מיקום: ${newProject.location}`,
        insertedProject.id,
      );

      assignmentEmailSent = await sendProjectAssignmentEmail(
        newProject.assigned_to,
        {
          id: insertedProject.id,
          name: newProject.name,
          client_name: newProject.client_name || null,
          location: newProject.location || null,
          contact_phone: newProject.contact_phone || null,
          description: newProject.description || null,
          due_date: newProject.due_date || null,
        },
      );
    }

    if (insertedProject?.id) {
      const workerIdsToNotify = Array.from(
        new Set([newProject.assigned_to, ...newProject.assigned_workers].filter(Boolean)),
      );
      for (const workerId of workerIdsToNotify) {
        if (workerId === newProject.assigned_to) continue;
        await createUserNotification(
          workerId,
          "project_assigned",
          `שויך אליך פרויקט חדש: ${newProject.name}`,
          `${profile.full_name} צירף אותך לפרויקט ${newProject.name}. מיקום: ${newProject.location}`,
          insertedProject.id,
        );
        const ok = await sendProjectAssignmentEmail(workerId, {
          id: insertedProject.id,
          name: newProject.name,
          client_name: newProject.client_name || null,
          location: newProject.location || null,
          contact_phone: newProject.contact_phone || null,
          description: newProject.description || null,
          due_date: newProject.due_date || null,
        });
        if (!ok) assignmentEmailSent = false;
      }
    }

    setNewProject(emptyProject);
    setTab("all");
    const hasAssignedWorkers = !!newProject.assigned_to || newProject.assigned_workers.length > 0;
    setMessage(
      hasAssignedWorkers
        ? assignmentEmailSent
          ? "הפרויקט נוצר, שויך לעובדים והעובדים קיבלו התראה במערכת ומייל"
          : "הפרויקט נוצר והעובדים קיבלו התראה במערכת. שים לב: חלק מהמיילים לא נשלחו"
        : "הפרויקט נוצר ללא שיוך לעובד. אפשר לשייך אותו בהמשך דרך עריכה.",
    );
    await Promise.all([loadProjects(), loadNotifications()]);
  }

  const activeProjects = useMemo(
    () => projects.filter((p) => !p.is_archived),
    [projects],
  );
  const archivedProjects = useMemo(
    () => projects.filter((p) => p.is_archived),
    [projects],
  );

  const visibleProjects = useMemo(() => {
    return projects.filter((p) => {
      const text =
        `${p.name} ${p.location} ${p.contact_phone || ""} ${p.client_name || ""} ${p.description || ""}`.toLowerCase();
      const okQuery = !query || text.includes(query.toLowerCase());
      const okStatus = !statusFilter || p.status === statusFilter;
      const okArchive = tab === "archive" ? !!p.is_archived : !p.is_archived;
      const okTab =
        tab === "unassigned"
          ? !p.assigned_to
          : tab !== "mine" ||
            profile?.role !== "manager" ||
            p.assigned_to === session?.user?.id;
      return okQuery && okStatus && okArchive && okTab;
    });
  }, [projects, query, statusFilter, tab, profile, session]);

  const stats = useMemo(
    () => ({
      total: activeProjects.length,
      field: activeProjects.filter((p) => p.status === "בעבודה בשטח").length,
      gpr: activeProjects.filter((p) => p.status === "נדרש GPR").length,
      done: activeProjects.filter((p) => p.status === "הושלם").length,
      unassigned: activeProjects.filter((p) => !p.assigned_to).length,
      archived: archivedProjects.length,
      openTasks: activeProjects.reduce(
        (sum, p) =>
          sum + (p.project_tasks || []).filter((t) => !t.is_done).length,
        0,
      ),
      activeWork: activeProjects.reduce(
        (sum, p) =>
          sum + (p.work_sessions || []).filter((w) => !w.ended_at).length,
        0,
      ),
      exceptions: buildProjectExceptions(activeProjects).length,
    }),
    [activeProjects, archivedProjects],
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const tabTitle =
    tab === "mine"
      ? "הפרויקטים שלי"
      : tab === "all"
        ? "כל הפרויקטים"
        : tab === "assignments"
          ? "פרויקטים משויכים"
          : tab === "today"
            ? "היום בשטח"
            : tab === "projectStatus"
              ? "דו״ח מצב פרויקטים"
            : tab === "unassigned"
              ? "פרויקטים ללא שיוך"
          : tab === "archive"
            ? "ארכיון פרויקטים"
            : tab === "exceptions"
              ? "דוח חריגות"
              : tab === "new"
                ? "הוספת פרויקט"
                : tab === "history"
                  ? "היסטוריית שינויים"
                  : tab === "report"
                    ? "דוח שעות עובדים"
                    : "התראות";
  const tabSubtitle = isManager
    ? "תצוגת ניהול מלאה לפרויקטים, משימות, עובדים והתראות"
    : isDrafter
      ? "תצוגת שרטט לפרויקטים שעברו לשרטוט ושליחה להגהה"
      : "תצוגת עובד שטח לפרויקטים, שעות עבודה ומשימות";

  if (!envReady) return <SetupScreen />;

  if (!session) {
    return (
      <main className="login">
        <section className="card">
          <img src="/logo.png" alt="לוגו" />
          <h1>מערכת איתור תשתיות</h1>
          <p className="muted">
            כניסה מאובטחת עם מייל וסיסמה לעובדי שטח ומנהלים
          </p>
          <div className="form" style={{ marginTop: 22, textAlign: "right" }}>
            <label>
              מייל ארגוני
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              סיסמה
              <input
                type="password"
                placeholder="לפחות 6 תווים"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              שם מלא להרשמה ראשונית
              <input
                placeholder="שם העובד, אופציונלי"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
            <button onClick={login}>כניסה למערכת</button>
            <button className="secondary" onClick={signup}>
              הרשמה ראשונית עם סיסמה
            </button>
            <p className="muted">
              למניעת מגבלת מיילים: מומלץ שהמנהל ייצור עובדים דרך Supabase
              Authentication עם סיסמה קבועה, ואז העובד פשוט נכנס כאן.
            </p>
            {message && <p className="muted">{message}</p>}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="לוגו" />
          <div>
            <h1>מערכת איתור תשתיות</h1>
            <p>מעקב פרויקטים לעובדי שטח, שרטוט, GPR והיתרים</p>
          </div>
        </div>
        <div className="userRow">
          <div className="notificationWrap">
            <button
              className={`notificationBell ${notificationsOpen ? "active" : ""}`}
              onClick={() => setNotificationsOpen((open) => !open)}
              title="התראות"
            >
              <Bell size={18} />
              {unreadCount > 0 && <span>{unreadCount}</span>}
            </button>
            {notificationsOpen && (
              <NotificationsPopover
                notifications={notifications}
                unreadCount={unreadCount}
                markRead={markNotificationRead}
                markAllRead={markAllNotificationsRead}
                close={() => setNotificationsOpen(false)}
                openFullPage={() => {
                  setTab("notifications");
                  setNotificationsOpen(false);
                }}
              />
            )}
          </div>
          <div className="avatar">{profile?.full_name?.[0] || "ע"}</div>
          <div>
            <b>{profile?.full_name || session?.user?.email}</b>
            <p className="muted">
              {profile ? roleLabel[profile.role] : "משתמש"}
            </p>
          </div>
          <button className="secondary" onClick={logout}>
            <LogOut size={16} /> יציאה
          </button>
        </div>
      </header>

      <section className="container layout">
        <aside className="sidebar">
          <div className="logoBox">
            <img src="/logo.png" alt="לוגו" />
            <b>
              תשתיות
              <br />
              מתקדמות
            </b>
          </div>
          <button
            className={`navBtn ${tab === "mine" ? "active" : ""}`}
            onClick={() => setTab("mine")}
          >
            <span>הפרויקטים שלי</span>
            <FolderKanban size={18} />
          </button>
          {isManager && (
            <button
              className={`navBtn ${tab === "all" ? "active" : ""}`}
              onClick={() => setTab("all")}
            >
              <span>כל הפרויקטים</span>
              <Users size={18} />
            </button>
          )}
          {isManager && (
            <button
              className={`navBtn ${tab === "assignments" ? "active" : ""}`}
              onClick={() => setTab("assignments")}
            >
              <span>פרויקטים משויכים</span>
              <FolderKanban size={18} />
            </button>
          )}
          {isManager && (
            <button
              className={`navBtn ${tab === "today" ? "active" : ""}`}
              onClick={() => setTab("today")}
            >
              <span>היום בשטח</span>
              <Clock size={18} />
            </button>
          )}
          {isManager && (
            <button
              className={`navBtn ${tab === "projectStatus" ? "active" : ""}`}
              onClick={() => setTab("projectStatus")}
            >
              <span>דו״ח מצב פרויקטים</span>
              <FileText size={18} />
            </button>
          )}
          {isManager && (
            <button
              className={`navBtn ${tab === "unassigned" ? "active" : ""}`}
              onClick={() => setTab("unassigned")}
            >
              <span>ללא שיוך ({stats.unassigned})</span>
              <FolderKanban size={18} />
            </button>
          )}
          {isManager && (
            <button
              className={`navBtn ${tab === "archive" ? "active" : ""}`}
              onClick={() => setTab("archive")}
            >
              <span>ארכיון ({stats.archived})</span>
              <Archive size={18} />
            </button>
          )}
          {isManager && (
            <button
              className={`navBtn ${tab === "exceptions" ? "active" : ""}`}
              onClick={() => setTab("exceptions")}
            >
              <span>דוח חריגות ({stats.exceptions})</span>
              <AlertTriangle size={18} />
            </button>
          )}
          {isManager && (
            <button
              className={`navBtn ${tab === "new" ? "active" : ""}`}
              onClick={() => setTab("new")}
            >
              <span>הוספת פרויקט</span>
              <FilePlus2 size={18} />
            </button>
          )}
          <button
            className={`navBtn ${tab === "history" ? "active" : ""}`}
            onClick={() => setTab("history")}
          >
            <span>היסטוריית שינויים</span>
            <History size={18} />
          </button>
          <button
            className={`navBtn ${tab === "notifications" ? "active" : ""}`}
            onClick={() => setTab("notifications")}
          >
            <span>התראות {unreadCount > 0 ? `(${unreadCount})` : ""}</span>
            <Bell size={18} />
          </button>
          {isManager && (
            <button
              className={`navBtn ${tab === "report" ? "active" : ""}`}
              onClick={() => setTab("report")}
            >
              <span>דוח שעות עובדים</span>
              <Download size={18} />
            </button>
          )}
          <p
            style={{
              marginTop: 30,
              color: "rgba(255,255,255,.72)",
              lineHeight: 1.7,
            }}
          >
            מותאם לאייפון, אנדרואיד ומחשב. עדכונים בזמן אמת דרך Supabase.
          </p>
        </aside>

        <section className="mainContent">
          {tab !== "projectStatus" && <div className="dashboardHero">
            <div>
              <span className="eyebrow">MAYA TASKS</span>
              <h2>{tabTitle}</h2>
              <p>{tabSubtitle}</p>
            </div>
            <div className="heroChips">
              <span>התראות חדשות: {unreadCount}</span>
              {isManager && <span>פרויקטים ללא שיוך: {stats.unassigned}</span>}
              {isManager && <span>בארכיון: {stats.archived}</span>}
              <span>עבודות פעילות: {stats.activeWork}</span>
            </div>
          </div>}

          {tab !== "projectStatus" && <div className="grid">
            <Stat
              number={stats.total}
              label="סה״כ פרויקטים"
              icon={<FolderKanban />}
            />
            <Stat number={stats.field} label="בעבודה בשטח" icon={<Clock />} />
            <Stat number={stats.gpr} label="נדרש GPR" icon={<Shield />} />
            <Stat number={stats.done} label="הושלמו" icon={<CheckCircle />} />
            {isManager && (
              <Stat
                number={stats.unassigned}
                label="ללא שיוך"
                icon={<Users />}
              />
            )}
            {isManager && (
              <Stat
                number={stats.archived}
                label="בארכיון"
                icon={<Archive />}
              />
            )}
            {isManager && (
              <Stat
                number={stats.exceptions}
                label="חריגות לטיפול"
                icon={<AlertTriangle />}
              />
            )}
            <Stat
              number={stats.openTasks}
              label="משימות פתוחות"
              icon={<PlusCircle />}
            />
          </div>}

          {message && (
            <div className="appToast" role="status" aria-live="polite">
              <span className="appToastIcon"><CheckCircle size={18} /></span>
              <p>{message}</p>
              <button
                className="appToastClose"
                onClick={() => setMessage("")}
                aria-label="סגירת הודעה"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {tab === "today" && isManager && (
            <TodayFieldPanel projects={activeProjects} workSessions={workSessions} workers={workers} />
          )}
          {tab === "projectStatus" && isManager && (
            <ProjectStatusReport projects={projects} />
          )}
          {tab === "assignments" && isManager && (
            <WorkerAssignmentsPanel projects={projects} workers={workers} />
          )}
          {tab === "new" && isManager && (
            <NewProjectForm
              project={newProject}
              setProject={setNewProject}
              workers={workers}
              createProject={createProject}
            />
          )}
          {tab === "history" && (
            <HistoryPanel historyItems={historyItems} projects={projects} />
          )}
          {tab === "notifications" && (
            <NotificationsPanel
              notifications={notifications}
              markRead={markNotificationRead}
              markAllRead={markAllNotificationsRead}
            />
          )}
          {tab === "exceptions" && isManager && (
            <ExceptionsPanel projects={projects} />
          )}
          {tab === "report" && isManager && (
            <WorkReportPanel
              workSessions={workSessions}
              workers={workers}
              reportWorkerId={reportWorkerId}
              setReportWorkerId={setReportWorkerId}
              reportMonth={reportMonth}
              setReportMonth={setReportMonth}
              reportFromDate={reportFromDate}
              setReportFromDate={setReportFromDate}
              reportToDate={reportToDate}
              setReportToDate={setReportToDate}
              exportWorkReport={exportWorkReport}
            />
          )}
          {tab !== "new" &&
            tab !== "today" &&
            tab !== "projectStatus" &&
            tab !== "assignments" &&
            tab !== "history" &&
            tab !== "report" &&
            tab !== "notifications" &&
            tab !== "exceptions" && (
              <section className="card">
                <div className="toolbar">
                  <div style={{ minWidth: 260, flex: 1 }}>
                    <input
                      placeholder="חיפוש לפי שם, לקוח או מיקום..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ maxWidth: 220 }}
                  >
                    <option value="">כל הסטטוסים</option>
                    {appStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button className="ghost">
                    <Search size={16} /> סינון
                  </button>
                </div>
                <h2>
                  {tab === "unassigned"
                    ? "פרויקטים ללא שיוך"
                    : tab === "archive"
                      ? "ארכיון פרויקטים"
                      : tab === "mine" && !isManager
                        ? "הפרויקטים שלי"
                        : "כל הפרויקטים"}
                </h2>
                <div className="projects">
                  {visibleProjects.length === 0 && (
                    <div className="empty">אין פרויקטים להצגה כרגע</div>
                  )}
                  {visibleProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      historyItems={historyItems
                        .filter((h) => h.project_id === project.id)
                        .slice(0, 4)}
                      updateStatus={updateStatus}
                      uploadPhoto={uploadPhoto}
                      isManager={isManager}
                      isDrafter={isDrafter}
                      workers={workers}
                      saveProject={saveProject}
                      deleteProject={deleteProject}
                      archiveProject={archiveProject}
                      restoreProject={restoreProject}
                      currentUserId={session?.user?.id}
                      startWork={startWork}
                      endWork={endWork}
                      addProjectTask={addProjectTask}
                      toggleProjectTask={toggleProjectTask}
                      deleteProjectTask={deleteProjectTask}
                      sendProjectToReview={sendProjectToReview}
                      deleteProjectReviewFile={deleteProjectReviewFile}
                    />
                  ))}
                </div>
              </section>
            )}
        </section>
      </section>
    </main>
  );
}

function translateAuthError(message: string) {
  if (message.toLowerCase().includes("invalid login credentials"))
    return "מייל או סיסמה לא נכונים.";
  if (message.toLowerCase().includes("email not confirmed"))
    return "המייל עדיין לא מאושר. אשר את המשתמש ב-Supabase תחת Authentication > Users.";
  if (message.toLowerCase().includes("password")) return message;
  return message;
}

function Stat({
  number,
  label,
  icon,
}: {
  number: number;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="stat">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong>{number}</strong>
        {icon}
      </div>
      <span>{label}</span>
    </div>
  );
}

function NewProjectForm({
  project,
  setProject,
  workers,
  createProject,
}: {
  project: NewProject;
  setProject: (p: NewProject) => void;
  workers: Profile[];
  createProject: () => void;
}) {
  return (
    <section className="card form">
      <h2>הוספת פרויקט חדש</h2>
      <div className="formGrid">
        <label>
          שם פרויקט
          <input
            value={project.name}
            onChange={(e) => setProject({ ...project, name: e.target.value })}
            placeholder="לדוגמה: כביש 531 - קטע צפוני"
          />
        </label>
        <label>
          לקוח
          <input
            value={project.client_name}
            onChange={(e) =>
              setProject({ ...project, client_name: e.target.value })
            }
            placeholder="לדוגמה: עיריית הרצליה"
          />
        </label>
        <label>
          מיקום
          <input
            value={project.location}
            onChange={(e) =>
              setProject({ ...project, location: e.target.value })
            }
            placeholder="עיר / רחוב / אזור"
          />
        </label>
        <label>
          טלפון איש קשר בשטח
          <input
            type="tel"
            dir="ltr"
            value={project.contact_phone}
            onChange={(e) =>
              setProject({ ...project, contact_phone: e.target.value })
            }
            placeholder="לדוגמה: 050-1234567"
          />
        </label>
        <label>
          שיוך לעובד שטח, אופציונלי
          <select
            value={project.assigned_to}
            onChange={(e) =>
              setProject({ ...project, assigned_to: e.target.value })
            }
          >
            <option value="">ללא שיוך כרגע</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.full_name} - {w.email}
              </option>
            ))}
          </select>
        </label>
        <label className="wideField">
          עובדים נוספים בפרויקט, אופציונלי
          <div className="workerChecks">
            {workers.map((w) => (
              <label key={w.id} className="checkLine">
                <input
                  type="checkbox"
                  checked={project.assigned_workers.includes(w.id)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? Array.from(new Set([...project.assigned_workers, w.id]))
                      : project.assigned_workers.filter((id) => id !== w.id);
                    setProject({ ...project, assigned_workers: next });
                  }}
                />
                {w.full_name} - {w.email}
              </label>
            ))}
          </div>
        </label>
        <label>
          תאריך יעד
          <input
            type="date"
            value={project.due_date}
            onChange={(e) =>
              setProject({ ...project, due_date: e.target.value })
            }
          />
        </label>
      </div>
      <label>
        תיאור העבודה
        <textarea
          value={project.description}
          onChange={(e) =>
            setProject({ ...project, description: e.target.value })
          }
          placeholder="פירוט איתור תשתיות, דרישות לקוח, חסמים וכו׳"
        />
      </label>
      <button onClick={createProject}>צור פרויקט</button>
    </section>
  );
}

function ProjectCard({
  project,
  historyItems,
  updateStatus,
  uploadPhoto,
  isManager,
  isDrafter,
  workers,
  saveProject,
  deleteProject,
  archiveProject,
  restoreProject,
  currentUserId,
  startWork,
  endWork,
  addProjectTask,
  toggleProjectTask,
  deleteProjectTask,
  sendProjectToReview,
  deleteProjectReviewFile,
}: {
  project: Project;
  historyItems: StatusHistory[];
  updateStatus: (p: Project, s: string, n: string) => void;
  uploadPhoto: (projectId: string, file: File, category?: string) => void;
  isManager: boolean;
  isDrafter: boolean;
  workers: Profile[];
  saveProject: (projectId: string, changes: NewProject) => void;
  deleteProject: (project: Project) => void;
  archiveProject: (project: Project) => void;
  restoreProject: (project: Project) => void;
  currentUserId?: string;
  startWork: (project: Project) => void;
  endWork: (project: Project) => void;
  addProjectTask: (
    projectId: string,
    title: string,
    description: string,
  ) => void;
  toggleProjectTask: (task: ProjectTask, project: Project) => void;
  deleteProjectTask: (task: ProjectTask) => void;
  sendProjectToReview: (project: Project, file: File, note: string) => void;
  deleteProjectReviewFile: (file: ProjectReviewFile, projectId: string) => void;
}) {
  const [status, setStatus] = useState(project.status);
  const [note, setNote] = useState("");
  const [photoCategory, setPhotoCategory] = useState(photoCategories[0]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [reviewFile, setReviewFile] = useState<File | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editProject, setEditProject] = useState<NewProject>({
    name: project.name,
    client_name: project.client_name || "",
    location: project.location,
    contact_phone: project.contact_phone || "",
    description: project.description || "",
    assigned_to: project.assigned_to || "",
    assigned_workers: (project.project_workers || []).map((w) => w.worker_id),
    due_date: project.due_date || "",
  });
  useEffect(() => {
    setStatus(project.status);
    setEditProject({
      name: project.name,
      client_name: project.client_name || "",
      location: project.location,
      contact_phone: project.contact_phone || "",
      description: project.description || "",
      assigned_to: project.assigned_to || "",
      assigned_workers: (project.project_workers || []).map((w) => w.worker_id),
      due_date: project.due_date || "",
    });
    setReviewFile(null);
    setReviewNote("");
  }, [project]);

  const myOpenSession = project.work_sessions?.find(
    (w) => w.worker_id === currentUserId && !w.ended_at,
  );
  const lastEndedSession = project.work_sessions
    ?.filter((w) => w.worker_id === currentUserId && w.ended_at)
    .sort(
      (a, b) =>
        new Date(b.ended_at || "").getTime() -
        new Date(a.ended_at || "").getTime(),
    )[0];
  const isReviewSent = project.status === reviewStatus;

  const editModal = editing ? (
    <div
      className="modalBackdrop"
      role="dialog"
      aria-modal="true"
      onClick={() => setEditing(false)}
    >
      <div className="editModal" onClick={(e) => e.stopPropagation()}>
        <div className="editHeader modalHeader">
          <div>
            <h3>עריכת פרויקט</h3>
            <p className="muted">עדכון פרטי הפרויקט, שיוך עובד ותאריך יעד.</p>
          </div>
          <button
            className="ghost smallBtn iconBtn"
            onClick={() => setEditing(false)}
            aria-label="סגור"
          >
            <X size={18} />
          </button>
        </div>
        <div className="formGrid editGrid">
          <label>
            שם פרויקט
            <input
              value={editProject.name}
              onChange={(e) =>
                setEditProject({ ...editProject, name: e.target.value })
              }
            />
          </label>
          <label>
            לקוח
            <input
              value={editProject.client_name}
              onChange={(e) =>
                setEditProject({ ...editProject, client_name: e.target.value })
              }
            />
          </label>
          <label>
            מיקום
            <input
              value={editProject.location}
              onChange={(e) =>
                setEditProject({ ...editProject, location: e.target.value })
              }
            />
          </label>
          <label>
            טלפון איש קשר בשטח
            <input
              type="tel"
              dir="ltr"
              value={editProject.contact_phone}
              onChange={(e) =>
                setEditProject({ ...editProject, contact_phone: e.target.value })
              }
              placeholder="050-1234567"
            />
          </label>
          <label>
            שיוך לעובד
            <select
              value={editProject.assigned_to}
              onChange={(e) =>
                setEditProject({ ...editProject, assigned_to: e.target.value })
              }
            >
              <option value="">לא משויך</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name} - {w.email}
                </option>
              ))}
            </select>
          </label>
          <label className="wideField">
            עובדים נוספים בפרויקט
            <div className="workerChecks compactChecks">
              {workers.map((w) => (
                <label key={w.id} className="checkLine">
                  <input
                    type="checkbox"
                    checked={editProject.assigned_workers.includes(w.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? Array.from(new Set([...editProject.assigned_workers, w.id]))
                        : editProject.assigned_workers.filter((id) => id !== w.id);
                      setEditProject({ ...editProject, assigned_workers: next });
                    }}
                  />
                  {w.full_name} - {w.email}
                </label>
              ))}
            </div>
          </label>
          <label>
            תאריך יעד
            <input
              type="date"
              value={editProject.due_date}
              onChange={(e) =>
                setEditProject({ ...editProject, due_date: e.target.value })
              }
            />
          </label>
        </div>
        <label>
          תיאור
          <textarea
            className="modalTextarea"
            value={editProject.description}
            onChange={(e) =>
              setEditProject({ ...editProject, description: e.target.value })
            }
          />
        </label>
        <div className="modalActions">
          <button
            onClick={() => {
              saveProject(project.id, editProject);
              setEditing(false);
            }}
          >
            שמור שינויים
          </button>
          <button className="ghost" onClick={() => setEditing(false)}>
            ביטול
          </button>
          {project.is_archived ? (
            <button
              className="ghost"
              onClick={() => {
                restoreProject(project);
                setEditing(false);
              }}
            >
              <RotateCcw size={16} /> שחזור מהארכיון
            </button>
          ) : (
            <button
              className="ghost"
              onClick={() => {
                archiveProject(project);
                setEditing(false);
              }}
            >
              <Archive size={16} /> העבר לארכיון
            </button>
          )}
          <button
            className="danger ghost"
            onClick={() => deleteProject(project)}
          >
            <Trash2 size={16} /> מחיקת פרויקט
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>

      <style jsx>{`
        @media (max-width: 720px) {
          .projectCompactHeader > div {
            grid-template-columns: auto minmax(0, 1fr) !important;
            gap: 10px !important;
            padding: 14px 12px !important;
          }
          .projectCompactHeader .pill,
          .projectCompactHeader .archiveBadge {
            justify-self: start;
          }
          .projectCompactHeader > div > span:nth-child(3),
          .projectCompactHeader > div > span:nth-child(4),
          .projectCompactHeader > div > span:nth-child(5) {
            grid-column: 2;
            white-space: normal !important;
            font-size: 13px;
          }
          .projectCompactHeader .title {
            font-size: 18px !important;
          }
          .projectExpandedBody {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 14px !important;
            overflow: visible !important;
          }
          .projectExpandedBody > * {
            min-width: 0 !important;
            max-width: 100% !important;
          }
          .projectExpandedBody .actionsRow,
          .projectExpandedBody .cardActions,
          .projectExpandedBody .photoUploadBox,
          .projectExpandedBody .taskActions {
            flex-wrap: wrap !important;
          }
          .projectExpandedBody input,
          .projectExpandedBody select,
          .projectExpandedBody textarea,
          .projectExpandedBody button {
            max-width: 100%;
          }
        }
      `}</style>
      <article
        className={`project status-${getStatusClass(project.status)} ${detailsOpen ? "project-open" : "project-closed"}`}
        style={
          isReviewSent
            ? { background: "#fff1f2", borderColor: "#fecdd3", boxShadow: "0 16px 40px rgba(190, 18, 60, .10)" }
            : undefined
        }
      >
        <button
          type="button"
          className="projectCompactHeader"
          onClick={() => setDetailsOpen((open) => !open)}
          aria-expanded={detailsOpen}
          style={{
            gridColumn: "1 / -1",
            width: "100%",
            border: 0,
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            textAlign: "right",
            color: "inherit",
            display: "block",
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto minmax(0, 1fr) auto auto auto",
              gap: 14,
              alignItems: "center",
              width: "100%",
              minHeight: 0,
              padding: "14px 16px",
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#eef6ff",
                color: "#0b376d",
                transform: detailsOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform .2s ease",
              }}
            >
              <ChevronDown size={18} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="title" style={{ display: "block", marginBottom: 6, fontSize: 20, lineHeight: 1.25, overflowWrap: "anywhere" }}>
                {project.name}{" "}
                {project.is_archived && <span className="archiveBadge">בארכיון</span>}
              </span>
              <span className="muted" style={{ display: "block", fontSize: 14, lineHeight: 1.5, overflowWrap: "anywhere" }}>
                מספר הזמנה / לקוח: {project.client_name || "לא הוגדר"} · {project.location}
              </span>
            </span>
            <StatusPill status={project.status} />
            <span className="muted" style={{ whiteSpace: "nowrap", fontWeight: 700 }}>
              {project.progress}% התקדמות
            </span>
            <span className="muted" style={{ whiteSpace: "nowrap", fontWeight: 700 }}>
              יעד: {project.due_date ? new Date(project.due_date).toLocaleDateString("he-IL") : "לא הוגדר"}
            </span>
          </div>
        </button>

        {detailsOpen && (
          <div
            className="projectExpandedBody"
            style={{
              gridColumn: "1 / -1",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
              width: "100%",
              maxWidth: "100%",
              overflow: "hidden",
              marginTop: 14,
              alignItems: "start",
            }}
          >
        <div>
          <div className="title">
            {project.name}{" "}
            {project.is_archived && (
              <span className="archiveBadge">בארכיון</span>
            )}
          </div>
          <div className="muted">
            {project.client_name || "ללא לקוח"} ·{" "}
            {project.description || "אין תיאור"}
          </div>
          <div className="muted">
            עובד אחראי: {project.profiles?.full_name || "לא משויך"}
          </div>
          {!!project.project_workers?.length && (
            <div className="muted">
              עובדים נוספים: {project.project_workers.map((w) => w.profiles?.full_name || "עובד").join(", ")}
            </div>
          )}
          {isManager && (
            <div className="actionsRow cardActions">
              <button
                className="ghost smallBtn"
                onClick={() => setEditing(true)}
              >
                <Pencil size={16} /> עריכה
              </button>
              {project.is_archived ? (
                <button
                  className="ghost smallBtn"
                  onClick={() => restoreProject(project)}
                >
                  <RotateCcw size={16} /> שחזור
                </button>
              ) : (
                <button
                  className="ghost smallBtn"
                  onClick={() => archiveProject(project)}
                >
                  <Archive size={16} /> העבר לארכיון
                </button>
              )}
              <button
                className="danger ghost smallBtn"
                onClick={() => deleteProject(project)}
              >
                <Trash2 size={16} /> מחיקה
              </button>
              <button
                className="ghost smallBtn"
                onClick={() => exportProjectPdf(project, historyItems)}
              >
                <FileText size={16} /> דוח PDF
              </button>
            </div>
          )}
        </div>
        <div>
          <StatusPill status={project.status} />
          <div className="muted" style={{ marginTop: 10 }}>
            {project.location}
          </div>
          {project.contact_phone && (
            <a
              className="phoneLink"
              href={`tel:${project.contact_phone.replace(/[^0-9+]/g, "")}`}
              title="התקשר לאיש קשר בשטח"
            >
              <Phone size={15} /> {project.contact_phone}
            </a>
          )}
          <div className="muted">
            עודכן: {new Date(project.updated_at).toLocaleDateString("he-IL")}
          </div>
        </div>
        <div>
          <b>{project.progress}% התקדמות</b>
          <div className="progress">
            <i style={{ width: `${project.progress}%` }} />
          </div>
          <div className="muted">
            יעד:{" "}
            {project.due_date
              ? new Date(project.due_date).toLocaleDateString("he-IL")
              : "לא הוגדר"}
          </div>
          <PhotoGallery photos={project.project_photos || []} />
        </div>
        <div className="form">
          <div className="timeBox">
            {myOpenSession ? (
              <>
                <div>
                  <b>עבודה פעילה</b>
                  <br />
                  <span className="muted">
                    התחלה:{" "}
                    {new Date(myOpenSession.started_at).toLocaleString("he-IL")}
                  </span>
                  <LocationLine
                    label="מיקום התחלה"
                    lat={myOpenSession.started_lat}
                    lng={myOpenSession.started_lng}
                    accuracy={myOpenSession.started_accuracy}
                  />
                </div>
                <button
                  className="smallBtn danger"
                  onClick={() => endWork(project)}
                >
                  <Square size={15} /> סיים עבודה
                </button>
              </>
            ) : (
              <>
                <div>
                  <b>שעות עבודה</b>
                  <br />
                  <span className="muted">
                    {lastEndedSession
                      ? `סיום אחרון: ${new Date(lastEndedSession.ended_at || "").toLocaleString("he-IL")}`
                      : "לא נרשמה עבודה פתוחה"}
                  </span>
                  {lastEndedSession && (
                    <LocationLine
                      label="מיקום סיום אחרון"
                      lat={lastEndedSession.ended_lat}
                      lng={lastEndedSession.ended_lng}
                      accuracy={lastEndedSession.ended_accuracy}
                    />
                  )}
                </div>
                <button className="smallBtn" onClick={() => startWork(project)}>
                  <PlayCircle size={15} /> התחל עבודה
                </button>
              </>
            )}
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {appStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="הערה לעדכון, אופציונלי"
          />
          <button
            className="smallBtn"
            onClick={() => {
              updateStatus(project, status, note);
              setNote("");
            }}
          >
            עדכן סטטוס
          </button>
          <div className="photoUploadBox">
            <select
              value={photoCategory}
              onChange={(e) => setPhotoCategory(e.target.value)}
              title="סוג תמונה"
            >
              {photoCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <label
              className="smallBtn secondary"
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Camera size={16} /> העלאת תמונה
              <input
                className="photoInput"
                style={{ display: "none" }}
                type="file"
                accept="image/*"
                onChange={(e) =>
                  e.target.files?.[0] &&
                  uploadPhoto(project.id, e.target.files[0], photoCategory)
                }
              />
            </label>
          </div>
        </div>

        <ReviewFilesPanel
          files={project.project_review_files || []}
          canDelete={isManager || isDrafter}
          onDelete={(file) => deleteProjectReviewFile(file, project.id)}
        />
        {(isDrafter || isManager) && project.status === "עבר לשרטוט" && (
          <DrafterReviewBox
            reviewFile={reviewFile}
            setReviewFile={setReviewFile}
            reviewNote={reviewNote}
            setReviewNote={setReviewNote}
            onSend={() => {
              if (!reviewFile) {
                return;
              }
              sendProjectToReview(project, reviewFile, reviewNote);
              setReviewFile(null);
              setReviewNote("");
            }}
          />
        )}
        <TaskPanel
          tasks={project.project_tasks || []}
          isManager={isManager}
          canCompleteTasks={
            isManager ||
            project.assigned_to === currentUserId ||
            !!project.project_workers?.some((w) => w.worker_id === currentUserId)
          }
          showTaskForm={showTaskForm}
          setShowTaskForm={setShowTaskForm}
          taskTitle={taskTitle}
          setTaskTitle={setTaskTitle}
          taskDescription={taskDescription}
          setTaskDescription={setTaskDescription}
          onAdd={() => {
            addProjectTask(project.id, taskTitle, taskDescription);
            setTaskTitle("");
            setTaskDescription("");
            setShowTaskForm(false);
          }}
          onToggle={(task) => toggleProjectTask(task, project)}
          onDelete={deleteProjectTask}
        />
        <div
          className={`history collapsibleHistory ${historyOpen ? "open" : ""}`}
        >
          <button
            className="historyToggle"
            onClick={() => setHistoryOpen(!historyOpen)}
            aria-expanded={historyOpen}
          >
            <span>
              <b>עדכונים אחרונים</b>
              <small>
                {historyItems.length === 0
                  ? "אין עדכונים"
                  : `${historyItems.length} עדכונים`}
              </small>
            </span>
            <ChevronDown className="historyChevron" size={18} />
          </button>
          {historyOpen && (
            <div className="historyList">
              {historyItems.length === 0 && (
                <div className="muted">אין עדכונים עדיין</div>
              )}
              {historyItems.map((h) => (
                <div className="historyItem" key={h.id}>
                  • {h.new_status}
                  <br />
                  <span>
                    {h.profiles?.full_name || "משתמש"} ·{" "}
                    {new Date(h.created_at).toLocaleString("he-IL")}
                  </span>
                  {h.note && (
                    <>
                      <br />
                      <span>{h.note}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
          </div>
        )}
      </article>
      {editModal}
    </>
  );
}


function DrafterReviewBox({
  reviewFile,
  setReviewFile,
  reviewNote,
  setReviewNote,
  onSend,
}: {
  reviewFile: File | null;
  setReviewFile: (file: File | null) => void;
  reviewNote: string;
  setReviewNote: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div
      className="reviewBox"
      style={{
        border: "1px solid #fecdd3",
        background: "#fff7f7",
        borderRadius: 18,
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <b>שליחה להגהה</b>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          העלה PDF ושלח התראה לעובדי השטח, למנהלים ולשרטטים.
        </p>
      </div>
      <label>
        קובץ PDF להגהה
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setReviewFile(e.target.files?.[0] || null)}
        />
      </label>
      {reviewFile && <span className="muted">נבחר: {reviewFile.name}</span>}
      <textarea
        value={reviewNote}
        onChange={(e) => setReviewNote(e.target.value)}
        placeholder="הערה לעובדי השטח, אופציונלי"
      />
      <button className="smallBtn danger" onClick={onSend} disabled={!reviewFile}>
        שלח להגהה
      </button>
    </div>
  );
}

function ReviewFilesPanel({
  files,
  canDelete,
  onDelete,
}: {
  files: ProjectReviewFile[];
  canDelete: boolean;
  onDelete: (file: ProjectReviewFile) => void;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadUrls() {
      const next: Record<string, string> = {};
      for (const file of files) {
        const { data } = await supabase.storage
          .from("project-review-files")
          .createSignedUrl(file.file_path, 60 * 60);
        if (data?.signedUrl) next[file.id] = data.signedUrl;
      }
      if (!cancelled) setUrls(next);
    }
    loadUrls();
    return () => {
      cancelled = true;
    };
  }, [files]);

  if (!files.length) return null;
  return (
    <div className="tasksBox reviewFilesBox">
      <div className="tasksHeader">
        <b>קבצי הגהה</b>
        <span className="muted">{files.length} קבצים</span>
      </div>
      {files.map((file) => (
        <div className="taskItem" key={file.id}>
          <div>
            <b>{file.file_name || "קובץ PDF"}</b>
            <p className="muted">
              הועלה על ידי {file.profiles?.full_name || "שרטט"} · {new Date(file.created_at).toLocaleString("he-IL")}
            </p>
          </div>
          <div className="taskActions">
            {urls[file.id] && (
              <a className="ghost tinyBtn" href={urls[file.id]} target="_blank" rel="noreferrer">
                פתיחת PDF
              </a>
            )}
            {canDelete && (
              <button className="danger ghost tinyBtn" onClick={() => onDelete(file)}>
                מחיקת PDF
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskPanel({
  tasks,
  isManager,
  canCompleteTasks,
  showTaskForm,
  setShowTaskForm,
  taskTitle,
  setTaskTitle,
  taskDescription,
  setTaskDescription,
  onAdd,
  onToggle,
  onDelete,
}: {
  tasks: ProjectTask[];
  isManager: boolean;
  canCompleteTasks: boolean;
  showTaskForm: boolean;
  setShowTaskForm: (value: boolean) => void;
  taskTitle: string;
  setTaskTitle: (value: string) => void;
  taskDescription: string;
  setTaskDescription: (value: string) => void;
  onAdd: () => void;
  onToggle: (task: ProjectTask) => void;
  onDelete: (task: ProjectTask) => void;
}) {
  const sortedTasks = [...tasks].sort(
    (a, b) =>
      Number(a.is_done) - Number(b.is_done) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="tasksBox">
      <div className="tasksHeader">
        <b>משימות</b>
        {isManager && (
          <button
            className="ghost tinyBtn"
            onClick={() => setShowTaskForm(!showTaskForm)}
          >
            <PlusCircle size={15} /> משימה
          </button>
        )}
      </div>
      {showTaskForm && isManager && (
        <div className="taskForm">
          <input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="כותרת משימה"
          />
          <textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="פירוט המשימה, אופציונלי"
          />
          <div className="actionsRow">
            <button className="smallBtn" onClick={onAdd}>
              הוסף משימה
            </button>
            <button
              className="ghost smallBtn"
              onClick={() => setShowTaskForm(false)}
            >
              ביטול
            </button>
          </div>
        </div>
      )}
      {sortedTasks.length === 0 && (
        <div className="muted taskEmpty">אין משימות בפרויקט</div>
      )}
      {sortedTasks.map((task) => (
        <div
          className={`taskItem ${task.is_done ? "doneTask" : ""}`}
          key={task.id}
        >
          <div>
            <b>{task.title}</b>
            {task.description && <p className="muted">{task.description}</p>}
            <span className="muted">
              נוצר על ידי {task.profiles?.full_name || "מנהל"} ·{" "}
              {new Date(task.created_at).toLocaleDateString("he-IL")}
            </span>
          </div>
          {canCompleteTasks && (
            <div className="taskActions">
              <button className="ghost tinyBtn" onClick={() => onToggle(task)}>
                {task.is_done ? "פתח" : "בוצע"}
              </button>
              {isManager && (
                <button
                  className="danger ghost tinyBtn"
                  onClick={() => onDelete(task)}
                >
                  מחיקה
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PhotoGallery({ photos }: { photos: ProjectPhoto[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadUrls() {
      const next: Record<string, string> = {};
      for (const photo of photos) {
        const { data } = await supabase.storage
          .from("project-photos")
          .createSignedUrl(photo.file_path, 60 * 60);
        if (data?.signedUrl) next[photo.id] = data.signedUrl;
      }
      if (!cancelled) setUrls(next);
    }
    loadUrls();
    return () => {
      cancelled = true;
    };
  }, [photos]);

  if (!photos.length)
    return <div className="muted photosEmpty">אין תמונות בפרויקט</div>;

  return (
    <div className="photos">
      {photos.slice(0, 6).map((photo) =>
        urls[photo.id] ? (
          <a
            key={photo.id}
            className="photoThumb"
            href={urls[photo.id]}
            target="_blank"
            rel="noreferrer"
          >
            <img src={urls[photo.id]} alt={photo.category || "תמונת שטח"} />
            <span>{photo.category || "תמונת שטח"}</span>
          </a>
        ) : (
          <div key={photo.id} className="photoSkeleton" />
        ),
      )}
    </div>
  );
}

function exportProjectPdf(project: Project, historyItems: StatusHistory[]) {
  const tasks = project.project_tasks || [];
  const photos = project.project_photos || [];
  const reviewFiles = project.project_review_files || [];
  const sessions = project.work_sessions || [];
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>דוח פרויקט - ${escapeHtml(project.name)}</title><style>
    body{font-family:Arial,sans-serif;margin:32px;color:#10213f;direction:rtl}h1{color:#071e41;margin:0 0 8px}.meta{color:#64748b;margin-bottom:24px}.box{border:1px solid #dfe8f2;border-radius:14px;padding:16px;margin:14px 0}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.badge{display:inline-block;border-radius:999px;background:#eef6ff;padding:6px 12px;font-weight:bold}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border-bottom:1px solid #e5edf5;padding:9px;text-align:right;vertical-align:top}th{background:#f3f7fb}@media print{button{display:none}body{margin:18px}}
  </style></head><body><button onclick="window.print()" style="float:left;padding:10px 16px;border:0;border-radius:10px;background:#071e41;color:#fff;font-weight:bold">שמירה / הדפסה ל-PDF</button>
  <h1>דוח פרויקט</h1><div class="meta">הופק בתאריך ${new Date().toLocaleString("he-IL")}</div>
  <div class="box"><h2>${escapeHtml(project.name)}</h2><div class="grid"><div><b>לקוח:</b> ${escapeHtml(project.client_name || "-")}</div><div><b>מיקום:</b> ${escapeHtml(project.location || "-")}</div><div><b>סטטוס:</b> <span class="badge">${escapeHtml(project.status)}</span></div><div><b>עובד אחראי:</b> ${escapeHtml(project.profiles?.full_name || "לא משויך")}</div><div><b>תאריך יעד:</b> ${project.due_date ? new Date(project.due_date).toLocaleDateString("he-IL") : "-"}</div><div><b>התקדמות:</b> ${project.progress}%</div></div><p><b>תיאור:</b> ${escapeHtml(project.description || "-")}</p></div>
  <div class="box"><h2>משימות</h2><table><thead><tr><th>משימה</th><th>סטטוס</th><th>תיאור</th><th>תאריך</th></tr></thead><tbody>${tasks.length ? tasks.map((t) => `<tr><td>${escapeHtml(t.title)}</td><td>${t.is_done ? "בוצע" : "פתוח"}</td><td>${escapeHtml(t.description || "-")}</td><td>${new Date(t.created_at).toLocaleDateString("he-IL")}</td></tr>`).join("") : '<tr><td colspan="4">אין משימות</td></tr>'}</tbody></table></div>
  <div class="box"><h2>שעות עבודה</h2><table><thead><tr><th>התחלה</th><th>סיום</th><th>מיקום התחלה</th><th>מיקום סיום</th></tr></thead><tbody>${sessions.length ? sessions.map((w) => `<tr><td>${new Date(w.started_at).toLocaleString("he-IL")}</td><td>${w.ended_at ? new Date(w.ended_at).toLocaleString("he-IL") : "פתוח"}</td><td>${mapsLink(w.started_lat, w.started_lng) ? `<a href="${mapsLink(w.started_lat, w.started_lng)}">מפה</a>` : "-"}</td><td>${mapsLink(w.ended_lat, w.ended_lng) ? `<a href="${mapsLink(w.ended_lat, w.ended_lng)}">מפה</a>` : "-"}</td></tr>`).join("") : '<tr><td colspan="4">אין שעות עבודה</td></tr>'}</tbody></table></div>
  <div class="box"><h2>תמונות</h2>${photos.length ? `<ul>${photos.map((p) => `<li>${escapeHtml(p.category || "תמונת שטח")} · ${new Date(p.created_at).toLocaleString("he-IL")}</li>`).join("")}</ul>` : "אין תמונות"}</div>
  <div class="box"><h2>קבצי הגהה</h2>${reviewFiles.length ? `<ul>${reviewFiles.map((f) => `<li>${escapeHtml(f.file_name || "קובץ PDF")} · ${new Date(f.created_at).toLocaleString("he-IL")}</li>`).join("")}</ul>` : "אין קבצי הגהה"}</div>
  <div class="box"><h2>עדכונים אחרונים</h2>${historyItems.length ? `<ul>${historyItems.map((h) => `<li><b>${escapeHtml(h.new_status)}</b> · ${new Date(h.created_at).toLocaleString("he-IL")}${h.note ? ` · ${escapeHtml(h.note)}` : ""}</li>`).join("")}</ul>` : "אין עדכונים"}</div>
  </body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function escapeHtml(value: string) {
  return String(value).replace(
    /[&<>'"]/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        ch
      ] || ch,
  );
}

function getStatusClass(status: string) {
  return status === reviewStatus
    ? "review"
    : status === "הושלם"
      ? "done"
    : status === "עבר לשרטוט"
      ? "drafting"
      : status === "נדרש GPR"
        ? "gpr"
        : status === "מחכה להיתרים"
          ? "permits"
          : "field";
}

function StatusPill({ status }: { status: string }) {
  const cls = getStatusClass(status);
  return <span className={`pill ${cls}`}>{status}</span>;
}

function getCurrentLocation(): Promise<GeoLocationPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("הדפדפן לא תומך בשירותי מיקום."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? Math.round(position.coords.accuracy)
            : null,
        }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

async function getCurrentLocationWithFallback(): Promise<
  GeoLocationPoint | null | false
> {
  try {
    return await getCurrentLocation();
  } catch (_error) {
    const shouldContinue = window.confirm(
      "לא הצלחתי לקבל מיקום מהמכשיר. ודא ששירותי מיקום פעילים ושהרשאת מיקום מאושרת לדפדפן. האם להמשיך בלי לשמור מיקום?",
    );
    return shouldContinue ? null : false;
  }
}

function mapsLink(
  lat: number | null | undefined,
  lng: number | null | undefined,
) {
  if (typeof lat !== "number" || typeof lng !== "number") return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function formatLocation(location: GeoLocationPoint) {
  const accuracy =
    typeof location.accuracy === "number"
      ? ` · דיוק כ-${location.accuracy} מ׳`
      : "";
  return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}${accuracy}`;
}

function LocationLine({
  label,
  lat,
  lng,
  accuracy,
}: {
  label: string;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
}) {
  const link = mapsLink(lat, lng);
  if (!link)
    return (
      <>
        <br />
        <span className="muted locationLine">
          <MapPin size={13} /> {label}: לא נשמר
        </span>
      </>
    );
  return (
    <>
      <br />
      <a
        className="muted locationLine"
        href={link}
        target="_blank"
        rel="noreferrer"
      >
        <MapPin size={13} /> {label}: פתח במפה
        {typeof accuracy === "number"
          ? ` · דיוק כ-${Math.round(accuracy)} מ׳`
          : ""}
      </a>
    </>
  );
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins} דק׳`;
  return `${hours} שעות ו-${mins} דק׳`;
}

function formatHoursDecimal(minutes: number) {
  return (minutes / 60).toFixed(2);
}

function csvEscape(value: string) {
  const text = value ?? "";
  return `"${text.replace(/"/g, '""')}"`;
}

function buildWorkReportRows(workSessions: WorkSession[]) {
  const map = new Map<
    string,
    {
      workerName: string;
      email: string;
      projectName: string;
      clientName: string;
      location: string;
      totalMinutes: number;
      daysSet: Set<string>;
      openSessions: number;
      startMapLinks: string[];
      endMapLinks: string[];
      workDatesSet: Set<string>;
    }
  >();

  for (const item of workSessions) {
    const key = `${item.worker_id}_${item.project_id}`;
    const started = new Date(item.started_at);
    const ended = item.ended_at ? new Date(item.ended_at) : new Date();
    const minutes = Math.max(
      0,
      Math.round((ended.getTime() - started.getTime()) / 60000),
    );
    const existing = map.get(key) || {
      workerName: item.profiles?.full_name || "עובד",
      email: item.profiles?.email || "",
      projectName: item.projects?.name || "פרויקט",
      clientName: item.projects?.client_name || "",
      location: item.projects?.location || "",
      totalMinutes: 0,
      daysSet: new Set<string>(),
      openSessions: 0,
      startMapLinks: [],
      endMapLinks: [],
      workDatesSet: new Set<string>(),
    };

    existing.totalMinutes += minutes;
    const workDate = started.toISOString().slice(0, 10);
    existing.daysSet.add(workDate);
    existing.workDatesSet.add(workDate);
    const startLink = mapsLink(item.started_lat, item.started_lng);
    const endLink = mapsLink(item.ended_lat, item.ended_lng);
    if (startLink && !existing.startMapLinks.includes(startLink))
      existing.startMapLinks.push(startLink);
    if (endLink && !existing.endMapLinks.includes(endLink))
      existing.endMapLinks.push(endLink);
    if (!item.ended_at) existing.openSessions += 1;
    map.set(key, existing);
  }

  return Array.from(map.values())
    .map((r) => ({
      ...r,
      days: r.daysSet.size,
      workDates: Array.from(r.workDatesSet).sort(),
    }))
    .sort((a, b) => a.workerName.localeCompare(b.workerName, "he"));
}

function NotificationsPopover({
  notifications,
  unreadCount,
  markRead,
  markAllRead,
  close,
  openFullPage,
}: {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  close: () => void;
  openFullPage: () => void;
}) {
  const recent = notifications.slice(0, 6);
  return (
    <div className="notificationsPopover" dir="rtl">
      <div className="popoverHeader">
        <div>
          <b>התראות</b>
          <span>
            {unreadCount > 0 ? `${unreadCount} חדשות` : "אין התראות חדשות"}
          </span>
        </div>
        <button className="iconOnly" onClick={close} title="סגור">
          <X size={16} />
        </button>
      </div>
      <div className="popoverList">
        {recent.length === 0 && (
          <div className="popoverEmpty">אין התראות כרגע</div>
        )}
        {recent.map((item) => (
          <button
            key={item.id}
            className={`popoverItem ${item.is_read ? "" : "unread"}`}
            onClick={() => !item.is_read && markRead(item.id)}
          >
            <span className="dot" />
            <span className="popoverText">
              <b>{item.title}</b>
              {item.body && <small>{item.body}</small>}
              <em>{new Date(item.created_at).toLocaleString("he-IL")}</em>
            </span>
          </button>
        ))}
      </div>
      <div className="popoverActions">
        <button className="ghost tinyBtn" onClick={openFullPage}>
          לכל ההתראות
        </button>
        <button
          className="ghost tinyBtn"
          onClick={markAllRead}
          disabled={unreadCount === 0}
        >
          סמן הכל כנקרא
        </button>
      </div>
    </div>
  );
}

function NotificationsPanel({
  notifications,
  markRead,
  markAllRead,
}: {
  notifications: AppNotification[];
  markRead: (id: string) => void;
  markAllRead: () => void;
}) {
  const unread = notifications.filter((n) => !n.is_read).length;
  return (
    <section className="card notificationsPanel">
      <div className="reportHeader">
        <div>
          <h2>התראות</h2>
          <p className="muted">
            התראות פנימיות על שינויי סטטוס, התחלת/סיום עבודה ומשימות.
          </p>
        </div>
        <button className="ghost" onClick={markAllRead} disabled={unread === 0}>
          סמן הכל כנקרא
        </button>
      </div>
      <div className="notificationsList">
        {notifications.length === 0 && (
          <div className="empty">אין התראות כרגע</div>
        )}
        {notifications.map((item) => (
          <div
            key={item.id}
            className={`notificationItem ${item.is_read ? "" : "unread"}`}
          >
            <div>
              <b>{item.title}</b>
              {item.body && <p>{item.body}</p>}
              <span className="muted">
                {item.projects?.name ? `${item.projects.name} · ` : ""}
                {item.profiles?.full_name
                  ? `${item.profiles.full_name} · `
                  : ""}
                {new Date(item.created_at).toLocaleString("he-IL")}
              </span>
            </div>
            {!item.is_read && (
              <button
                className="ghost tinyBtn"
                onClick={() => markRead(item.id)}
              >
                סמן כנקרא
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ExceptionsPanel({ projects }: { projects: Project[] }) {
  const exceptions = buildProjectExceptions(projects);
  return (
    <section className="card exceptionsPanel">
      <div className="reportHeader">
        <div>
          <h2>דוח חריגות יומי</h2>
          <p className="muted">
            רשימת דברים שכדאי שמנהל יעבור עליהם: פרויקטים ללא שיוך, עבודה פתוחה,
            סטטוס תקוע ומשימות ישנות.
          </p>
        </div>
        <button
          className="ghost"
          onClick={() => exportExceptionsCsv(exceptions)}
        >
          <Download size={16} /> ייצוא חריגות
        </button>
      </div>
      {exceptions.length === 0 && <div className="empty">אין חריגות כרגע</div>}
      <div className="exceptionsList">
        {exceptions.map((item, index) => (
          <div
            className={`exceptionItem severity-${item.severity}`}
            key={`${item.project.id}-${item.type}-${index}`}
          >
            <div className="exceptionIcon">
              <AlertTriangle size={18} />
            </div>
            <div>
              <b>{item.title}</b>
              <p>{item.description}</p>
              <span className="muted">
                {item.project.name} · {item.project.location} ·{" "}
                {item.project.profiles?.full_name || "לא משויך"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function daysBetween(dateText: string | null | undefined) {
  if (!dateText) return 0;
  const date = new Date(dateText);
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function buildProjectExceptions(projects: Project[]) {
  const exceptions: {
    project: Project;
    type: string;
    title: string;
    description: string;
    severity: "low" | "medium" | "high";
  }[] = [];
  for (const project of projects) {
    if (!project.assigned_to) {
      exceptions.push({
        project,
        type: "unassigned",
        title: "פרויקט ללא שיוך לעובד",
        description: "הפרויקט קיים במערכת אך עדיין לא שויך לעובד שטח.",
        severity: "high",
      });
    }
    const openSessions = (project.work_sessions || []).filter(
      (session) => !session.ended_at,
    );
    for (const session of openSessions) {
      const hours =
        Math.round(
          ((Date.now() - new Date(session.started_at).getTime()) / 3600000) *
            10,
        ) / 10;
      exceptions.push({
        project,
        type: "open_work",
        title: "עבודה פתוחה ללא סיום",
        description: `קיימת שעת התחלה פתוחה כבר ${hours} שעות. מומלץ לוודא שהעובד סיים עבודה.`,
        severity: hours >= 10 ? "high" : "medium",
      });
    }
    const staleDays = daysBetween(project.updated_at);
    if (project.status !== "הושלם" && staleDays >= 4) {
      exceptions.push({
        project,
        type: "stale_project",
        title: "פרויקט ללא עדכון מספר ימים",
        description: `הפרויקט לא עודכן כבר ${staleDays} ימים.`,
        severity: staleDays >= 7 ? "high" : "medium",
      });
    }
    if (project.status === "מחכה להיתרים" && staleDays >= 7) {
      exceptions.push({
        project,
        type: "permits_wait",
        title: "מחכה להיתרים זמן ממושך",
        description: `הפרויקט בסטטוס מחכה להיתרים כבר ${staleDays} ימים מאז העדכון האחרון.`,
        severity: "medium",
      });
    }
    for (const task of project.project_tasks || []) {
      const taskDays = daysBetween(task.created_at);
      if (!task.is_done && taskDays >= 7) {
        exceptions.push({
          project,
          type: "old_task",
          title: "משימה פתוחה יותר מדי זמן",
          description: `המשימה "${task.title}" פתוחה כבר ${taskDays} ימים.`,
          severity: taskDays >= 14 ? "high" : "low",
        });
      }
    }
  }
  return exceptions;
}

function exportExceptionsCsv(
  exceptions: ReturnType<typeof buildProjectExceptions>,
) {
  if (!exceptions.length) return;
  const headers = [
    "סוג חריגה",
    "פרויקט",
    "לקוח",
    "מיקום",
    "עובד",
    "תיאור",
    "חומרה",
  ];
  const rows = exceptions.map((item) => [
    item.title,
    item.project.name,
    item.project.client_name || "",
    item.project.location,
    item.project.profiles?.full_name || "לא משויך",
    item.description,
    item.severity,
  ]);
  const csv =
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `דוח-חריגות-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function WorkerAssignmentsPanel({
  projects,
  workers,
}: {
  projects: Project[];
  workers: Profile[];
}) {
  const [search, setSearch] = useState("");
  const [assignmentStatus, setAssignmentStatus] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const normalizedSearch = search.trim().toLowerCase();
  const fieldWorkers = workers.filter((worker) => worker.role === "field_worker");

  const workerRows = fieldWorkers
    .map((worker) => {
      const workerMatches =
        !normalizedSearch ||
        `${worker.full_name} ${worker.email || ""}`
          .toLowerCase()
          .includes(normalizedSearch);
      const assignedProjects = projects
        .filter(
          (project) =>
            project.assigned_to === worker.id ||
            project.project_workers?.some(
              (assignment) => assignment.worker_id === worker.id,
            ),
        )
        .filter((project) => includeArchived || !project.is_archived)
        .filter(
          (project) => !assignmentStatus || project.status === assignmentStatus,
        )
        .filter((project) => {
          if (workerMatches) return true;
          const projectText = `${project.name} ${project.client_name || ""} ${project.location} ${project.status}`;
          return projectText.toLowerCase().includes(normalizedSearch);
        })
        .sort((a, b) => a.name.localeCompare(b.name, "he"));

      return { worker, projects: assignedProjects, workerMatches };
    })
    .filter(
      ({ projects: assignedProjects, workerMatches }) =>
        assignedProjects.length > 0 ||
        (workerMatches && !assignmentStatus && !normalizedSearch),
    );

  const assignedActiveProjects = new Set(
    projects
      .filter((project) => !project.is_archived)
      .filter(
        (project) =>
          project.assigned_to || (project.project_workers?.length || 0) > 0,
      )
      .map((project) => project.id),
  ).size;
  const workersWithoutProjects = fieldWorkers.filter(
    (worker) =>
      !projects.some(
        (project) =>
          !project.is_archived &&
          (project.assigned_to === worker.id ||
            project.project_workers?.some(
              (assignment) => assignment.worker_id === worker.id,
            )),
      ),
  ).length;

  return (
    <section className="card assignmentsPanel">
      <div className="panelHeader">
        <div>
          <h2>פרויקטים משויכים לפי עובד</h2>
          <p className="muted">
            תמונת מצב של כל עובד שטח, כולל פרויקטים שבהם הוא אחראי ראשי או עובד נוסף.
          </p>
        </div>
      </div>

      <div className="assignmentSummary">
        <div>
          <strong>{fieldWorkers.length}</strong>
          <span>עובדי שטח</span>
        </div>
        <div>
          <strong>{assignedActiveProjects}</strong>
          <span>פרויקטים פעילים משויכים</span>
        </div>
        <div>
          <strong>{workersWithoutProjects}</strong>
          <span>עובדים ללא פרויקט פעיל</span>
        </div>
      </div>

      <div className="toolbar assignmentToolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="חיפוש עובד, פרויקט, לקוח או מיקום..."
        />
        <select
          value={assignmentStatus}
          onChange={(event) => setAssignmentStatus(event.target.value)}
        >
          <option value="">כל הסטטוסים</option>
          {appStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <label className="archiveToggle">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
          />
          הצג גם פרויקטים בארכיון
        </label>
      </div>

      <div className="workerAssignmentGrid">
        {workerRows.map(({ worker, projects: assignedProjects }) => (
          <article className="workerAssignmentCard" key={worker.id}>
            <header>
              <div className="avatar">{worker.full_name?.[0] || "ע"}</div>
              <div>
                <h3>{worker.full_name}</h3>
                <p>{worker.email || "ללא כתובת מייל"}</p>
              </div>
              <span className="assignmentCount">
                {assignedProjects.length} פרויקטים
              </span>
            </header>

            <div className="assignedProjectList">
              {assignedProjects.map((project) => {
                const isPrimary = project.assigned_to === worker.id;
                return (
                  <div className="assignedProjectRow" key={project.id}>
                    <div className="assignedProjectHeading">
                      <div>
                        <b>{project.name}</b>
                        <span>
                          {project.client_name || "ללא לקוח"} · {project.location}
                        </span>
                      </div>
                      <StatusPill status={project.status} />
                    </div>
                    <div className="assignedProjectMeta">
                      <span className={isPrimary ? "primaryAssignment" : "extraAssignment"}>
                        {isPrimary ? "אחראי ראשי" : "עובד נוסף"}
                      </span>
                      <span>{project.progress}% התקדמות</span>
                      <span>
                        יעד: {project.due_date
                          ? new Date(project.due_date).toLocaleDateString("he-IL")
                          : "לא הוגדר"}
                      </span>
                      {project.is_archived && <span className="archiveBadge">בארכיון</span>}
                    </div>
                    <div className="progress assignmentProgress">
                      <i style={{ width: `${project.progress}%` }} />
                    </div>
                  </div>
                );
              })}
              {assignedProjects.length === 0 && (
                <div className="assignmentEmpty">אין לעובד פרויקטים פעילים משויכים</div>
              )}
            </div>
          </article>
        ))}
        {workerRows.length === 0 && (
          <div className="empty">לא נמצאו עובדים או פרויקטים התואמים לסינון.</div>
        )}
      </div>
    </section>
  );
}

function ProjectStatusReport({ projects }: { projects: Project[] }) {
  const [reportSearch, setReportSearch] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [reportAssignment, setReportAssignment] = useState("all");
  const sortedProjects = useMemo(
    () =>
      [...projects].sort((a, b) =>
        a.name.localeCompare(b.name, "he"),
      ),
    [projects],
  );
  const reportStatuses = useMemo(
    () => Array.from(new Set(projects.map((project) => project.status))).sort(),
    [projects],
  );
  const filteredProjects = useMemo(() => {
    const normalizedSearch = reportSearch.trim().toLowerCase();
    return sortedProjects.filter((project) => {
      const matchesSearch =
        !normalizedSearch ||
        `${project.name} ${project.status} ${project.profiles?.full_name || ""}`
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesStatus = !reportStatus || project.status === reportStatus;
      const matchesAssignment =
        reportAssignment === "all" ||
        (reportAssignment === "assigned" && !!project.assigned_to) ||
        (reportAssignment === "unassigned" && !project.assigned_to);
      return matchesSearch && matchesStatus && matchesAssignment;
    });
  }, [sortedProjects, reportSearch, reportStatus, reportAssignment]);
  const assignedProjects = projects.filter(
    (project) => !!project.assigned_to,
  ).length;
  const completedProjects = projects.filter(
    (project) => project.status === "הושלם",
  ).length;

  function exportProjectsStatusExcel() {
    if (!filteredProjects.length) return;
    const headers = [
      "מס׳",
      "שם הפרויקט",
      "סטטוס נוכחי",
      "עובד שטח אחראי",
    ];
    const rows = filteredProjects.map((project, index) => [
      String(index + 1),
      project.name,
      project.status,
      project.profiles?.full_name || "לא משויך",
    ]);
    const csv =
      "\uFEFF" +
      [headers, ...rows]
        .map((row) => row.map((value) => csvEscape(value)).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `דוח-מצב-פרויקטים-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="card projectStatusReport">
      <div className="projectStatusVisualHero">
        <div className="projectStatusHeroCopy">
          <div className="projectStatusHeroIcon"><FileText size={28} /></div>
          <div>
            <span className="projectStatusEyebrow">PROJECT OVERVIEW</span>
            <h2>תמונת מצב של כל הפרויקטים</h2>
            <p>סטטוס עדכני, אחריות ברורה וייצוא מהיר לקובץ Excel.</p>
          </div>
        </div>
        <button
          className="excelExportBtn"
          onClick={exportProjectsStatusExcel}
          disabled={!filteredProjects.length}
        >
          <Download size={20} />
          <span>
            הורדת דוח Excel
            <small>{filteredProjects.length} פרויקטים בדוח</small>
          </span>
        </button>
      </div>

      <div className="projectStatusStats">
        <div className="projectStatusMetric metricBlue">
          <span className="metricIcon"><FolderKanban /></span>
          <div><strong>{projects.length}</strong><span>כל הפרויקטים</span></div>
        </div>
        <div className="projectStatusMetric metricTeal">
          <span className="metricIcon"><Users /></span>
          <div><strong>{assignedProjects}</strong><span>עם עובד אחראי</span></div>
        </div>
        <div className="projectStatusMetric metricGreen">
          <span className="metricIcon"><CheckCircle /></span>
          <div><strong>{completedProjects}</strong><span>פרויקטים שהושלמו</span></div>
        </div>
        <div className="projectStatusMetric metricOrange">
          <span className="metricIcon"><AlertTriangle /></span>
          <div><strong>{projects.length - assignedProjects}</strong><span>ממתינים לשיוך</span></div>
        </div>
      </div>

      <div className="projectStatusFilters">
        <label className="projectStatusSearch">
          <Search size={18} />
          <input
            value={reportSearch}
            onChange={(event) => setReportSearch(event.target.value)}
            placeholder="חיפוש לפי פרויקט, סטטוס או עובד..."
          />
        </label>
        <select
          value={reportStatus}
          onChange={(event) => setReportStatus(event.target.value)}
          aria-label="סינון לפי סטטוס"
        >
          <option value="">כל הסטטוסים</option>
          {reportStatuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <select
          value={reportAssignment}
          onChange={(event) => setReportAssignment(event.target.value)}
          aria-label="סינון לפי שיוך"
        >
          <option value="all">כל השיוכים</option>
          <option value="assigned">עם עובד אחראי</option>
          <option value="unassigned">ללא עובד אחראי</option>
        </select>
        <span className="projectStatusResultCount">
          מציג {filteredProjects.length} מתוך {projects.length}
        </span>
      </div>

      <div className="tableWrap projectStatusTableWrap">
        <table className="reportTable projectStatusTable">
          <thead>
            <tr>
              <th>מס׳</th>
              <th>שם הפרויקט</th>
              <th>סטטוס נוכחי</th>
              <th>עובד שטח אחראי</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project, index) => (
              <tr key={project.id}>
                <td><span className="projectRowNumber">{index + 1}</span></td>
                <td>
                  <div className="projectReportName">
                    <span className="projectReportIcon"><FolderKanban size={17} /></span>
                    <div>
                      <b>{project.name}</b>
                      {project.is_archived && (
                        <small><Archive size={12} /> בארכיון</small>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <StatusPill status={project.status} />
                </td>
                <td>
                  {project.profiles?.full_name ? (
                    <div className="projectReportWorker">
                      <span>{project.profiles.full_name[0]}</span>
                      <b>{project.profiles.full_name}</b>
                    </div>
                  ) : (
                    <span className="unassignedReportBadge">
                      <AlertTriangle size={14} /> טרם שויך
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredProjects.length === 0 && (
          <div className="projectStatusEmpty">
            <Search size={28} />
            <b>לא נמצאו פרויקטים</b>
            <span>נסו לשנות את החיפוש או את הסינון.</span>
          </div>
        )}
      </div>
    </section>
  );
}


function TodayFieldPanel({
  projects,
  workSessions,
  workers,
}: {
  projects: Project[];
  workSessions: WorkSession[];
  workers: Profile[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = workSessions.filter((session) =>
    session.started_at.startsWith(today),
  );
  const activeSessions = workSessions.filter((session) => !session.ended_at);
  const activeWorkerIds = new Set(activeSessions.map((s) => s.worker_id));
  const todayWorkerIds = new Set(todaySessions.map((s) => s.worker_id));
  const fieldWorkers = workers.filter((w) => w.role === "field_worker");
  const notStarted = fieldWorkers.filter((worker) => !todayWorkerIds.has(worker.id));

  async function sendDailySummaryNow() {
    const { error } = await supabase.functions.invoke("daily-manager-summary", {
      body: { appUrl: typeof window !== "undefined" ? window.location.origin : "" },
    });
    alert(error ? `שליחת הסיכום נכשלה: ${error.message}` : "סיכום יומי נשלח למנהלים");
  }

  return (
    <section className="card">
      <div className="panelHeader">
        <div>
          <h2>היום בשטח</h2>
          <p className="muted">מעקב יומי אחר עובדים פעילים, עובדים שלא התחילו ופרויקטים בשטח.</p>
        </div>
        <button className="ghost smallBtn" onClick={sendDailySummaryNow}>שלח סיכום יומי עכשיו</button>
      </div>
      <div className="grid miniStats">
        <Stat number={todaySessions.length} label="כניסות עבודה היום" icon={<Clock />} />
        <Stat number={activeSessions.length} label="עבודות פתוחות" icon={<PlayCircle />} />
        <Stat number={activeWorkerIds.size} label="עובדים פעילים עכשיו" icon={<Users />} />
        <Stat number={notStarted.length} label="עובדים שלא התחילו" icon={<AlertTriangle />} />
      </div>
      <div className="twoColumns">
        <div className="innerPanel">
          <h3>עובדים פעילים עכשיו</h3>
          {activeSessions.length === 0 && <p className="muted">אין עבודות פתוחות כרגע.</p>}
          {activeSessions.map((session) => (
            <div className="listRow" key={session.id}>
              <b>{session.profiles?.full_name || "עובד"}</b>
              <span>{session.projects?.name || "פרויקט"}</span>
              <small>{new Date(session.started_at).toLocaleString("he-IL")}</small>
            </div>
          ))}
        </div>
        <div className="innerPanel">
          <h3>טרם התחילו היום</h3>
          {notStarted.length === 0 && <p className="muted">כל העובדים התחילו או שאין עובדים להצגה.</p>}
          {notStarted.map((worker) => (
            <div className="listRow" key={worker.id}>
              <b>{worker.full_name}</b>
              <span>{worker.email}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="innerPanel" style={{ marginTop: 16 }}>
        <h3>כל פעולות העבודה היום</h3>
        {todaySessions.length === 0 && <p className="muted">אין רישומי עבודה להיום.</p>}
        {todaySessions.map((session) => (
          <div className="listRow" key={session.id}>
            <b>{session.profiles?.full_name || "עובד"}</b>
            <span>{session.projects?.name || "פרויקט"} · {session.projects?.location || ""}</span>
            <small>
              התחלה: {new Date(session.started_at).toLocaleTimeString("he-IL")} · {session.ended_at ? `סיום: ${new Date(session.ended_at).toLocaleTimeString("he-IL")}` : "פתוח"}
              {session.end_note ? ` · הערה: ${session.end_note}` : ""}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkReportPanel({
  workSessions,
  workers,
  reportWorkerId,
  setReportWorkerId,
  reportMonth,
  setReportMonth,
  reportFromDate,
  setReportFromDate,
  reportToDate,
  setReportToDate,
  exportWorkReport,
}: {
  workSessions: WorkSession[];
  workers: Profile[];
  reportWorkerId: string;
  setReportWorkerId: (id: string) => void;
  reportMonth: string;
  setReportMonth: (value: string) => void;
  reportFromDate: string;
  setReportFromDate: (value: string) => void;
  reportToDate: string;
  setReportToDate: (value: string) => void;
  exportWorkReport: (
    workerId?: string,
    fromDate?: string,
    toDate?: string,
  ) => void;
}) {
  const reportWorkers = useMemo(() => {
    const seen = new Set<string>();
    return workers
      .filter((worker) => {
        if (seen.has(worker.id)) return false;
        seen.add(worker.id);
        return true;
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "he"));
  }, [workers]);
  const filteredSessions = useMemo(
    () =>
      workSessions
        .filter(
          (item) =>
            reportWorkerId === "all" || item.worker_id === reportWorkerId,
        )
        .filter((item) =>
          sessionStartedInRange(item, reportFromDate, reportToDate),
        ),
    [workSessions, reportWorkerId, reportFromDate, reportToDate],
  );
  const rows = useMemo(
    () => buildWorkReportRows(filteredSessions),
    [filteredSessions],
  );
  const totalMinutes = rows.reduce((sum, row) => sum + row.totalMinutes, 0);
  const totalDays = rows.reduce((sum, row) => sum + row.days, 0);

  function applyMonth(value: string) {
    setReportMonth(value);
    if (!value) return;
    const [year, month] = value.split("-").map(Number);
    if (!year || !month) return;
    setReportFromDate(toDateInputValue(new Date(year, month - 1, 1)));
    setReportToDate(toDateInputValue(new Date(year, month, 0)));
  }

  return (
    <section className="card">
      <div className="reportHeader">
        <div>
          <h2>דוח שעות עובדים</h2>
          <p className="muted">
            סיכום שעות לפי עובד, פרויקט וטווח תאריכים. אפשר לבחור חודש מלא או
            טווח מותאם ולייצא לאקסל.
          </p>
        </div>
        <div className="reportActions reportActionsWide">
          <label>
            עובד
            <select
              value={reportWorkerId}
              onChange={(e) => setReportWorkerId(e.target.value)}
            >
              <option value="all">כל העובדים</option>
              {reportWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.full_name} - {worker.email}
                </option>
              ))}
            </select>
          </label>
          <label>
            חודש
            <input
              type="month"
              value={reportMonth}
              onChange={(e) => applyMonth(e.target.value)}
            />
          </label>
          <label>
            מתאריך
            <input
              type="date"
              value={reportFromDate}
              onChange={(e) => setReportFromDate(e.target.value)}
            />
          </label>
          <label>
            עד תאריך
            <input
              type="date"
              value={reportToDate}
              onChange={(e) => setReportToDate(e.target.value)}
            />
          </label>
          <button
            onClick={() =>
              exportWorkReport(reportWorkerId, reportFromDate, reportToDate)
            }
          >
            <Download size={16} /> ייצוא לאקסל
          </button>
        </div>
      </div>
      <div className="reportStats">
        <Stat number={rows.length} label="שורות בדוח" icon={<Users />} />
        <Stat
          number={Math.round((totalMinutes / 60) * 10) / 10}
          label="סה״כ שעות"
          icon={<Clock />}
        />
        <Stat number={totalDays} label="ימי עבודה בדוח" icon={<History />} />
      </div>
      <div className="tableWrap">
        <table className="reportTable">
          <thead>
            <tr>
              <th>עובד</th>
              <th>פרויקט</th>
              <th>לקוח</th>
              <th>מיקום</th>
              <th>תאריכי עבודה</th>
              <th>ימים</th>
              <th>זמן עבודה</th>
              <th>פתוח</th>
              <th>מיקומי שטח</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9}>אין נתוני שעות בטווח שנבחר</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={`${row.email}_${row.projectName}`}>
                <td>
                  <b>{row.workerName}</b>
                  <br />
                  <span className="muted">{row.email}</span>
                </td>
                <td>{row.projectName}</td>
                <td>{row.clientName || "-"}</td>
                <td>{row.location || "-"}</td>
                <td>{row.workDates.join(", ") || "-"}</td>
                <td>{row.days}</td>
                <td>
                  {formatDuration(row.totalMinutes)}
                  <br />
                  <span className="muted">
                    {formatHoursDecimal(row.totalMinutes)} שעות
                  </span>
                </td>
                <td>{row.openSessions ? `${row.openSessions} פתוח` : "-"}</td>
                <td>
                  <MapLinks
                    startLinks={row.startMapLinks}
                    endLinks={row.endMapLinks}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MapLinks({
  startLinks,
  endLinks,
}: {
  startLinks: string[];
  endLinks: string[];
}) {
  if (!startLinks.length && !endLinks.length)
    return <span className="muted">לא נשמר מיקום</span>;
  return (
    <div className="mapLinks">
      {startLinks.slice(0, 3).map((link, i) => (
        <a key={`s-${link}`} href={link} target="_blank" rel="noreferrer">
          התחלה {i + 1}
        </a>
      ))}
      {endLinks.slice(0, 3).map((link, i) => (
        <a key={`e-${link}`} href={link} target="_blank" rel="noreferrer">
          סיום {i + 1}
        </a>
      ))}
      {startLinks.length + endLinks.length > 6 && (
        <span className="muted">ועוד...</span>
      )}
    </div>
  );
}

function HistoryPanel({
  historyItems,
  projects,
}: {
  historyItems: StatusHistory[];
  projects: Project[];
}) {
  const projectName = (id: string) =>
    projects.find((p) => p.id === id)?.name || "פרויקט";
  return (
    <section className="card">
      <h2>היסטוריית שינויים</h2>
      <div className="projects">
        {historyItems.length === 0 && (
          <div className="empty">אין היסטוריה להצגה</div>
        )}
        {historyItems.map((h) => (
          <div className="historyItem" key={h.id}>
            <b>{projectName(h.project_id)}</b> · {h.new_status}
            <br />
            <span className="muted">
              {h.profiles?.full_name || "משתמש"} ·{" "}
              {new Date(h.created_at).toLocaleString("he-IL")}
            </span>
            {h.note && <p className="muted">{h.note}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function SetupScreen() {
  return (
    <main className="login">
      <section className="card">
        <img src="/logo.png" alt="לוגו" />
        <h1>נדרש חיבור Supabase</h1>
        <p className="muted">
          צור קובץ <b>.env.local</b> בתיקיית הפרויקט והוסף את הפרטים מ-Supabase:
        </p>
        <pre className="setupCode">
          NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co{`\n`}
          NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
        </pre>
      </section>
    </main>
  );
}
