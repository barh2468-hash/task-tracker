# MAYA Infrastructure Tracker

עדכון זה מוסיף שליחת מייל לעובד כאשר מנהל משייך אליו פרויקט.

## מה חדש
- כאשר מנהל יוצר פרויקט ומשייך אותו לעובד — העובד מקבל התראה פנימית וגם מייל.
- כאשר מנהל עורך פרויקט ומשנה שיוך לעובד חדש — העובד החדש מקבל התראה פנימית וגם מייל.
- אם השיוך לא השתנה — לא נשלחת התראה כפולה.
- אין צורך להריץ SQL חדש אם כבר קיימות ההתראות הפנימיות.

## פריסת פונקציית המייל החדשה
יש לפרוס את הפונקציה החדשה ל-Supabase:

```bash
supabase functions deploy notify-project-assigned
```

ודא שכבר מוגדרים הסודות:

```bash
supabase secrets list
```

צריכים להופיע:
- RESEND_API_KEY
- FROM_EMAIL

## הרצה
```bash
npm install
npm run dev
```

## העלאה
```bash
git add .
git commit -m "Email worker when assigned to project"
git push
```
