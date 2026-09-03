import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const LanguageContext = createContext(null);

const translations = {
  'מערכת איתור תשתיות': 'Infrastructure Tracking System',
  'מעקב פרויקטים לעובדי שטח, שרטוט, GPR והיתרים': 'Project tracking for field teams, drafting, GPR and permits',
  'התראות': 'Notifications',
  'תפריט': 'Menu',
  'פתיחת תפריט': 'Open menu',
  'סגירת תפריט': 'Close menu',
  'סגירת הודעה': 'Close message',
  'תפריט ראשי': 'Main menu',
  'עבודה': 'Work',
  'שטח': 'Field',
  'ניהול ומידע': 'Management & information',
  'כל הפרויקטים': 'All projects',
  'משימות פתוחות': 'Open tasks',
  'פרויקטים משויכים': 'Assigned projects',
  'היום בשטח': 'Field activity today',
  'מפה חיה': 'Live map',
  'דוח חריגות': 'Exceptions report',
  'דו״ח מצב פרויקטים': 'Project status report',
  'ללא שיוך': 'Unassigned',
  'ארכיון': 'Archive',
  'הוספת פרויקט': 'Add project',
  'היסטוריית שינויים': 'Change history',
  'משתמש': 'User',
  'מנהל מערכת': 'System manager',
  'עובד שטח': 'Field worker',
  'שרטט': 'Drafter',
  'תשתיות': 'Advanced',
  'מתקדמות': 'Infrastructure',
  'מותאם לאייפון, אנדרואיד ומחשב. עדכונים בזמן אמת דרך Supabase.': 'Optimized for iPhone, Android and desktop. Real-time updates via Supabase.',
  'חיפוש לפי שם, לקוח או מיקום...': 'Search by name, client or location...',
  'חיפוש פרויקטים': 'Search projects',
  'סינון לפי סטטוס': 'Filter by status',
  'כל הסטטוסים': 'All statuses',
  'סינון': 'Filter',
  'אין פרויקטים להצגה כרגע': 'No projects to display',
  'ארכיון פרויקטים': 'Project archive',
  'הפרויקטים שלי': 'My projects',
  'בעבודה בשטח': 'Field work',
  'עבר לשרטוט': 'Sent to drafting',
  'נדרש GPR': 'GPR required',
  'מחכה להיתרים': 'Waiting for permits',
  'נשלח להגהה': 'Sent for review',
  'הושלם': 'Completed',
  'בארכיון': 'Archived',
  'לא הוגדר': 'Not set',
  'ללא לקוח': 'No client',
  'אין תיאור': 'No description',
  'לא משויך': 'Unassigned',
  'עובד אחראי': 'Lead worker',
  'עובדים נוספים': 'Additional workers',
  'שרטט משויך': 'Assigned drafter',
  'עריכה': 'Edit',
  'שחזור': 'Restore',
  'מחיקה': 'Delete',
  'העבר לארכיון': 'Move to archive',
  'דוח PDF': 'PDF report',
  'עודכן': 'Updated',
  'התקדמות': 'Progress',
  'יעד': 'Due',
  'עבודה פעילה': 'Active work',
  'התחלה': 'Start',
  'סיים עבודה': 'Finish work',
  'שעות עבודה': 'Work hours',
  'לא נרשמה עבודה פתוחה': 'No open work session',
  'התחל עבודה': 'Start work',
  'עבודות פעילות נוספות': 'Other active sessions',
  'הערה לעדכון, אופציונלי': 'Optional update note',
  'עדכן סטטוס': 'Update status',
  'העלאת תמונה': 'Upload photo',
  'סוג תמונה': 'Photo type',
  'תמונת שטח': 'Field photo',
  'תשתית שנמצאה': 'Infrastructure found',
  'בעיה / חסם': 'Issue / blocker',
  'סימון בשטח': 'Field marking',
  'אישור סיום': 'Completion proof',
  'אחר': 'Other',
  'עדכונים אחרונים': 'Recent updates',
  'אין עדכונים': 'No updates',
  'אין עדכונים עדיין': 'No updates yet',
  'נוכחות כללית': 'General attendance',
  'עבודה בשטח': 'Field work',
  'משרד': 'Office',
  'חופש': 'Vacation',
  'מחלה': 'Sick leave',
  'מילואים': 'Reserve duty',
  'כניסה לעבודה': 'Clock in',
  'יציאה מהעבודה': 'Clock out',
  'דוח שעות עובדים': 'Employee hours report',
  'עובד': 'Employee',
  'כל העובדים': 'All employees',
  'חודש': 'Month',
  'מתאריך': 'From date',
  'עד תאריך': 'To date',
  'ייצוא לאקסל': 'Export to Excel',
  'משמרות כלליות': 'General shifts',
  'שעות נוכחות כלליות': 'General attendance hours',
  'שעות משויכות לפרויקטים': 'Project hours',
  'ימי עבודה בדוח': 'Work days in report',
  'כולל נסיעות, מעברים וזמן שאינו משויך לפרויקט מסוים.': 'Includes travel, transitions and time not assigned to a project.',
  'שעות לפי פרויקט': 'Hours by project',
  'משמשות לחישובים ולשיוך פיננסי לכל עבודה.': 'Used for calculations and financial allocation.',
  'תאריך': 'Date',
  'סוג דיווח': 'Report type',
  'כניסה': 'Start',
  'יציאה': 'End',
  'משך': 'Duration',
  'מיקומים': 'Locations',
  'הערה': 'Note',
  'פרויקט': 'Project',
  'לקוח': 'Client',
  'מיקום': 'Location',
  'צוות נוסף': 'Additional crew',
  'תאריכי עבודה': 'Work dates',
  'ימים': 'Days',
  'זמן עבודה': 'Work time',
  'פתוח': 'Open',
  'מיקומי שטח': 'Field locations',
  'אין נתוני נוכחות כללית בטווח שנבחר': 'No general attendance data in the selected range',
  'אין נתוני שעות בטווח שנבחר': 'No hours data in the selected range',
  'שם פרויקט': 'Project name',
  'טלפון איש קשר בשטח': 'Field contact phone',
  'מייל איש קשר בשטח': 'Field contact email',
  'תאריך יעד': 'Due date',
  'תיאור': 'Description',
  'שמור שינויים': 'Save changes',
  'ביטול': 'Cancel',
  'מחיקת פרויקט': 'Delete project',
  'משימות': 'Tasks',
  'משימה חדשה': 'New task',
  'כותרת המשימה': 'Task title',
  'פירוט המשימה': 'Task details',
  'הוסף משימה': 'Add task',
  'סמן כבוצע': 'Mark complete',
  'הצג עוד': 'Show more',
  'טוען תמונות וקבצים...': 'Loading photos and files...',
  'מצב אופליין': 'Offline mode',
  'סנכרון': 'Sync',
  'נדרש חיבור Supabase': 'Supabase connection required',
  'טוענים את המערכת': 'Loading the system',
  'מסנכרנים פרויקטים, עובדים והתראות מ־Supabase…': 'Syncing projects, employees and notifications from Supabase…',
  'יומן עבודה דיגיטלי': 'Digital work diary',
  'יומני עבודה חתומים': 'Signed work diaries',
  'מילוי בשטח, חתימת מזמין העבודה וראש צוות מאיה והפקת PDF.': 'Field completion, client and MAYA team-lead signatures, and PDF generation.',
  'טוען יומני עבודה...': 'Loading work diaries...',
  'עדיין לא נוצר יומן עבודה לפרויקט זה.': 'No work diary has been created for this project yet.',
  'יומן עבודה חדש': 'New work diary',
  'נציג הלקוח': 'Client representative',
  'ראש צוות מאיה': 'MAYA team lead',
  'ניקוי': 'Clear',
  'יש לחתום בתוך המסגרת באמצעות האצבע או העכבר.': 'Sign inside the box using a finger or mouse.',
  'אין היסטוריה להצגה': 'No history to display',
  'דוח חריגות יומי': 'Daily exceptions report',
  'אין חריגות כרגע': 'No exceptions at this time',
  'פרויקטים משויכים לפי עובד': 'Projects assigned by employee',
  'עובדי שטח': 'Field employees',
  'פרויקטים פעילים משויכים': 'Assigned active projects',
  'עובדים ללא פרויקט פעיל': 'Employees without an active project',
  'אין לעובד פרויקטים פעילים משויכים': 'This employee has no assigned active projects',
  'לא נמצאו עובדים או פרויקטים התואמים לסינון.': 'No employees or projects match the filter.',
  'אין משימות בפרויקט': 'No tasks in this project',
  'קבצי הגהה': 'Review files',
  'תמונת מצב של כל הפרויקטים': 'All-project overview',
  'סטטוס עדכני, אחריות ברורה וייצוא מהיר לקובץ Excel.': 'Current status, clear ownership and quick Excel export.',
  'עם עובד אחראי': 'With a lead employee',
  'פרויקטים שהושלמו': 'Completed projects',
  'ממתינים לשיוך': 'Awaiting assignment',
  'כל השיוכים': 'All assignments',
  'ללא עובד אחראי': 'Without a lead employee',
  'מס׳': 'No.',
  'שם הפרויקט': 'Project name',
  'סטטוס נוכחי': 'Current status',
  'עובד שטח אחראי': 'Lead field employee',
  'לא נמצאו פרויקטים': 'No projects found',
  'נסו לשנות את החיפוש או את הסינון.': 'Try changing the search or filter.',
  'עדכון פרטי הפרויקט, שיוך עובד ותאריך יעד.': 'Update project details, employee assignment and due date.',
  'שיוך הפרויקט לשרטט': 'Assign project to drafter',
  'ללא שרטט משויך': 'No assigned drafter',
  'הוספת פרויקט חדש': 'Add new project',
  'ללא שיוך כרגע': 'Currently unassigned',
  'צור פרויקט': 'Create project',
  'שליחה להגהה': 'Send for review',
  'אין תמונות בפרויקט': 'No photos in this project',
  'אין התראות כרגע': 'No notifications at this time',
  'מפת פעילות בשטח': 'Field activity map',
  'מוצגים רק דיווחי היום. עובדים פעילים בירוק ודיווחים שהסתיימו בכחול.': 'Only today’s reports are shown. Active employees are green and completed reports are blue.',
  'פעילים עכשיו': 'Active now',
  'נקודות עובדים': 'Employee locations',
  'דיווח אחרון': 'Latest report',
  'עובדים על המפה': 'Employees on the map',
  'עדיין אין מיקומים להצגה': 'No locations to display yet',
  'המפה תתעדכן כאשר עובד יתחיל או יסיים עבודה עם הרשאת מיקום.': 'The map updates when an employee starts or finishes work with location permission.',
  'כניסה מאובטחת עם מייל וסיסמה לעובדי שטח ומנהלים': 'Secure email and password access for field employees and managers',
  'מעקב נוכחות כללי לצד שעות העבודה שנרשמו לכל פרויקט.': 'General attendance alongside hours recorded for each project.',
  'שלח סיכום יומי עכשיו': 'Send daily summary now',
  'נוכחים עכשיו': 'Present now',
  'אין משמרות כלליות פתוחות כרגע.': 'There are no open general shifts.',
  'טרם התחילו היום': 'Not started today',
  'כל העובדים התחילו או שאין עובדים להצגה.': 'All employees have started, or there are no employees to display.',
  'משמרות כלליות היום': 'General shifts today',
  'אין רישומי נוכחות כללית להיום.': 'No general attendance records today.',
  'דיווח יומי ללא שעות': 'Full-day report without hours',
  'פעולות לפי פרויקט היום': 'Project activity today',
  'אין רישומי עבודה להיום.': 'No work records today.',
  'סיום עבודה בפרויקט': 'Finish project work',
  'אופציונלי': 'Optional',
  'עובדים מהמערכת שהיו איתי': 'System employees who worked with me',
  'לא נמצאו עובדים נוספים לבחירה.': 'No additional employees available.',
  'עוזרים שהיו איתי': 'Helpers who worked with me',
  'בעת האישור נבקש את מיקום הסיום ונשמור אותו יחד עם הצוות שנבחר.': 'On confirmation, the end location and selected crew will be saved.',
  'חזרה': 'Back',
  'שעון נוכחות כללי': 'General attendance clock',
  'סיום משמרת': 'Finish shift',
  'בעת האישור נבקש את מיקום הסיום ונשמור אותו בדיווח.': 'On confirmation, the end location will be saved in the report.',
  'לא נשמר מיקום': 'Location not saved',
  'ועוד...': 'More...',
  'התראות חדשות': 'New notifications',
  'פרויקטים ללא שיוך': 'Unassigned projects',
  'עבודות פעילות': 'Active work sessions',
  'סה״כ פרויקטים': 'Total projects',
  'בהגהה': 'Under review',
  'הושלמו': 'Completed',
  'חריגות לטיפול': 'Exceptions requiring attention',
  'חדשות': 'new',
  'אין התראות חדשות': 'No new notifications',
  'סגור': 'Close',
  'סגירה': 'Close',
  'פתח פרויקט': 'Open project',
  'לכל ההתראות': 'View all notifications',
  'סמן הכל כנקרא': 'Mark all as read',
  'שומר ומסיים...': 'Saving and finishing...',
  'אישור וסיום עבודה': 'Confirm and finish work',
  'מחיקת תמונה': 'Delete photo',
  'מחיקת': 'Delete',
  'משימה לעובד': 'Task for employee',
  'משימה למנהלים': 'Task for managers',
  'כותרת משימה': 'Task title',
  'פירוט המשימה, אופציונלי': 'Optional task details',
  'שלח משימה למנהלים': 'Send task to managers',
  'נוצר על ידי': 'Created by',
  'מנהל': 'Manager',
  'בוצע': 'Done',
  'קיצור דרך לשעון נוכחות': 'Attendance clock shortcut',
  'שעון נוכחות': 'Attendance clock',
  'לא התחלת משמרת': 'Shift not started',
  'השעון לא זמין': 'Clock unavailable',
  'מעדכן...': 'Updating...',
  'פתיחה': 'Start',
  'סיום': 'Finish',
  'פעיל': 'active',
  'דווח': 'Reported',
  'לא במשמרת': 'Not on shift',
  'מיקום כניסה': 'Clock-in location',
  'התחל את יום העבודה לפני המעבר בין הפרויקטים.': 'Start the workday before moving between projects.',
  'סה״כ נוכחות היום': 'Total attendance today',
  'נדרש להפעיל את טבלת הנוכחות ב-Supabase לפני השימוש.': 'The Supabase attendance table must be enabled before use.',
  'תחילת': 'Start',
  'עדכון': 'Update',
  'דיווח': 'Report',
  'מה בוצע, מידע חשוב למנהל או ציוד שהוחזר': 'Work completed, important manager information, or returned equipment',
  'שיוך לאחראי ראשי (מנהל או עובד שטח)': 'Assign a lead employee (manager or field worker)',
  'עובדים נוספים בפרויקט': 'Additional project employees',
  'הפרויקט דורש יומן עבודה וחתימות': 'This project requires a work diary and signatures',
  'שחזור מהארכיון': 'Restore from archive',
  'התקשר לאיש קשר בשטח': 'Call field contact',
  'שליחת מייל לאיש קשר בשטח': 'Email field contact',
  'מיקום התחלה': 'Start location',
  'סיום אחרון': 'Last finish',
  'מיקום סיום אחרון': 'Last finish location',
  'הפרויקט משויך כעת לשרטט. אפשר לשנות את השיוך.': 'The project is assigned to a drafter. The assignment can be changed.',
  'הפרויקט ממתין לבחירת שרטט על ידי מנהל.': 'The project is waiting for a manager to select a drafter.',
  'עדכון שיוך': 'Update assignment',
  'שיוך לשרטט': 'Assign drafter',
  'עדכונים': 'updates',
  'תצוגת ניהול מלאה לפרויקטים, משימות, עובדים והתראות': 'Full management view of projects, tasks, employees and notifications',
  'תצוגת שרטט לפרויקטים שעברו לשרטוט ושליחה להגהה': 'Drafter view of projects sent to drafting and review',
  'תצוגת עובד שטח לפרויקטים, שעות עבודה ומשימות': 'Field employee view of projects, work hours and tasks',
  'המשמרת האחרונה': 'The last shift',
  'הסתיימה ב': 'ended at',
  'הדיווח': 'The report',
  'נשמר להיום וניתן לעדכן אותו.': 'was saved for today and can be updated.',
  'דק׳': 'min',
  'ש׳': 'hr',
};

