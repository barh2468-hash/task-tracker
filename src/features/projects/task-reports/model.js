import { MAX_PROJECT_FILE_SIZE, isPdfFile, isSupportedImageFile } from '../utils/projectFiles.js';

export const outcomeLabels = {
  completed: 'הושלם',
  partial: 'בוצע חלקית',
  blocked: 'לא בוצע — נדרשת הבהרה',
  reopened: 'נפתח מחדש',
};

export function validateTaskReport(report) {
  if (!Object.hasOwn(outcomeLabels, report.outcome)) return 'יש לבחור מצב ביצוע.';
  if (report.summary.trim().length < 5)
    return 'יש לפרט מה בוצע או מדוע לא ניתן לבצע (לפחות 5 תווים).';
  if (report.summary.length > 4000 || report.next_steps.length > 4000)
    return 'הפירוט ארוך מדי. ניתן להזין עד 4,000 תווים בכל שדה.';
  if (['partial', 'blocked'].includes(report.outcome) && report.next_steps.trim().length < 5)
    return 'יש לפרט מה נשאר להמשך או איזו הבהרה נדרשת.';
  if (report.ready_for_drafting && !['completed', 'partial'].includes(report.outcome))
    return 'ניתן להעביר לשרטוט רק עבודה שבוצעה באופן מלא או חלקי.';
  if ((report.files?.length || 0) + (report.document_ids?.length || 0) > 10)
    return 'ניתן לצרף עד 10 קבצים לדיווח.';
  for (const { file } of report.files || []) {
    if (
      !file.size ||
      file.size > MAX_PROJECT_FILE_SIZE ||
      !(isPdfFile(file) || isSupportedImageFile(file))
    )
      return 'יש לצרף תמונה או PDF תקינים, עד 20MB לכל קובץ.';
  }
  return '';
}

export function latestTaskReport(task) {
  return (
    (task.project_task_reports || []).find((report) => report.id === task.latest_report_id) ||
    [...(task.project_task_reports || [])].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    )[0]
  );
}
