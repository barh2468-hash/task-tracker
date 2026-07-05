# MAYA Infrastructure Tracker - Archive Projects Addon

עדכון זה מוסיף **ארכיון פרויקטים** בצורה בטוחה:

- מנהל יכול להעביר פרויקט לארכיון במקום למחוק אותו.
- פרויקטים בארכיון לא מוצגים ברשימת הפרויקטים הפעילים.
- נוסף מסך/תפריט **ארכיון** למנהלים.
- אפשר לשחזר פרויקט מהארכיון.
- כל הנתונים נשמרים: שעות, משימות, תמונות, התראות והיסטוריה.

## Supabase

לפני העלאה לייצור, הרץ ב-Supabase SQL Editor את הקובץ:

```text
supabase/archive-projects-fix.sql
```

הקובץ מוסיף רק עמודות ואינדקסים:

- `projects.is_archived`
- `projects.archived_at`

אין מחיקה של מידע קיים.

## Local run

```bash
npm install
npm run dev
```

## Deploy

```bash
git add .
git commit -m "Add project archive support"
git push
```

## עדכון: היום בשטח, כמה עובדים לפרויקט, הערת סיום וסיכום יומי

נוספו היכולות הבאות:

1. מסך **היום בשטח** למנהלים:
   - עובדים פעילים עכשיו
   - עובדים שטרם התחילו היום
   - כל רישומי העבודה של היום
   - כפתור בדיקה לשליחת סיכום יומי למנהלים

2. שיוך כמה עובדים לאותו פרויקט:
   - עובד אחראי ראשי נשאר כמו קודם
   - ניתן להוסיף עובדים נוספים לפרויקט
   - העובדים הנוספים רואים את הפרויקט, יכולים להתחיל/לסיים עבודה ולסמן משימות

3. הערת סיום עבודה:
   - בלחיצה על סיים עבודה נפתחת בקשה להערת סיום
   - ההערה נשמרת ברישום השעות ובהיסטוריית הפרויקט

4. סיכום יומי במייל:
   - נוספה פונקציית Edge Function בשם `daily-manager-summary`
   - ניתן לשלוח ידנית מתוך מסך היום בשטח
   - ניתן לתזמן אוטומטית דרך `supabase/daily-manager-summary-schedule.sql`

### פעולות Supabase נדרשות

להריץ ב-SQL Editor:

```text
supabase/field-team-daily-summary-fix.sql
```

לפרוס פונקציה חדשה:

```cmd
supabase functions deploy daily-manager-summary
```

אם רוצים סיכום יומי אוטומטי, לפתוח את הקובץ הבא, להחליף את PROJECT_REF ואת ANON_OR_SERVICE_KEY, ואז להריץ ב-SQL Editor:

```text
supabase/daily-manager-summary-schedule.sql
```