const patterns = [
  [/^המשמרת האחרונה הסתיימה ב-(.+)$/, 'The last shift ended at $1'],
  [/^הדיווח (.+) נשמר להיום וניתן לעדכן אותו\.$/, 'The $1 report was saved for today and can be updated.'],
  [/^(.+) פעיל$/, '$1 is active'],
  [/^דווח: (.+)$/, 'Reported: $1'],
  [/^סה״כ נוכחות היום: (.+)$/, 'Total attendance today: $1'],
  [/^משימות פתוחות \((\d+)\)$/, 'Open tasks ($1)'],
  [/^דוח חריגות \((\d+)\)$/, 'Exceptions report ($1)'],
  [/^ללא שיוך \((\d+)\)$/, 'Unassigned ($1)'],
  [/^ארכיון \((\d+)\)$/, 'Archive ($1)'],
  [/^התראות \((\d+)\)$/, 'Notifications ($1)'],
  [/^(\d+)% התקדמות$/, '$1% progress'],
  [/^יעד: (.+)$/, 'Due: $1'],
  [/^עודכן: (.+)$/, 'Updated: $1'],
  [/^מספר הזמנה \/ לקוח: (.+)$/, 'Order / client: $1'],
  [/^הצג עוד 20 פרויקטים \((\d+) נותרו\)$/, 'Show 20 more projects ($1 remaining)'],
];

