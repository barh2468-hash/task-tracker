import { escapeHtml } from '../../../utils/escapeHtml.js';
import { mapsLink } from '../../../utils/format.js';

export function exportProjectPdf(project, historyItems) {
  const tasks = project.project_tasks || [];
  const photos = project.project_photos || [];
  const reviewFiles = project.project_review_files || [];
  const sessions = project.work_sessions || [];
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>דוח פרויקט - ${escapeHtml(project.name)}</title><style>
    body{font-family:Arial,sans-serif;margin:32px;color:#10213f;direction:rtl}h1{color:#071e41;margin:0 0 8px}.meta{color:#64748b;margin-bottom:24px}.box{border:1px solid #dfe8f2;border-radius:14px;padding:16px;margin:14px 0}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.badge{display:inline-block;border-radius:999px;background:#eef6ff;padding:6px 12px;font-weight:bold}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border-bottom:1px solid #e5edf5;padding:9px;text-align:right;vertical-align:top}th{background:#f3f7fb}@media print{button{display:none}body{margin:18px}}
  </style></head><body><button onclick="window.print()" style="float:left;padding:10px 16px;border:0;border-radius:10px;background:#071e41;color:#fff;font-weight:bold">שמירה / הדפסה ל-PDF</button>
  <h1>דוח פרויקט</h1><div class="meta">הופק בתאריך ${new Date().toLocaleString("he-IL")}</div>
  <div class="box"><h2>${escapeHtml(project.name)}</h2><div class="grid"><div><b>לקוח:</b> ${escapeHtml(project.client_name || "-")}</div><div><b>מיקום:</b> ${escapeHtml(project.location || "-")}</div><div><b>טלפון איש קשר:</b> ${escapeHtml(project.contact_phone || "-")}</div><div><b>מייל איש קשר:</b> ${escapeHtml(project.contact_email || "-")}</div><div><b>סטטוס:</b> <span class="badge">${escapeHtml(project.status)}</span></div><div><b>עובד אחראי:</b> ${escapeHtml(project.profiles?.full_name || "לא משויך")}</div><div><b>תאריך יעד:</b> ${project.due_date ? new Date(project.due_date).toLocaleDateString("he-IL") : "-"}</div><div><b>התקדמות:</b> ${project.progress}%</div></div><p><b>תיאור:</b> ${escapeHtml(project.description || "-")}</p></div>
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
