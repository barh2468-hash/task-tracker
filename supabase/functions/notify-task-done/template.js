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
  ],
};
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
export function taskReportEmail({ report, project_name, worker_name, links = [], appUrl = '' }) {
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
  const html = `<!doctype html><html lang="${language}" dir="${direction}"><head><meta charset="utf-8"><title>${escapeHtml(w[0])}</title></head><body><div lang="${language}" dir="${direction}" style="font-family:Arial,sans-serif;line-height:1.7;color:#0b2348;max-width:680px;margin:auto;padding:24px">
 <h1 style="font-size:24px">${escapeHtml(w[0])} — ${escapeHtml(status)}</h1>
 ${fields.map(([key, value]) => `<h2 style="font-size:16px;margin-bottom:4px">${escapeHtml(key)}</h2><p style="white-space:pre-wrap;margin-top:0">${escapeHtml(value)}</p>`).join('')}
 ${report.ready_for_drafting ? `<p><strong>${escapeHtml(w[10])}</strong></p>` : ''}${report.outcome !== 'completed' ? `<p>${escapeHtml(w[15])}</p>` : ''}
 ${links.length ? `<h2 style="font-size:16px">${escapeHtml(w[11])}</h2><ul>${links.map((link) => (link.url ? `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.name)}</a></li>` : `<li>${escapeHtml(link.name)} — ${escapeHtml(w[16])}</li>`)).join('')}</ul><p>${escapeHtml(w[14])}</p>` : ''}
 ${url ? `<p><a href="${escapeHtml(url)}">${escapeHtml(w[13])}</a></p>` : ''}</div></body></html>`;
  return {
    subject: `${w[0]} — ${status}: ${project_name} — ${report.request_title}`.replace(
      /[\r\n]+/g,
      ' ',
    ),
    html,
    text,
  };
}
