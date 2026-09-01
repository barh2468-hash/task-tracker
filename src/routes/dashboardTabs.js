// Maps the old tab-state titles/subtitles onto the new route paths, since
// the sidebar/hero title logic in the original page.tsx switched on a local
// `tab` variable instead of a URL.
export function getTabTitle(pathname, searchParams, isManager) {
  if (pathname === '/app/map') return 'מפה חיה';
  if (pathname === '/app/status-report') return 'דו״ח מצב פרויקטים';
  if (pathname === '/app/assignments') return 'פרויקטים משויכים';
  if (pathname === '/app/tasks') return 'משימות פתוחות';
  if (pathname === '/app/today') return 'היום בשטח';
  if (pathname === '/app/exceptions') return 'דוח חריגות';
  if (pathname === '/app/projects/new') return 'הוספת פרויקט';
  if (pathname === '/app/history') return 'היסטוריית שינויים';
  if (pathname === '/app/report') return 'דוח שעות עובדים';
  if (pathname === '/app/notifications') return 'התראות';
  if (pathname === '/app/projects') {
    const filter = searchParams.get('filter') || (isManager ? 'all' : 'mine');
    if (filter === 'all') return 'כל הפרויקטים';
    if (filter === 'unassigned') return 'פרויקטים ללא שיוך';
    if (filter === 'archive') return 'ארכיון פרויקטים';
    return 'הפרויקטים שלי';
  }
  return '';
}

export function getTabSubtitle(isManager, isDrafter) {
  if (isManager) return 'תצוגת ניהול מלאה לפרויקטים, משימות, עובדים והתראות';
  if (isDrafter) return 'תצוגת שרטט לפרויקטים שעברו לשרטוט ושליחה להגהה';
  return 'תצוגת עובד שטח לפרויקטים, שעות עבודה ומשימות';
}

export function isHeroSuppressed(pathname) {
  return pathname === '/app/map' || pathname === '/app/status-report';
}
