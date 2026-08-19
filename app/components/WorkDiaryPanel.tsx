"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileSignature, PenLine, PlusCircle, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type WorkDiaryProject = {
  id: string;
  name: string;
  client_name: string | null;
  location: string;
  contact_phone?: string | null;
};

type WorkDiaryForm = {
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

type WorkDiaryRecord = {
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

type WorkKindKey =
  | "color_marking"
  | "sketch_marking"
  | "autocad_mapping"
  | "excavation_escort"
  | "cable_fault"
  | "suction_small"
  | "suction_large"
  | "gpr_usage";

const workKinds: Array<{ key: WorkKindKey; label: string }> = [
  { key: "color_marking", label: "איתור וסימון בצבע / יתדות" },
  { key: "sketch_marking", label: "איתור וסימון בסקיצה (לצרף סקיצה)" },
  { key: "autocad_mapping", label: "איתור ומיפוי אוטוקד" },
  { key: "excavation_escort", label: "ליווי חפירות" },
  { key: "cable_fault", label: "איתור תקלה בכבל" },
  { key: "suction_small", label: "שאיבת עפר קטנה" },
  { key: "suction_large", label: "שאיבת עפר גדולה" },
  { key: "gpr_usage", label: "שימוש ב-GPR" },
];

type LeakKindKey = "leak_detection" | "point_leak" | "depreciation_survey";

const leakKinds: Array<{ key: LeakKindKey; label: string }> = [
  { key: "leak_detection", label: "איתור דלף" },
  { key: "point_leak", label: "דלף נקודתי" },
  { key: "depreciation_survey", label: "סקר פחת" },
];

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDiary(project: WorkDiaryProject, teamLeadName: string): WorkDiaryForm {
  return {
    work_date: todayValue(),
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

export default function WorkDiaryPanel({
  project,
  currentUserName,
  canDelete,
}: {
  project: WorkDiaryProject;
  currentUserName: string;
  canDelete: boolean;
}) {
  const [diaries, setDiaries] = useState<WorkDiaryRecord[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(() => emptyDiary(project, currentUserName));
  const [customerSignature, setCustomerSignature] = useState("");
  const [teamLeadSignature, setTeamLeadSignature] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [message, setMessage] = useState("");

  async function loadDiaries() {
    setLoading(true);
    const { data, error } = await supabase
      .from("work_diaries")
      .select("*, profiles:created_by(full_name)")
      .eq("project_id", project.id)
      .order("diary_number", { ascending: false });
    if (error) {
      console.warn("Work diaries load failed:", error.message);
      setMessage("יומני העבודה עדיין לא הופעלו במסד הנתונים.");
      setDiaries([]);
    } else {
      setMessage("");
      setDiaries((data || []) as WorkDiaryRecord[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadDiaries();
  }, [project.id]);

  useEffect(() => {
    if (!formOpen) return;
    const previous = {
      overflow: document.body.style.overflow,
      htmlOverflow: document.documentElement.style.overflow,
      overscrollBehavior: document.body.style.overscrollBehavior,
    };
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous.overflow;
      document.body.style.overscrollBehavior = previous.overscrollBehavior;
      document.documentElement.style.overflow = previous.htmlOverflow;
    };
  }, [formOpen]);

  function update<K extends keyof WorkDiaryForm>(key: K, value: WorkDiaryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openNewDiary() {
    setForm(emptyDiary(project, currentUserName));
    setCustomerSignature("");
    setTeamLeadSignature("");
    setMessage("");
    setFormOpen(true);
  }

  async function saveDiary() {
    if (!form.work_date || !form.contact_name || !form.start_time || !form.end_time) {
      setMessage("יש למלא תאריך, איש קשר ושעות התחלה וסיום.");
      return;
    }
    if (!form.customer_name || !form.team_lead_name) {
      setMessage("יש למלא את שמות נציג הלקוח וראש צוות מאיה.");
      return;
    }
    if (!customerSignature || !teamLeadSignature) {
      setMessage("חובה להשלים את שתי החתימות לפני שמירת היומן.");
      return;
    }
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("work_diaries")
      .insert({
        project_id: project.id,
        created_by: user.id,
        form_data: form,
        customer_signature: customerSignature,
        team_lead_signature: teamLeadSignature,
      })
      .select("*, profiles:created_by(full_name)")
      .single();
    setSaving(false);
    if (error) {
      setMessage(`שמירת היומן נכשלה: ${error.message}`);
      return;
    }
    setDiaries((current) => [data as WorkDiaryRecord, ...current]);
    setFormOpen(false);
    setMessage(`יומן עבודה מספר ${(data as WorkDiaryRecord).diary_number} נשמר ונחתם.`);
  }

  async function deleteDiary(diary: WorkDiaryRecord) {
    if (!canDelete || deletingId) return;
    const confirmed = window.confirm(
      `למחוק את יומן העבודה ${diary.diary_number}? היומן והאפשרות להפיק ממנו PDF יימחקו לצמיתות.`,
    );
    if (!confirmed) return;

    setDeletingId(diary.id);
    setMessage("");
    const { error } = await supabase
      .from("work_diaries")
      .delete()
      .eq("id", diary.id)
      .eq("project_id", project.id);
    setDeletingId("");

    if (error) {
      setMessage(`מחיקת יומן העבודה נכשלה: ${error.message}`);
      return;
    }

    setDiaries((current) => current.filter((item) => item.id !== diary.id));
    setMessage(`יומן עבודה מספר ${diary.diary_number} וה-PDF שלו נמחקו.`);
  }

  return (
    <section className="workDiaryPanel">
      <header className="workDiaryPanelHeader">
        <div>
          <span className="workDiaryEyebrow">יומן עבודה דיגיטלי</span>
          <h3><FileSignature size={20} /> יומני עבודה חתומים</h3>
          <p>מילוי בשטח, חתימת מזמין העבודה וראש צוות מאיה והפקת PDF.</p>
        </div>
        <button
          type="button"
          className="smallBtn workDiaryAdd"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openNewDiary();
          }}
        >
          <PlusCircle size={17} /> יומן עבודה חדש
        </button>
      </header>

      {message && <div className="workDiaryMessage">{message}</div>}
      {loading ? (
        <div className="muted">טוען יומני עבודה...</div>
      ) : diaries.length ? (
        <div className="workDiaryList">
          {diaries.map((diary) => (
            <article className="workDiaryRow" key={diary.id}>
              <div className="workDiaryNumber">#{diary.diary_number}</div>
              <div>
                <b>יומן עבודה {diary.diary_number}</b>
                <span>
                  {new Date(diary.form_data.work_date).toLocaleDateString("he-IL")} · {diary.form_data.customer_name} · נחתם על ידי {diary.profiles?.full_name || "משתמש"}
                </span>
              </div>
              <div className="workDiaryRowActions">
                <button type="button" className="ghost tinyBtn" onClick={() => exportWorkDiaryPdf(project, diary)}>
                  <Download size={15} /> PDF
                </button>
                {canDelete && (
                  <button
                    type="button"
                    className="ghost tinyBtn dangerBtn"
                    disabled={deletingId === diary.id}
                    onClick={() => deleteDiary(diary)}
                  >
                    <Trash2 size={15} /> {deletingId === diary.id ? "מוחק..." : "מחיקת PDF"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="workDiaryEmpty">עדיין לא נוצר יומן עבודה לפרויקט זה.</div>
      )}

      {formOpen && typeof document !== "undefined" && createPortal(
        <div className="modalBackdrop workDiaryBackdrop" role="dialog" aria-modal="true" onClick={() => setFormOpen(false)}>
          <div className="workDiaryModal" onClick={(event) => event.stopPropagation()}>
            <header className="workDiaryModalHeader">
              <div>
                <span>קבוצת מאיה</span>
                <h2>יומן עבודה חדש</h2>
                <p>{project.name} · המספר יינתן אוטומטית בשמירה</p>
              </div>
              <button type="button" className="ghost iconBtn" aria-label="סגירה" onClick={() => setFormOpen(false)}><X size={19} /></button>
            </header>

            <div className="workDiaryForm">
              <DiarySection title="פרטי היומן והפרויקט">
                <div className="workDiaryGrid three">
                  <DiaryInput label="תאריך" type="date" required value={form.work_date} onChange={(value) => update("work_date", value)} />
                  <DiaryInput label="שם הפרויקט" value={project.name} readOnly />
                  <DiaryInput label="שם המזמין" value={project.client_name || ""} readOnly />
                  <DiaryInput label="איש הקשר" required value={form.contact_name} onChange={(value) => update("contact_name", value)} />
                  <DiaryInput label="טלפון נייד" type="tel" value={form.contact_phone} onChange={(value) => update("contact_phone", value)} />
                  <DiaryInput label="שעה" type="time" required value={form.start_time} onChange={(value) => update("start_time", value)} />
                  <DiaryInput label="עד שעה" type="time" required value={form.end_time} onChange={(value) => update("end_time", value)} />
                  <DiaryInput label="אתר" value={form.site} onChange={(value) => update("site", value)} />
                  <DiaryInput label="תפקיד" value={form.role} onChange={(value) => update("role", value)} />
                </div>
              </DiarySection>

              <DiarySection title="איתור תשתיות תת-קרקעיות / שאיבת עפר / ביקון / מכשיר GPR">
                <div className="workDiaryGrid two">
                  <div className="workDiaryChecks">
                    {workKinds.map((kind) => (
                      <label className="workDiaryCheck" key={kind.key}>
                        <input type="checkbox" checked={Boolean(form[kind.key])} onChange={(event) => update(kind.key, event.target.checked as never)} />
                        <span>{kind.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="workDiaryGrid two compact">
                    <DiaryInput label="סוג התשתית" value={form.infrastructure_type} onChange={(value) => update("infrastructure_type", value)} />
                    <DiaryInput label="עבודה לפי יום עבודה" value={form.work_day} onChange={(value) => update("work_day", value)} />
                    <DiaryInput label="עבודה לפי מ״ר - גודל שטח" value={form.area_sqm} onChange={(value) => update("area_sqm", value)} />
                    <DiaryInput label="עבודה לפי מ׳ אורך - אורך תשתית" value={form.infrastructure_length} onChange={(value) => update("infrastructure_length", value)} />
                    <DiaryInput label="כמות יחידות עד מטר" value={form.units_to_meter} onChange={(value) => update("units_to_meter", value)} />
                    <DiaryInput label="כמות יחידות מעל מטר" value={form.units_over_meter} onChange={(value) => update("units_over_meter", value)} />
                    <DiaryInput label="עומק" value={form.units_depth} onChange={(value) => update("units_depth", value)} />
                  </div>
                </div>
              </DiarySection>

              <DiarySection title="איתור דלף">
                <div className="leakDiaryFields">
                  <div className="workDiaryChecks leakChecks">
                    {leakKinds.map((kind) => (
                      <label className="workDiaryCheck" key={kind.key}>
                        <input type="checkbox" checked={Boolean(form[kind.key])} onChange={(event) => update(kind.key, event.target.checked)} />
                        <span>{kind.label}</span>
                      </label>
                    ))}
                  </div>
                  <DiaryTextarea label="הערות כלליות לאיתור דלף" value={form.leak_notes} onChange={(value) => update("leak_notes", value)} />
                </div>
              </DiarySection>

              <DiarySection title="שירותים נוספים">
                <div className="workDiaryGrid two">
                  <DiaryTextarea label="שירותים נוספים - הערות" value={form.additional_services} onChange={(value) => update("additional_services", value)} />
                  <DiaryInput label="מודד מטעם חברת מאיה" value={form.maya_equipment} onChange={(value) => update("maya_equipment", value)} />
                  <DiaryInput label="מודד מטעם מזמין העבודה" value={form.customer_equipment} onChange={(value) => update("customer_equipment", value)} />
                  <DiaryInput label="שם המודד" value={form.equipment_name} onChange={(value) => update("equipment_name", value)} />
                  <DiaryInput label="סימון סקיצה על גבי מפה קיימת (לצרף צילום סקיצה)" value={form.existing_map_marking} onChange={(value) => update("existing_map_marking", value)} />
                  <DiaryInput label="שונות" value={form.miscellaneous} onChange={(value) => update("miscellaneous", value)} />
                </div>
              </DiarySection>

              <DiarySection title="חתימות חובה">
                <div className="signatureColumns">
                  <div className="signerCard">
                    <h4>נציג הלקוח</h4>
                    <DiaryInput label="שם פרטי ושם משפחה" required value={form.customer_name} onChange={(value) => update("customer_name", value)} />
                    <DiaryInput label="טלפון" type="tel" value={form.customer_phone} onChange={(value) => update("customer_phone", value)} />
                    <SignaturePad label="חתימת נציג הלקוח" onChange={setCustomerSignature} />
                  </div>
                  <div className="signerCard">
                    <h4>ראש צוות מאיה</h4>
                    <DiaryInput label="שם פרטי ושם משפחה" required value={form.team_lead_name} onChange={(value) => update("team_lead_name", value)} />
                    <DiaryInput label="טלפון" type="tel" value={form.team_lead_phone} onChange={(value) => update("team_lead_phone", value)} />
                    <SignaturePad label="חתימת ראש צוות מאיה" onChange={setTeamLeadSignature} />
                  </div>
                </div>
              </DiarySection>

              <DiarySection title="הערות נוספות">
                <DiaryTextarea label="הערות נוספות" value={form.additional_notes} onChange={(value) => update("additional_notes", value)} />
              </DiarySection>
            </div>

            {message && <div className="workDiaryMessage stickyMessage">{message}</div>}
            <footer className="workDiaryActions">
              <button type="button" onClick={saveDiary} disabled={saving}><PenLine size={17} /> {saving ? "שומר..." : "שמירה וסגירת היומן"}</button>
              <button type="button" className="ghost" onClick={() => setFormOpen(false)}>ביטול</button>
            </footer>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}

function DiarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="workDiarySection"><h3>{title}</h3>{children}</section>;
}

function DiaryInput({
  label,
  value,
  onChange,
  type = "text",
  readOnly = false,
  required = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  readOnly?: boolean;
  required?: boolean;
}) {
  return <label>{label}{required && <span className="requiredMark"> *</span>}<input type={type} value={value} readOnly={readOnly} required={required} onChange={(event) => onChange?.(event.target.value)} /></label>;
}

function DiaryTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label>{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SignaturePad({ label, onChange }: { label: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.getBoundingClientRect().width || 420;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(170 * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2.6;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#071e41";
  }, []);

  function pointerPosition(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    drawingRef.current = true;
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const point = pointerPosition(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasSignature(true);
  }

  function finishDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(event.currentTarget.toDataURL("image/png"));
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange("");
  }

  return (
    <div className="signaturePad">
      <div className="signaturePadTitle"><b>{label}</b><button type="button" className="ghost tinyBtn" onClick={clearSignature} disabled={!hasSignature}>ניקוי</button></div>
      <canvas ref={canvasRef} aria-label={label} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={finishDrawing} onPointerCancel={finishDrawing} />
      <small>יש לחתום בתוך המסגרת באמצעות האצבע או העכבר.</small>
    </div>
  );
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

function exportWorkDiaryPdf(project: WorkDiaryProject, diary: WorkDiaryRecord) {
  const form = diary.form_data;
  const logoUrl = `${window.location.origin}/logo.png`;
  const safeSignature = (value: string) => value.startsWith("data:image/png;base64,") ? value : "";
  const hasValue = (value: unknown) => String(value ?? "").trim().length > 0;
  const row = (label: string, value: unknown) => hasValue(value)
    ? `<div class="row"><b class="label">${escapeHtml(label)}</b><span class="value">${escapeHtml(value)}</span></div>`
    : "";
  const metric = (label: string, value: unknown) => hasValue(value)
    ? `<div class="metric"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`
    : "";
  const selectedWorkKinds = workKinds.filter((kind) => Boolean(form[kind.key]));
  const workMetrics = [
    metric("סוג התשתית", form.infrastructure_type),
    metric("עבודה לפי יום עבודה", form.work_day),
    metric("עבודה לפי מ״ר - גודל שטח", form.area_sqm),
    metric("עבודה לפי מ׳ אורך - אורך תשתית", form.infrastructure_length),
    metric("כמות יחידות עד מטר", form.units_to_meter),
    metric("כמות יחידות מעל מטר", form.units_over_meter),
    metric("עומק", form.units_depth),
  ].filter(Boolean);
  const workSection = selectedWorkKinds.length || workMetrics.length
    ? `<div class="box"><div class="sectionTitle">איתור תשתיות תת-קרקעיות / שאיבת עפר / ביקון / מכשיר GPR</div><div class="scope">${selectedWorkKinds.length ? `<div class="checks">${selectedWorkKinds.map((kind) => `<div>☑ ${escapeHtml(kind.label)}</div>`).join("")}</div>` : ""}${workMetrics.length ? `<div class="metrics">${workMetrics.join("")}</div>` : ""}</div></div>`
    : "";
  const selectedLeakKinds = leakKinds.filter((kind) => Boolean(form[kind.key]));
  const legacyLeakNotes = [form.paper_locating, form.point_page].filter(hasValue).join(" · ");
  const leakNotes = form.leak_notes || legacyLeakNotes;
  const leakSection = selectedLeakKinds.length || hasValue(leakNotes)
    ? `<div class="box"><div class="sectionTitle">איתור דלף</div>${selectedLeakKinds.length ? `<div class="checks leakPdfChecks">${selectedLeakKinds.map((kind) => `<div>☑ ${escapeHtml(kind.label)}</div>`).join("")}</div>` : ""}${row("הערות כלליות לאיתור דלף", leakNotes)}</div>`
    : "";
  const serviceRows = [
    row("הערות", form.additional_services),
    row("מודד מטעם חברת מאיה", form.maya_equipment),
    row("מודד מטעם מזמין העבודה", form.customer_equipment),
    row("שם המודד", form.equipment_name),
    row("סימון סקיצה על גבי מפה קיימת", form.existing_map_marking),
    row("שונות", form.miscellaneous),
  ].filter(Boolean);
  const servicesSection = serviceRows.length
    ? `<div class="box"><div class="sectionTitle">שירותים נוספים</div>${serviceRows.join("")}</div>`
    : "";
  const projectRows = [
    row("שם הפרויקט", project.name),
    row("שם המזמין", project.client_name),
    row("איש הקשר", form.contact_name),
    row("טלפון נייד", form.contact_phone),
    row("שעה", form.start_time),
    row("עד שעה", form.end_time),
    row("אתר", form.site),
    row("תפקיד", form.role),
  ].filter(Boolean).join("");
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>יומן עבודה ${diary.diary_number}</title><style>
  @page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#111;direction:rtl;font-size:11px}.toolbar{position:sticky;top:0;display:flex;justify-content:flex-start;padding:8px 0;background:#fff}.toolbar button{padding:9px 14px;border:0;border-radius:8px;background:#071e41;color:#fff;font-weight:700}.sheet{width:100%;max-width:190mm;margin:auto}.head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-bottom:8px}.head img{width:86px;justify-self:start}.headTitle{text-align:center}.headTitle h1{font-size:24px;margin:0}.headTitle small{font-size:9px}.diaryTitle{text-align:center;font-size:22px;margin:4px 0 8px}.topline{display:flex;justify-content:flex-start;margin-bottom:7px;font-size:12px}.box{border:1.5px solid #111;margin-bottom:7px}.row{display:grid;grid-template-columns:145px 1fr;border-bottom:1px solid #111;min-height:24px}.row:last-child{border-bottom:0}.label{font-weight:700;padding:5px 7px;border-left:1px solid #111;background:#fafafa}.value{padding:5px 7px;white-space:pre-wrap}.sectionTitle{text-align:center;font-weight:800;padding:5px;border-bottom:1px solid #111;background:#f5f5f5}.scope{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.checks{padding:7px;line-height:1.8}.scope>.checks+.metrics,.scope>.metrics+.checks{border-right:1px solid #111}.leakPdfChecks{display:flex;gap:18px;flex-wrap:wrap;border-bottom:1px solid #111}.metrics{padding:0}.metric{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #111}.metric:last-child{border-bottom:0}.metric span{padding:4px 6px}.metric b{padding:4px 6px;border-left:1px solid #111}.signatures{display:grid;grid-template-columns:1fr 1fr}.signature{padding:7px;min-height:125px}.signature:first-child{border-left:1px solid #111}.signature img{width:100%;height:62px;object-fit:contain;border-bottom:1px solid #777}.signature p{margin:3px 0}.footerNotes{min-height:55px}.brandFooter{text-align:center;margin-top:8px;font-size:9px}.brandFooter b{display:block;font-size:18px;letter-spacing:1px}@media print{.toolbar{display:none}.sheet{max-width:none}}
  </style></head><body><div class="toolbar"><button onclick="window.print()">שמירה / הדפסה ל-PDF</button></div><main class="sheet">
  <div class="head"><div></div><div class="headTitle"><h1>קבוצת מאיה</h1><small>איתור ומיפוי תשתיות תת קרקעיות</small></div><img src="${logoUrl}" alt="מאיה"></div>
  <div class="diaryTitle">יומן עבודה מס׳ ${diary.diary_number}</div><div class="topline"><span>תאריך: ${new Date(form.work_date).toLocaleDateString("he-IL")}</span></div>
  <div class="box">${projectRows}</div>
  ${workSection}${leakSection}${servicesSection}
  <div class="box signatures"><div class="signature"><b>נציג הלקוח</b><p>שם: ${escapeHtml(form.customer_name)}</p>${hasValue(form.customer_phone) ? `<p>טלפון: ${escapeHtml(form.customer_phone)}</p>` : ""}<img src="${safeSignature(diary.customer_signature)}" alt="חתימת נציג הלקוח"></div><div class="signature"><b>ראש צוות מאיה</b><p>שם: ${escapeHtml(form.team_lead_name)}</p>${hasValue(form.team_lead_phone) ? `<p>טלפון: ${escapeHtml(form.team_lead_phone)}</p>` : ""}<img src="${safeSignature(diary.team_lead_signature)}" alt="חתימת ראש צוות מאיה"></div></div>
  ${hasValue(form.additional_notes) ? `<div class="box footerNotes"><div class="sectionTitle">הערות נוספות</div><div class="value">${escapeHtml(form.additional_notes)}</div></div>` : ""}<div class="brandFooter"><b>UNCOVER THE COVERED</b>צור יגאל, בזלת 14 · www.maya-tm.com · office@maya-tm.com</div>
  </main></body></html>`;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