const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const translatableAttributes = ['placeholder', 'title', 'aria-label'];
const reverseTranslations = Object.fromEntries(Object.entries(translations).map(([hebrew, english]) => [english, hebrew]));
const translationEntries = Object.entries(translations).sort(([a], [b]) => b.length - a.length);
const reverseEntries = Object.entries(reverseTranslations).sort(([a], [b]) => b.length - a.length);

function translateValue(value) {
  const trimmed = value.trim();
  let translated = translations[trimmed];
  if (!translated) {
    for (const [pattern, replacement] of patterns) {
      if (pattern.test(trimmed)) {
        translated = trimmed.replace(pattern, replacement);
        break;
      }
    }
  }
  if (translated) return value.replace(trimmed, translated);
  let next = value;
  for (const [hebrew, english] of translationEntries) {
    if (next.includes(hebrew)) next = next.replaceAll(hebrew, english);
  }
  return next;
}

function restoreValue(value) {
  const trimmed = value.trim();
  const restored = reverseTranslations[trimmed];
  if (restored) return value.replace(trimmed, restored);
  let next = value;
  for (const [english, hebrew] of reverseEntries) {
    if (next.includes(english)) next = next.replaceAll(english, hebrew);
  }
  return next;
}

function translateTree(root, language) {
  if (!root) return;
  const nodes = [];
  if (root.nodeType === Node.TEXT_NODE) nodes.push(root);
  if (root.nodeType === Node.ELEMENT_NODE) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) nodes.push(walker.currentNode);
  }
  for (const node of nodes) {
    if (language === 'en') {
      if (/[א-ת]/.test(node.data)) originalText.set(node, node.data);
      const source = originalText.get(node) || node.data;
      const next = translateValue(source);
      if (node.data !== next) node.data = next;
    } else if (originalText.has(node)) {
      node.data = originalText.get(node);
    } else {
      const next = restoreValue(node.data);
      if (node.data !== next) node.data = next;
    }
  }

  const elements = root.nodeType === Node.ELEMENT_NODE ? [root, ...root.querySelectorAll('*')] : [];
  for (const element of elements) {
    let saved = originalAttributes.get(element);
    if (!saved) saved = {};
    for (const attribute of translatableAttributes) {
      const current = element.getAttribute(attribute);
      if (language === 'en' && current && /[א-ת]/.test(current)) {
        saved[attribute] = current;
        element.setAttribute(attribute, translateValue(current));
      } else if (language === 'he' && saved[attribute]) {
        element.setAttribute(attribute, saved[attribute]);
      } else if (language === 'he' && current) {
        element.setAttribute(attribute, restoreValue(current));
      }
    }
    originalAttributes.set(element, saved);
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('maya-language') === 'en' ? 'en' : 'he');

  useEffect(() => {
    localStorage.setItem('maya-language', language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';
    document.body.classList.toggle('language-en', language === 'en');
    translateTree(document.body, language);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') translateTree(mutation.target, language);
        for (const node of mutation.addedNodes) translateTree(node, language);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  const value = useMemo(() => ({ language, toggleLanguage: () => setLanguage((current) => current === 'he' ? 'en' : 'he') }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
