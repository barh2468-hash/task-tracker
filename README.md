# מערכת איתור תשתיות - Real App

אפליקציית Web מקצועית לניהול פרויקטים של איתור תשתיות עבור עובדי שטח ומנהלים.

## מה יש בפנים

- התחברות עובדים עם אימייל וסיסמה דרך Supabase Auth
- מסד נתונים אמיתי PostgreSQL דרך Supabase
- הרשאות עובד שטח / מנהל
- עובד שטח רואה רק את הפרויקטים שלו
- מנהל רואה את כל הפרויקטים ויכול להוסיף פרויקט ולשייך לעובד
- עדכון סטטוסים בזמן אמת
- הסטטוסים שהוגדרו:
  - בעבודה בשטח
  - עבר לשרטוט
  - נדרש GPR
  - מחכה להיתרים
  - הושלם
- העלאת תמונות מהשטח ל-Supabase Storage
- היסטוריית שינויים מלאה לכל פרויקט
- עיצוב RTL בעברית כולל הלוגו שסיפקת
- מותאם למובייל, אייפון, אנדרואיד ומחשב
- מוכן להעלאה ל-Vercel ולחיבור לדומיין

## התקנה מקומית

1. התקן Node.js.
2. צור פרויקט חדש ב-Supabase.
3. ב-Supabase עבור אל SQL Editor והריץ את הקובץ:

```bash
supabase/schema.sql
```

4. העתק את הקובץ `.env.example` לקובץ חדש בשם `.env.local`.
5. מלא בו את פרטי Supabase שלך:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

6. הרץ:

```bash
npm install
npm run dev
```

7. פתח בדפדפן:

```bash
http://localhost:3000
```


## כניסה עם אימייל וסיסמה

הגרסה הזו לא משתמשת ב-Magic Link, ולכן לא אמורה להיתקע על מגבלת שליחת מיילים בכל התחברות.

### יצירת עובד דרך Supabase

1. עבור אל `Authentication > Users`.
2. לחץ `Add user`.
3. מלא Email ו-Password.
4. סמן `Auto Confirm User` אם האפשרות קיימת.
5. לאחר שהעובד נכנס בפעם הראשונה, תיווצר לו שורה בטבלת `profiles`.
6. כדי להפוך משתמש למנהל, שנה בטבלת `profiles` את `role` ל-`manager`.

אפשר גם להשתמש בכפתור "הרשמה ראשונית עם סיסמה" במסך הכניסה, אבל אם Supabase דורש אימות מייל, עדיף ליצור עובדים מה-Dashboard עם Auto Confirm.

## הפיכת משתמש למנהל

אחרי שהמשתמש הראשון נכנס עם המייל שלו, הרץ ב-Supabase SQL Editor:

```sql
update public.profiles
set role = 'manager', full_name = 'שם המנהל'
where email = 'manager@company.com';
```

לאחר מכן הוא יראה את מסכי הניהול: כל הפרויקטים, הוספת פרויקט ושיוך לעובדים.

## העלאה לדומיין

הדרך המומלצת:

1. העלה את התיקייה ל-GitHub.
2. חבר את ה-Repository ל-Vercel.
3. הוסף ב-Vercel את המשתנים:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
4. לחץ Deploy.
5. חבר דומיין דרך Vercel Domains.

## מבנה הפרויקט

```text
app/page.tsx          המסך הראשי וכל הלוגיקה
app/globals.css       עיצוב RTL רספונסיבי
lib/supabase.ts       חיבור Supabase וסטטוסים
public/logo.png       הלוגו שלך
supabase/schema.sql   מסד נתונים, הרשאות, storage ו-realtime
```

## השלב הבא לפיתוח

כדי להפוך את זה למוצר מלא עוד יותר, כדאי להוסיף:

- מסך עריכת פרויקט למנהל
- צפייה בגלריית תמונות לכל פרויקט
- התראות WhatsApp/Email בעת שינוי סטטוס
- יצוא דוחות PDF / Excel
- הרשאות לפי צוותים ואזורים
- מיקום GPS בעת העלאת תמונה

## עדכון: עריכה, מחיקה ותמונות

אם העליתם את הגרסה החדשה, הריצו ב-Supabase SQL Editor את הקובץ:

```text
supabase/edit-delete-photos-fix.sql
```

הגרסה כוללת:
- עריכת פרויקט למנהל
- מחיקת פרויקט למנהל
- הצגת תמונות שהועלו לפרויקט
- שימוש ב-Bucket בשם `project-photos`
