import { escapeHtml } from '../../../utils/escapeHtml.js';
import { mapsLink } from '../../../utils/format.js';
import { projectWorkNotes } from './workNotes.js';
import { t } from '../../language/LanguageContext.jsx';
import { localeForLanguage } from '../../language/locale.js';

export function projectReportHtml(project, historyItems = [], language = 'he') {
  const locale = localeForLanguage(language);
  const direction = language === 'he' ? 'rtl' : 'ltr';
  const label = (key, values) => escapeHtml(t(`projectReport.${key}`, values));
  const text = (value) => escapeHtml(value || '—');
  const date = (value, dateOnly = false) => value ? escapeHtml(new Date(value)[dateOnly ? 'toLocaleDateString' : 'toLocaleString'](locale, { timeZone: 'Asia/Jerusalem' })) : '—';
  const headings = (keys) => keys.map((key) => `<th scope="col">${label(key)}</th>`).join('');
  const emptyRow = (key, columns) => `<tr><td colspan="${columns}">${label(key)}</td></tr>`;
  const tasks = project.project_tasks || [];
  const photos = project.project_photos || [];
  const reviewFiles = project.project_review_files || [];
  const sessions = project.work_sessions || [];
  const notes = projectWorkNotes(sessions);
  const map = (lat, lng) => {
    const href = mapsLink(lat, lng);
    return href ? `<a href="${escapeHtml(href)}">${label('map')}</a>` : '—';
  };
  return `<!doctype html><html lang="${escapeHtml(language)}" dir="${direction}"><head><meta charset="utf-8"><title>${label('title')} - ${text(project.name)}</title><style>
    body{font-family:Arial,sans-serif;margin:32px;color:#10213f}h1{color:#071e41;margin:0 0 8px}.meta{color:#64748b;margin-bottom:24px}.box{border:1px solid #dfe8f2;border-radius:14px;padding:16px;margin:14px 0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.badge{display:inline-block;border-radius:999px;background:#eef6ff;padding:6px 12px;font-weight:bold}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border-bottom:1px solid #e5edf5;padding:9px;text-align:start;vertical-align:top;overflow-wrap:anywhere}th{background:#f3f7fb}.userText{white-space:pre-wrap;overflow-wrap:anywhere}.workNote{break-inside:avoid;margin-block:14px}.printButton{padding:10px 16px;border:0;border-radius:10px;background:#071e41;color:#fff;font-weight:bold}@media print{button{display:none}body{margin:18px}thead{display:table-header-group}}
  </style></head><body><button class="printButton" onclick="window.print()">${label('print')}</button>
  <h1>${label('title')}</h1><div class="meta">${label('generated', { date: new Date().toLocaleString(locale, { timeZone: 'Asia/Jerusalem' }) })}</div>
  <div class="box"><h2 dir="auto">${text(project.name)}</h2><div class="grid">
    <div><b>${label('client')}:</b> <bdi>${text(project.client_name)}</bdi></div>
    <div><b>${label('location')}:</b> <bdi>${text(project.location)}</bdi></div>
    <div style="grid-column:1/-1"><b>${label('contacts')}:</b><div class="userText" dir="auto">${text([project.contact_phone, project.contact_email].filter(Boolean).join('\n'))}</div></div>
    <div><b>${label('status')}:</b> <span class="badge">${text(t(project.status))}</span></div>
    <div><b>${label('owner')}:</b> <bdi>${text(project.profiles?.full_name || t('לא משויך'))}</bdi></div>
    <div><b>${label('progress')}:</b> ${escapeHtml(new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format((project.progress || 0) / 100))}</div>
  </div><p><b>${label('description')}:</b></p><p class="userText" dir="auto">${text(project.description)}</p>${project.additional_notes ? `<p><b>${label('additionalNotes')}:</b></p><p class="userText" dir="auto">${text(project.additional_notes)}</p>` : ''}</div>
  <div class="box"><h2>${escapeHtml(t('projectWorkNotes.title'))}</h2>${notes.length ? notes.map((session) => `<div class="workNote"><bdi>${text(session.profiles?.full_name || t('עובד'))}</bdi> · ${date(session.started_at)}<p class="userText" dir="auto">${text(session.end_note)}</p></div>`).join('') : `<p>${escapeHtml(t('projectWorkNotes.empty'))}</p>`}</div>
  <div class="box"><h2>${label('tasks')}</h2><table><thead><tr>${headings(['task', 'status', 'description', 'date'])}</tr></thead><tbody>${tasks.length ? tasks.map((task) => `<tr><td dir="auto">${text(task.title)}</td><td>${label(task.is_done ? 'done' : 'open')}</td><td class="userText" dir="auto">${text(task.description)}</td><td>${date(task.created_at, true)}</td></tr>`).join('') : emptyRow('noTasks', 4)}</tbody></table></div>
  <div class="box"><h2>${label('workHours')}</h2><table><thead><tr>${headings(['reporter', 'start', 'end', 'crew', 'note', 'startLocation', 'endLocation'])}</tr></thead><tbody>${sessions.length ? sessions.map((session) => `<tr><td dir="auto">${text(session.profiles?.full_name || t('עובד'))}</td><td>${date(session.started_at)}</td><td>${session.ended_at ? date(session.ended_at) : label('open')}</td><td dir="auto">${text(session.crew_members?.map((member) => member.name).join(', '))}</td><td class="userText" dir="auto">${text(session.end_note)}</td><td>${map(session.started_lat, session.started_lng)}</td><td>${map(session.ended_lat, session.ended_lng)}</td></tr>`).join('') : emptyRow('noHours', 7)}</tbody></table></div>
  <div class="box"><h2>${label('photos')}</h2>${photos.length ? `<ul>${photos.map((photo) => `<li>${text(t(photo.category || 'תמונת שטח'))} · ${date(photo.created_at)}</li>`).join('')}</ul>` : label('noPhotos')}</div>
  <div class="box"><h2>${label('reviewFiles')}</h2>${reviewFiles.length ? `<ul>${reviewFiles.map((file) => `<li><bdi>${text(file.file_name || 'PDF')}</bdi> · ${date(file.created_at)}</li>`).join('')}</ul>` : label('noReviewFiles')}</div>
  <div class="box"><h2>${label('updates')}</h2>${historyItems.length ? `<ul>${historyItems.map((item) => `<li><b>${text(t(item.new_status))}</b> · ${date(item.created_at)}${item.note ? `<p class="userText" dir="auto">${text(item.note)}</p>` : ''}</li>`).join('')}</ul>` : label('noUpdates')}</div>
  </body></html>`;
}

export function exportProjectPdf(project, historyItems, language = 'he') {
  const html = projectReportHtml(project, historyItems, language);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
