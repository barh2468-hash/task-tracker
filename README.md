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
