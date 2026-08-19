import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import { PDFDocument, PDFFont, PDFPage, rgb } from 'npm:pdf-lib@1.17.1';

type WorkDiary = {
  diary_number: number;
  form_data: Record<string, unknown>;
  customer_signature: string;
  team_lead_signature: string;
  signed_at: string;
};

type ProjectSummary = {
  name: string;
  clientName?: string | null;
  location?: string | null;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 38;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FONT_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanshebrew/NotoSansHebrew%5Bwdth%2Cwght%5D.ttf';

let fontBytesPromise: Promise<Uint8Array> | null = null;

async function loadFontBytes() {
  if (!fontBytesPromise) {
    fontBytesPromise = fetch(FONT_URL).then(async (response) => {
      if (!response.ok) throw new Error(`Hebrew font download failed: ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    });
  }
  return fontBytesPromise;
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function printableRtl(value: unknown) {
  const text = String(value ?? '');
  if (!/[\u0590-\u05FF]/.test(text)) return text;
  return text.replace(/[A-Za-z0-9@._:/+%()-]+/g, (run) => Array.from(run).reverse().join(''));
}

function textWidth(font: PDFFont, text: string, size: number) {
  return font.widthOfTextAtSize(printableRtl(text), size);
}

function wrapRtl(font: PDFFont, value: unknown, size: number, maxWidth: number) {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && textWidth(font, candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function drawRight(page: PDFPage, font: PDFFont, text: unknown, xRight: number, y: number, size = 10, color = rgb(0.06, 0.16, 0.3)) {
  const printable = printableRtl(text);
  page.drawText(printable, { x: xRight - font.widthOfTextAtSize(printable, size), y, size, font, color });
}

function selectedRows(form: Record<string, unknown>) {
  const workKinds: Array<[string, string]> = [
    ['color_marking', 'איתור וסימון בצבע / יתדות'],
    ['sketch_marking', 'איתור וסימון בסקיצה'],
    ['autocad_mapping', 'איתור ומיפוי אוטוקד'],
    ['excavation_escort', 'ליווי חפירות'],
    ['cable_fault', 'איתור תקלה בכבל'],
    ['suction_small', 'שאיבת עפר קטנה'],
    ['suction_large', 'שאיבת עפר גדולה'],
    ['gpr_usage', 'שימוש במכשיר GPR'],
  ];
  const leakKinds: Array<[string, string]> = [
    ['leak_detection', 'איתור דלף'],
    ['point_leak', 'דלף נקודתי'],
    ['depreciation_survey', 'סקר פחת'],
  ];
  const metrics: Array<[string, string]> = [
    ['infrastructure_type', 'סוג התשתית'],
    ['work_day', 'עבודה לפי יום עבודה'],
    ['area_sqm', 'גודל שטח במ״ר'],
    ['infrastructure_length', 'אורך תשתית במטר'],
    ['units_to_meter', 'כמות יחידות עד מטר'],
    ['units_over_meter', 'כמות יחידות מעל מטר'],
    ['units_depth', 'עומק'],
  ];
  const services: Array<[string, string]> = [
    ['additional_services', 'שירותים נוספים'],
    ['maya_equipment', 'מודד מטעם חברת מאיה'],
    ['customer_equipment', 'מודד מטעם מזמין העבודה'],
    ['equipment_name', 'שם המודד'],
    ['existing_map_marking', 'סימון סקיצה על גבי מפה קיימת'],
    ['miscellaneous', 'שונות'],
  ];

  return {
    work: [
      ...workKinds.filter(([key]) => Boolean(form[key])).map(([, label]) => ['סוג עבודה', label] as [string, string]),
      ...metrics.filter(([key]) => hasValue(form[key])).map(([key, label]) => [label, String(form[key])] as [string, string]),
    ],
    leak: [
      ...leakKinds.filter(([key]) => Boolean(form[key])).map(([, label]) => ['סוג איתור', label] as [string, string]),
      ...(hasValue(form.leak_notes) ? [['הערות כלליות לאיתור דלף', String(form.leak_notes)] as [string, string]] : []),
    ],
    services: services.filter(([key]) => hasValue(form[key])).map(([key, label]) => [label, String(form[key])] as [string, string]),
  };
}

export async function createWorkDiaryPdf(project: ProjectSummary, diary: WorkDiary) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await loadFontBytes(), { subset: true });
  const boldFont = font;
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - 42;

  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - 44;
    drawRight(page, boldFont, `יומן עבודה ${diary.diary_number}`, PAGE_WIDTH - MARGIN, y, 13, rgb(0.03, 0.12, 0.25));
    y -= 26;
  };

  const ensureSpace = (height: number) => {
    if (y - height < 48) addPage();
  };

  const section = (title: string, rows: Array<[string, unknown]>) => {
    const filtered = rows.filter(([, value]) => hasValue(value));
    if (!filtered.length) return;
    ensureSpace(40);
    page.drawRectangle({ x: MARGIN, y: y - 24, width: CONTENT_WIDTH, height: 25, color: rgb(0.91, 0.96, 0.98) });
    drawRight(page, boldFont, title, PAGE_WIDTH - MARGIN - 10, y - 16, 11, rgb(0.03, 0.18, 0.33));
    y -= 34;

    for (const [label, value] of filtered) {
      const labelWidth = 150;
      const valueLines = wrapRtl(font, value, 9.4, CONTENT_WIDTH - labelWidth - 24);
      const rowHeight = Math.max(28, 12 + valueLines.length * 13);
      ensureSpace(rowHeight + 2);
      page.drawRectangle({ x: MARGIN, y: y - rowHeight + 8, width: CONTENT_WIDTH, height: rowHeight, borderColor: rgb(0.82, 0.88, 0.92), borderWidth: 0.7 });
      drawRight(page, boldFont, label, PAGE_WIDTH - MARGIN - 9, y - 8, 9.2, rgb(0.08, 0.2, 0.34));
      valueLines.forEach((line, index) => drawRight(page, font, line, PAGE_WIDTH - MARGIN - labelWidth - 8, y - 8 - index * 13, 9.4));
      y -= rowHeight;
    }
    y -= 8;
  };

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 116, width: PAGE_WIDTH, height: 116, color: rgb(0.025, 0.12, 0.25) });
  drawRight(page, boldFont, 'קבוצת מאיה', PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 58, 22, rgb(1, 1, 1));
  drawRight(page, font, `יומן עבודה מס׳ ${diary.diary_number}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 88, 14, rgb(0.36, 0.83, 0.88));
  y = PAGE_HEIGHT - 142;

  const form = diary.form_data || {};
  section('פרטי הפרויקט והעבודה', [
    ['שם הפרויקט', project.name],
    ['שם המזמין', project.clientName],
    ['תאריך', form.work_date],
    ['איש קשר', form.contact_name],
    ['טלפון נייד', form.contact_phone],
    ['שעת התחלה', form.start_time],
    ['שעת סיום', form.end_time],
    ['אתר', hasValue(form.site) ? form.site : project.location],
    ['תפקיד', form.role],
  ]);

  const rows = selectedRows(form);
  section('איתור תשתיות ועבודות שבוצעו', rows.work);
  section('איתור דלף', rows.leak);
  section('שירותים נוספים', rows.services);
  section('הערות נוספות', [['הערות', form.additional_notes]]);

  const drawSignature = async (title: string, name: unknown, phone: unknown, dataUrl: string, x: number) => {
    const width = (CONTENT_WIDTH - 14) / 2;
    page.drawRectangle({ x, y: y - 112, width, height: 112, borderColor: rgb(0.76, 0.84, 0.9), borderWidth: 0.8, color: rgb(0.98, 0.995, 1) });
    drawRight(page, boldFont, title, x + width - 8, y - 17, 10.2);
    drawRight(page, font, name, x + width - 8, y - 34, 8.8);
    if (hasValue(phone)) drawRight(page, font, phone, x + width - 8, y - 49, 8.2);
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1] || ''), (char) => char.charCodeAt(0));
    const image = dataUrl.includes('image/jpeg') ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
    const dimensions = image.scaleToFit(width - 20, 48);
    page.drawImage(image, { x: x + (width - dimensions.width) / 2, y: y - 104, width: dimensions.width, height: dimensions.height });
  };

  ensureSpace(142);
  drawRight(page, boldFont, 'חתימות', PAGE_WIDTH - MARGIN, y, 12, rgb(0.03, 0.18, 0.33));
  y -= 16;
  await drawSignature('נציג הלקוח', form.customer_name, form.customer_phone, diary.customer_signature, MARGIN);
  await drawSignature('ראש צוות מאיה', form.team_lead_name, form.team_lead_phone, diary.team_lead_signature, MARGIN + (CONTENT_WIDTH + 14) / 2);
  y -= 128;

  drawRight(page, font, 'צור יגאל, בזלת 14 · www.maya-tm.com · office@maya-tm.com', PAGE_WIDTH - MARGIN, 25, 7.5, rgb(0.34, 0.42, 0.5));
  return pdf.save();
}
