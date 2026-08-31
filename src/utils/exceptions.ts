import type { Project, ProjectException } from "@/src/types";
import { daysBetween } from "./dates";

export function buildProjectExceptions(projects: Project[]): ProjectException[] {
  const exceptions: ProjectException[] = [];
  for (const project of projects) {
    if (!project.assigned_to) {
      exceptions.push({
        project,
        type: "unassigned",
        title: "פרויקט ללא שיוך לעובד",
        description: "הפרויקט קיים במערכת אך עדיין לא שויך לעובד שטח.",
        severity: "high",
      });
    }
    const openSessions = (project.work_sessions || []).filter((session) => !session.ended_at);
    for (const session of openSessions) {
      const hours =
        Math.round(((Date.now() - new Date(session.started_at).getTime()) / 3600000) * 10) / 10;
      exceptions.push({
        project,
        type: "open_work",
        title: "עבודה פתוחה ללא סיום",
        description: `קיימת שעת התחלה פתוחה כבר ${hours} שעות. מומלץ לוודא שהעובד סיים עבודה.`,
        severity: hours >= 10 ? "high" : "medium",
      });
    }
    const staleDays = daysBetween(project.updated_at);
    if (project.status !== "הושלם" && staleDays >= 4) {
      exceptions.push({
        project,
        type: "stale_project",
        title: "פרויקט ללא עדכון מספר ימים",
        description: `הפרויקט לא עודכן כבר ${staleDays} ימים.`,
        severity: staleDays >= 7 ? "high" : "medium",
      });
    }
    if (project.status === "מחכה להיתרים" && staleDays >= 7) {
      exceptions.push({
        project,
        type: "permits_wait",
        title: "מחכה להיתרים זמן ממושך",
        description: `הפרויקט בסטטוס מחכה להיתרים כבר ${staleDays} ימים מאז העדכון האחרון.`,
        severity: "medium",
      });
    }
    for (const task of project.project_tasks || []) {
      const taskDays = daysBetween(task.created_at);
      if (!task.is_done && taskDays >= 7) {
        exceptions.push({
          project,
          type: "old_task",
          title: "משימה פתוחה יותר מדי זמן",
          description: `המשימה "${task.title}" פתוחה כבר ${taskDays} ימים.`,
          severity: taskDays >= 14 ? "high" : "low",
        });
      }
    }
  }
  return exceptions;
}
