import { escapeHtml } from "../../../utils/escapeHtml.js";
import { workKinds, leakKinds } from "./helpers.js";
import { localeForLanguage } from '../../language/locale.js';

export function exportWorkDiaryPdf(project, diary, { language, t }) {
  const locale = localeForLanguage(language);
  const direction = language === 'he' ? 'rtl' : 'ltr';
  const text = (key, options) => escapeHtml(t(key, options));
  const form = diary.form_data;
  const logoUrl = `${window.location.origin}/logo.png`;
  const safeSignature = (value) => (typeof value === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value) ? value : "");
  const hasValue = (value) => String(value ?? "").trim().length > 0;
  const row = (label, value) =>
    hasValue(value)
      ? `<div class="row"><b class="label">${text(label)}</b><span class="value" dir="auto">${escapeHtml(value)}</span></div>`
      : "";
  const metric = (label, value) =>
    hasValue(value)
      ? `<div class="metric"><b>${text(label)}</b><span dir="auto">${escapeHtml(value)}</span></div>`
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
  const workSection =
    selectedWorkKinds.length || workMetrics.length
      ? `<div class="box"><div class="sectionTitle">${text('איתור תשתיות תת-קרקעיות / שאיבת עפר / ביקון / מכשיר GPR')}</div><div class="scope">${selectedWorkKinds.length ? `<div class="checks">${selectedWorkKinds.map((kind) => `<div>☑ ${text(kind.label)}</div>`).join("")}</div>` : ""}${workMetrics.length ? `<div class="metrics">${workMetrics.join("")}</div>` : ""}</div></div>`
      : "";
  const selectedLeakKinds = leakKinds.filter((kind) => Boolean(form[kind.key]));
  const legacyLeakNotes = [form.paper_locating, form.point_page].filter(hasValue).join(" · ");
  const leakNotes = form.leak_notes || legacyLeakNotes;
  const leakSection =
    selectedLeakKinds.length || hasValue(leakNotes)
      ? `<div class="box"><div class="sectionTitle">${text('איתור דלף')}</div>${selectedLeakKinds.length ? `<div class="checks leakPdfChecks">${selectedLeakKinds.map((kind) => `<div>☑ ${text(kind.label)}</div>`).join("")}</div>` : ""}${row("הערות כלליות לאיתור דלף", leakNotes)}</div>`
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
    ? `<div class="box"><div class="sectionTitle">${text('שירותים נוספים')}</div>${serviceRows.join("")}</div>`
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
  ]
    .filter(Boolean)
    .join("");
  const number = diary.diary_number.toLocaleString(locale);
  const html = `<!doctype html><html lang="${language}" dir="${direction}"><head><meta charset="utf-8"><title>${text('יומן עבודה {{number}}', { number })}</title><style>
  @page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#111;direction:rtl;font-size:11px}.toolbar{position:sticky;top:0;display:flex;justify-content:flex-start;padding:8px 0;background:#fff}.toolbar button{padding:9px 14px;border:0;border-radius:8px;background:#071e41;color:#fff;font-weight:700}.sheet{width:100%;max-width:190mm;margin:auto}.head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-bottom:8px}.head img{width:86px;justify-self:start}.headTitle{text-align:center}.headTitle h1{font-size:24px;margin:0}.headTitle small{font-size:9px}.diaryTitle{text-align:center;font-size:22px;margin:4px 0 8px}.topline{display:flex;justify-content:flex-start;margin-bottom:7px;font-size:12px}.box{border:1.5px solid #111;margin-bottom:7px}.row{display:grid;grid-template-columns:145px 1fr;border-bottom:1px solid #111;min-height:24px}.row:last-child{border-bottom:0}.label{font-weight:700;padding:5px 7px;border-left:1px solid #111;background:#fafafa}.value{padding:5px 7px;white-space:pre-wrap}.sectionTitle{text-align:center;font-weight:800;padding:5px;border-bottom:1px solid #111;background:#f5f5f5}.scope{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.checks{padding:7px;line-height:1.8}.scope>.checks+.metrics,.scope>.metrics+.checks{border-right:1px solid #111}.leakPdfChecks{display:flex;gap:18px;flex-wrap:wrap;border-bottom:1px solid #111}.metrics{padding:0}.metric{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #111}.metric:last-child{border-bottom:0}.metric span{padding:4px 6px}.metric b{padding:4px 6px;border-left:1px solid #111}.signatures{display:grid;grid-template-columns:1fr 1fr}.signature{padding:7px;min-height:125px}.signature:first-child{border-left:1px solid #111}.signature img{width:100%;height:62px;object-fit:contain;border-bottom:1px solid #777}.signature p{margin:3px 0}.footerNotes{min-height:55px}.brandFooter{text-align:center;margin-top:8px;font-size:9px}.brandFooter b{display:block;font-size:18px;letter-spacing:1px}@media print{.toolbar{display:none}.sheet{max-width:none}}
  body{direction:${direction}}.label,.metric b{border-left:0;border-inline-end:1px solid #111}.signature:first-child{border-left:0;border-inline-end:1px solid #111}.scope>.checks+.metrics,.scope>.metrics+.checks{border-right:0;border-inline-start:1px solid #111}
  </style></head><body><div class="toolbar"><button onclick="window.print()">${text('שמירה / הדפסה ל-PDF')}</button></div><main class="sheet">
  <div class="head"><div></div><div class="headTitle"><h1>${text('קבוצת מאיה')}</h1><small>${text('איתור ומיפוי תשתיות תת קרקעיות')}</small></div><img src="${logoUrl}" alt="${text('מאיה')}"></div>
  <div class="diaryTitle">${text('יומן עבודה מס׳ {{number}}', { number })}</div><div class="topline"><span>${text('תאריך: {{date}}', { date: new Date(`${form.work_date}T12:00:00`).toLocaleDateString(locale) })}</span></div>
  <div class="box">${projectRows}</div>
  ${workSection}${leakSection}${servicesSection}
  <div class="box signatures"><div class="signature"><b>${text('נציג הלקוח')}</b><p>${text('שם: {{name}}', { name: form.customer_name })}</p>${hasValue(form.customer_phone) ? `<p>${text('טלפון: {{phone}}', { phone: form.customer_phone })}</p>` : ""}<img src="${safeSignature(diary.customer_signature)}" alt="${text('חתימת נציג הלקוח')}"></div><div class="signature"><b>${text('ראש צוות מאיה')}</b><p>${text('שם: {{name}}', { name: form.team_lead_name })}</p>${hasValue(form.team_lead_phone) ? `<p>${text('טלפון: {{phone}}', { phone: form.team_lead_phone })}</p>` : ""}<img src="${safeSignature(diary.team_lead_signature)}" alt="${text('חתימת ראש צוות מאיה')}"></div></div>
  ${hasValue(form.additional_notes) ? `<div class="box footerNotes"><div class="sectionTitle">${text('הערות נוספות')}</div><div class="value" dir="auto">${escapeHtml(form.additional_notes)}</div></div>` : ""}<div class="brandFooter"><b>UNCOVER THE COVERED</b>${text('צור יגאל, בזלת 14')} · www.maya-tm.com · office@maya-tm.com</div>
  </main></body></html>`;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
