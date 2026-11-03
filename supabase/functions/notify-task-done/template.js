import {
  escapeHtml,
  highlightBlock,
  noteBlock,
  renderProjectEmail,
} from '../_shared/project-email.ts';
import { getStatusEmailTheme } from '../_shared/status-email-theme.ts';
export { escapeHtml } from '../_shared/project-email.ts';

const words = {
  he: [
    'דיווח ביצוע משימה',
    'הושלם',
    'בוצע חלקית',
    'לא בוצע — נדרשת הבהרה',
    'נפתח מחדש',
    'פרויקט',
    'הבקשה המקורית',
    'דיווח העובד',
    'המשך טיפול',
    'הפניה לקובץ קיים',
    'מוכן לשרטוט',
    'קבצים מצורפים',
    'דווח על ידי',
    'פתיחת המשימה במערכת',
    'קישורי הקבצים זמינים ל־7 ימים. לאחר מכן ניתן לפתוח את הקבצים מתוך הפרויקט.',
    'המשימה נשארת פתוחה להמשך טיפול.',
    'הקובץ אינו זמין כעת. יש לבדוק במסמכי הפרויקט.',
    'מצב הביצוע',
    'דווח בתאריך',
    'תפוצה',
    'כל המנהלים — עותק נפרד לכל נמען',
  ],
  en: [
    'Task execution report',
    'Completed',
    'Partially completed',
    'Not completed — clarification needed',
    'Reopened',
    'Project',
    'Original request',
    'Worker report',
    'Follow-up',
    'Existing file reference',
    'Ready for drafting',
    'Attached files',
    'Reported by',
    'Open task in the app',
    'File links are valid for 7 days. After that, open files from the project.',
    'The task remains open for follow-up.',
    'The file is currently unavailable. Check project documents.',
    'Execution status',
    'Reported at',
    'Recipients',
    'All managers — a separate copy for each recipient',
  ],
  el: [
    'Αναφορά εκτέλεσης εργασίας',
    'Ολοκληρώθηκε',
    'Μερική ολοκλήρωση',
    'Δεν εκτελέστηκε — απαιτείται διευκρίνιση',
    'Άνοιξε ξανά',
    'Έργο',
    'Αρχικό αίτημα',
    'Αναφορά εργαζομένου',
    'Συνέχεια',
    'Αναφορά σε υπάρχον αρχείο',
    'Έτοιμο για σχεδίαση',
    'Συνημμένα αρχεία',
    'Αναφορά από',
    'Άνοιγμα εργασίας στην εφαρμογή',
    'Οι σύνδεσμοι ισχύουν για 7 ημέρες. Έπειτα ανοίξτε τα αρχεία από το έργο.',
    'Η εργασία παραμένει ανοιχτή για συνέχεια.',
    'Το αρχείο δεν είναι διαθέσιμο. Ελέγξτε τα έγγραφα του έργου.',
    'Κατάσταση εκτέλεσης',
    'Ημερομηνία αναφοράς',
    'Παραλήπτες',
    'Όλοι οι διαχειριστές — ξεχωριστό αντίγραφο για κάθε παραλήπτη',
  ],
};
export function taskReportEmail({
  report,
  project_name,
  client_name,
  location,
  worker_name,
  links = [],
  appUrl = '',
}) {
  const language = Object.hasOwn(words, report.language) ? report.language : 'en',
    w = words[language],
    direction = language === 'he' ? 'rtl' : 'ltr';
  const status = w[{ completed: 1, partial: 2, blocked: 3, reopened: 4 }[report.outcome]];
  const fields = [
    [w[5], project_name],
    [
      w[6],
      `${report.request_title}${report.request_description ? `\n${report.request_description}` : ''}`,
    ],
    [w[7], report.summary],
    ...(report.next_steps ? [[w[8], report.next_steps]] : []),
    ...(report.file_reference ? [[w[9], report.file_reference]] : []),
    [w[12], worker_name],
  ];
  const url = appUrl
    ? `${new URL(appUrl).origin}/app/projects?project=${encodeURIComponent(report.project_id)}&tab=tasks`
    : '';
  const text = [
    `${w[0]} — ${status}`,
    ...fields.map(([key, value]) => `${key}: ${value}`),
    report.ready_for_drafting ? w[10] : '',
    report.outcome !== 'completed' ? w[15] : '',
    ...links.map((link) => `${link.name}: ${link.url || w[16]}`),
    links.length ? w[14] : '',
    url ? `${w[13]}: ${url}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const theme = getStatusEmailTheme(
    { completed: 'הושלם', partial: 'בעבודה בשטח', blocked: 'נשלח להגהה', reopened: 'ממתין לתיאום' }[
      report.outcome
    ],
  );
  const content = (value) =>
    `<div dir="auto" style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(value).replace(/\r?\n/g, '<br/>')}</div>`;
  const blocks = [
    highlightBlock(
      theme,
      `<div style="margin-bottom:8px;font-size:12px;font-weight:700">${escapeHtml(w[17])}</div><span style="display:inline-block;padding:7px 12px;border:1px solid ${theme.border};border-radius:999px;background:${theme.background};color:${theme.text};font-weight:700">${escapeHtml(status)}</span>${report.outcome !== 'completed' ? `<p style="margin:9px 0 0">${escapeHtml(w[15])}</p>` : ''}`,
      direction,
    ),
    noteBlock(
      w[6],
      `<strong>${escapeHtml(report.request_title)}</strong>${report.request_description ? content(report.request_description) : ''}`,
    ),
    noteBlock(w[7], content(report.summary)),
    ...(report.next_steps ? [noteBlock(w[8], content(report.next_steps))] : []),
    ...(report.file_reference ? [noteBlock(w[9], content(report.file_reference))] : []),
    ...(report.ready_for_drafting
      ? [
          highlightBlock(
            getStatusEmailTheme('עבר לשרטוט'),
            `<strong>${escapeHtml(w[10])}</strong>`,
            direction,
          ),
        ]
      : []),
    ...(links.length
      ? [
          noteBlock(
            w[11],
            `<ul style="margin:0;padding-inline-start:20px">${links.map((link) => (link.url ? `<li><a style="color:#0b5fa5" href="${escapeHtml(link.url)}">${escapeHtml(link.name)}</a></li>` : `<li>${escapeHtml(link.name)} — ${escapeHtml(w[16])}</li>`)).join('')}</ul><p style="margin:8px 0 0;font-size:12px">${escapeHtml(w[14])}</p>`,
          ),
        ]
      : []),
  ];
  const reportedAt =
    report.created_at && Number.isFinite(Date.parse(report.created_at))
      ? new Intl.DateTimeFormat({ he: 'he-IL', en: 'en-GB', el: 'el-GR' }[language], {
          timeZone: 'Asia/Jerusalem',
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(report.created_at))
      : '';
  const card = renderProjectEmail({
    language,
    theme,
    title: w[0],
    icon: report.outcome === 'reopened' ? '↻' : '✓',
    projectName: project_name,
    clientName: client_name,
    location,
    blocks,
    details: [
      { label: w[12], value: worker_name },
      ...(reportedAt ? [{ label: w[18], value: reportedAt }] : []),
      { label: w[19], value: w[20] },
    ],
    appUrl: url,
    actionLabel: w[13],
  });
  const html = `<!doctype html><html lang="${language}" dir="${direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(w[0])}</title></head><body style="margin:0;padding:0;background:#eef4fa">${card}</body></html>`;
  return {
    subject: `${w[0]} — ${status}: ${project_name} — ${report.request_title}`.replace(
      /[\r\n]+/g,
      ' ',
    ),
    html,
    text: `${text}\n\n${w[19]}: ${w[20]}`,
  };
}
