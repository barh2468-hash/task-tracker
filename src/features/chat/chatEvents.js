// Project rooms receive "event" lines from database triggers (status, photos,
// files, tasks). The stored body is a Hebrew fallback; the UI renders the
// localized text from event_type + event_data instead.
export function chatEventText(eventType, eventData, translate, fallback = '') {
  const data = eventData || {};
  const count = Number(data.count || 1);
  switch (eventType) {
    case 'status_changed':
      return data.from && data.from === data.to
        ? translate('עדכון בפרויקט')
        : translate('הסטטוס עודכן ל־{{value0}}', { value0: translate(data.to || '') });
    case 'photo_added':
      return count > 1
        ? translate('נוספו {{value0}} תמונות', { value0: count })
        : translate('נוספה תמונה');
    case 'document_added':
      return count > 1
        ? translate('נוספו {{value0}} קבצים', { value0: count })
        : translate('נוסף קובץ: {{value0}}', { value0: data.file_name || '' });
    case 'task_added':
      return translate('משימה חדשה: {{value0}}', { value0: data.title || '' });
    case 'task_completed':
      return translate('משימה הושלמה: {{value0}}', { value0: data.title || '' });
    default:
      return fallback;
  }
}

// The note written with a status update, shown under the event line.
export function chatEventNote(eventType, eventData) {
  return eventType === 'status_changed' ? String(eventData?.note || '').trim() : '';
}

// A project link sent without text is saved with this stand-in body (the
// database requires one; push notifications and list previews show it). The
// bubble already shows the project card, so the stand-in is not repeated there.
export function projectReferenceBody(label) {
  return `הפניה לפרויקט: ${label}`;
}

export function isProjectReferenceOnly(message) {
  return Boolean(
    message?.project_id && message.body === projectReferenceBody(message.project_label),
  );
}
