import { csvEscape } from '../../../utils/format.js';

export function daysBetween(dateText) {
  if (!dateText) return 0;
  const date = new Date(dateText);
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export function buildProjectExceptions(projects) {
  const exceptions = [];
  for (const project of projects) {
    if (!project.assigned_to) {
      exceptions.push({
        project,
        type: 'unassigned',
        title: 'פרויקט ללא שיוך לעובד',
        description: 'הפרויקט קיים במערכת אך עדיין לא שויך לעובד שטח.',
        descriptionKey: 'הפרויקט קיים במערכת אך עדיין לא שויך לעובד שטח.',
        severity: 'high',
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
        type: 'open_work',
        title: 'עבודה פתוחה ללא סיום',
        description: `קיימת שעת התחלה פתוחה כבר ${hours} שעות. מומלץ לוודא שהעובד סיים עבודה.`,
        descriptionKey: 'קיימת שעת התחלה פתוחה כבר {{hours}} שעות. מומלץ לוודא שהעובד סיים עבודה.',
        descriptionValues: { hours },
        severity: hours >= 10 ? 'high' : 'medium',
      });
    }
    const staleDays = daysBetween(project.updated_at);
    if (project.status !== 'הושלם' && staleDays >= 4) {
      exceptions.push({
        project,
        type: 'stale_project',
        title: 'פרויקט ללא עדכון מספר ימים',
        description: `הפרויקט לא עודכן כבר ${staleDays} ימים.`,
        descriptionKey: 'הפרויקט לא עודכן כבר {{days}} ימים.',
        descriptionValues: { days: staleDays },
        severity: staleDays >= 7 ? 'high' : 'medium',
      });
    }
    if (project.status === 'מחכה להיתרים' && staleDays >= 7) {
      exceptions.push({
        project,
        type: 'permits_wait',
        title: 'מחכה להיתרים זמן ממושך',
        description: `הפרויקט בסטטוס מחכה להיתרים כבר ${staleDays} ימים מאז העדכון האחרון.`,
        descriptionKey: 'הפרויקט בסטטוס מחכה להיתרים כבר {{days}} ימים מאז העדכון האחרון.',
        descriptionValues: { days: staleDays },
        severity: 'medium',
      });
    }
    for (const task of project.project_tasks || []) {
      const taskDays = daysBetween(task.created_at);
      if (!task.is_done && taskDays >= 7) {
        exceptions.push({
          project,
          type: 'old_task',
          title: 'משימה פתוחה יותר מדי זמן',
          description: `המשימה "${task.title}" פתוחה כבר ${taskDays} ימים.`,
          descriptionKey: 'המשימה "{{title}}" פתוחה כבר {{days}} ימים.',
          descriptionValues: { title: task.title, days: taskDays },
          severity: taskDays >= 14 ? 'high' : 'low',
        });
      }
    }
  }
  return exceptions;
}

export function exportExceptionsCsv(exceptions) {
  if (!exceptions.length) return;
  const headers = [
    'סוג חריגה',
    'פרויקט',
    'לקוח',
    'מיקום',
    'עובד',
    'תיאור',
    'חומרה',
  ];
  const rows = exceptions.map((item) => [
    item.title,
    item.project.name,
    item.project.client_name || '',
    item.project.location,
    item.project.profiles?.full_name || 'לא משויך',
    item.description,
    item.severity,
  ]);
  const csv =
    '﻿' +
    [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `דוח-חריגות-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
