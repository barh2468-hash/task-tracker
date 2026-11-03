const entries = [
  [
    'מנת השרטוט תיווצר לאחר הסנכרון.',
    'The drawing batch will be created after syncing.',
    'Η παρτίδα σχεδίασης θα δημιουργηθεί μετά τον συγχρονισμό.',
  ],
  [
    'הקובץ {{name}} ממתין להעלאה.',
    'File {{name}} is waiting to upload.',
    'Το αρχείο {{name}} αναμένει μεταφόρτωση.',
  ],
  ['דיווח ביצוע משימה', 'Task execution report', 'Αναφορά εκτέλεσης εργασίας'],
  ['דיווח ביצוע', 'Report execution', 'Αναφορά εκτέλεσης'],
  ['פתיחת משימה מחדש', 'Reopen task', 'Επαναφορά εργασίας'],
  ['הבקשה המקורית', 'Original request', 'Αρχικό αίτημα'],
  ['מצב הביצוע', 'Execution status', 'Κατάσταση εκτέλεσης'],
  ['הושלם', 'Completed', 'Ολοκληρώθηκε'],
  ['בוצע חלקית', 'Partially completed', 'Μερική ολοκλήρωση'],
  [
    'לא בוצע — נדרשת הבהרה',
    'Not completed — clarification needed',
    'Δεν εκτελέστηκε — απαιτείται διευκρίνιση',
  ],
  ['נפתח מחדש', 'Reopened', 'Άνοιξε ξανά'],
  ['סיבת הפתיחה מחדש (חובה)', 'Reason for reopening (required)', 'Λόγος επαναφοράς (υποχρεωτικό)'],
  [
    'מה בוצע בפועל או מה מנע ביצוע? (חובה)',
    'What was done, or what prevented completion? (required)',
    'Τι έγινε ή τι εμπόδισε την ολοκλήρωση; (υποχρεωτικό)',
  ],
  [
    'יש לענות לבקשה המקורית ולתאר את התוצאה בפועל.',
    'Respond to the original request and describe the actual result.',
    'Απαντήστε στο αρχικό αίτημα και περιγράψτε το πραγματικό αποτέλεσμα.',
  ],
  [
    'מה נשאר להמשך או איזו הבהרה נדרשת? (חובה)',
    'Remaining work or clarification needed (required)',
    'Εργασία που απομένει ή απαιτούμενη διευκρίνιση (υποχρεωτικό)',
  ],
  [
    'המשימה תישאר פתוחה להמשך טיפול.',
    'The task will stay open for follow-up.',
    'Η εργασία θα παραμείνει ανοιχτή για συνέχεια.',
  ],
  ['צירוף תמונות או PDF', 'Attach images or PDFs', 'Επισύναψη εικόνων ή PDF'],
  [
    'עד 10 קבצים, עד 20MB לקובץ. אפשר לשמור גם ללא חיבור לאינטרנט.',
    'Up to 10 files, 20MB per file. You can also save offline.',
    'Έως 10 αρχεία, 20MB ανά αρχείο. Μπορείτε να αποθηκεύσετε και χωρίς σύνδεση.',
  ],
  [
    'הסרת הקובץ {{name}} מהדיווח',
    'Remove {{name}} from report',
    'Αφαίρεση του {{name}} από την αναφορά',
  ],
  ['הסרה', 'Remove', 'Αφαίρεση'],
  ['טוען קבצים קיימים...', 'Loading existing files...', 'Φόρτωση υπαρχόντων αρχείων...'],
  [
    'לא ניתן לטעון קבצים קיימים. אפשר לצרף קובץ או לציין את שמו בהפניה.',
    'Could not load existing files. Attach a file or reference its name.',
    'Δεν ήταν δυνατή η φόρτωση αρχείων. Επισυνάψτε αρχείο ή αναφέρετε το όνομά του.',
  ],
  [
    'קבצים שכבר נמצאים בפרויקט',
    'Files already in this project',
    'Αρχεία που υπάρχουν ήδη στο έργο',
  ],
  [
    'הפניה לתמונה או לקובץ קיים (לא חובה)',
    'Existing image or file reference (optional)',
    'Αναφορά σε υπάρχουσα εικόνα ή αρχείο (προαιρετικό)',
  ],
  [
    'לדוגמה: תמונה 2 בתמונות הפרויקט, או שם הסקיצה',
    'For example: project photo 2, or the sketch filename',
    'Για παράδειγμα: φωτογραφία έργου 2 ή το όνομα σκίτσου',
  ],
  [
    'החלק שבוצע מוכן לשרטוט',
    'Completed work is ready for drafting',
    'Η ολοκληρωμένη εργασία είναι έτοιμη για σχεδίαση',
  ],
  [
    'תיווצר מנת שרטוט עם הדיווח והקבצים. אפשר להעביר גם ביצוע חלקי.',
    'A drawing batch will include the report and files. Partial work can also be handed over.',
    'Θα δημιουργηθεί παρτίδα σχεδίασης με την αναφορά και τα αρχεία. Μπορείτε να παραδώσετε και μερική εργασία.',
  ],
  [
    'השפעה על שרטוט שכבר נמצא בהגהה',
    'Impact on a drawing under review',
    'Επίδραση σε σχέδιο υπό έλεγχο',
  ],
  [
    'תוספת נפרדת — אין שינוי בהגהה',
    'Separate addition — no change to the review',
    'Ξεχωριστή προσθήκη — χωρίς αλλαγή στον έλεγχο',
  ],
  [
    'נדרש עדכון לשרטוט שבהגהה',
    'Drawing under review needs an update',
    'Το σχέδιο υπό έλεγχο χρειάζεται ενημέρωση',
  ],
  [
    'נדרשת החלטה של אחראי השרטוט',
    'Drafting lead needs to decide',
    'Απαιτείται απόφαση υπευθύνου σχεδίασης',
  ],
  ['שומר דיווח וקבצים...', 'Saving report and files...', 'Αποθήκευση αναφοράς και αρχείων...'],
  ['שמירת דיווח הביצוע', 'Save execution report', 'Αποθήκευση αναφοράς εκτέλεσης'],
  ['יש לבחור מצב ביצוע.', 'Select an execution status.', 'Επιλέξτε κατάσταση εκτέλεσης.'],
  [
    'יש לפרט מה בוצע או מדוע לא ניתן לבצע (לפחות 5 תווים).',
    'Describe the result or why the work could not be done (at least 5 characters).',
    'Περιγράψτε το αποτέλεσμα ή γιατί δεν έγινε η εργασία (τουλάχιστον 5 χαρακτήρες).',
  ],
  [
    'הפירוט ארוך מדי. ניתן להזין עד 4,000 תווים בכל שדה.',
    'Each description field allows up to 4,000 characters.',
    'Επιτρέπονται έως 4.000 χαρακτήρες ανά πεδίο περιγραφής.',
  ],
  [
    'יש לפרט מה נשאר להמשך או איזו הבהרה נדרשת.',
    'Describe the remaining work or clarification needed.',
    'Περιγράψτε την εργασία που απομένει ή την απαιτούμενη διευκρίνιση.',
  ],
  [
    'ניתן להעביר לשרטוט רק עבודה שבוצעה באופן מלא או חלקי.',
    'Only completed or partially completed work can be sent for drafting.',
    'Μόνο πλήρως ή μερικώς ολοκληρωμένη εργασία μπορεί να σταλεί για σχεδίαση.',
  ],
  [
    'ניתן לצרף עד 10 קבצים לדיווח.',
    'Attach up to 10 files per report.',
    'Επισυνάψτε έως 10 αρχεία ανά αναφορά.',
  ],
  [
    'יש לצרף תמונה או PDF תקינים, עד 20MB לכל קובץ.',
    'Attach a valid image or PDF, up to 20MB per file.',
    'Επισυνάψτε έγκυρη εικόνα ή PDF, έως 20MB ανά αρχείο.',
  ],
  [
    'אין הרשאה לדווח ביצוע במשימה זו.',
    'You cannot report on this task.',
    'Δεν έχετε άδεια υποβολής αναφοράς για αυτή την εργασία.',
  ],
  [
    'הדיווח והקבצים נשמרו במכשיר ויסונכרנו עם החיבור לאינטרנט.',
    'Report and files saved on this device. They will sync when online.',
    'Η αναφορά και τα αρχεία αποθηκεύτηκαν στη συσκευή και θα συγχρονιστούν με τη σύνδεση.',
  ],
  [
    'דיווח הביצוע נשמר. עדכון במייל ממתין לשליחה.',
    'Execution report saved. An email update is queued.',
    'Η αναφορά αποθηκεύτηκε. Η ενημέρωση μέσω email είναι στην ουρά.',
  ],
  [
    'המשימה השתנתה מאז פתיחת החלון. יש לרענן ולבדוק את הדיווח האחרון לפני שליחה.',
    'The task changed. Refresh and check the latest report before submitting.',
    'Η εργασία άλλαξε. Ανανεώστε και ελέγξτε την τελευταία αναφορά πριν την υποβολή.',
  ],
  [
    'שמירת דיווח הביצוע נכשלה. הפרטים נשארו בחלון וניתן לנסות שוב.',
    'Could not save the report. Your entries remain here; try again.',
    'Δεν ήταν δυνατή η αποθήκευση. Τα στοιχεία παραμένουν εδώ· δοκιμάστε ξανά.',
  ],
  [
    'כל המשימות בפרויקט הושלמו. אם כל עבודת השטח הסתיימה, האם להעביר את הפרויקט לשרטוט?',
    'All tasks are complete. If all field work has finished, move this project to drafting?',
    'Όλες οι εργασίες ολοκληρώθηκαν. Αν τελείωσε όλη η εργασία πεδίου, να μεταφερθεί το έργο στη σχεδίαση;',
  ],
  ['ממתין לסנכרון', 'Pending sync', 'Αναμονή συγχρονισμού'],
  [
    'דיווחי ביצוע והמשך טיפול ({{count}})',
    'Execution reports and follow-up ({{count}})',
    'Αναφορές εκτέλεσης και συνέχεια ({{count}})',
  ],
  ['דיווח העובד', 'Worker report', 'Αναφορά εργαζομένου'],
  ['המשך טיפול', 'Follow-up', 'Συνέχεια'],
  ['הפניה לקובץ קיים', 'Existing file reference', 'Αναφορά σε υπάρχον αρχείο'],
  [
    'הדיווח הועבר למנת שרטוט.',
    'Report sent to a drawing batch.',
    'Η αναφορά μεταφέρθηκε σε παρτίδα σχεδίασης.',
  ],
  ['פותח קובץ...', 'Opening file...', 'Άνοιγμα αρχείου...'],
  ['פתיחת הקובץ {{name}}', 'Open file {{name}}', 'Άνοιγμα αρχείου {{name}}'],
  [
    'פתיחת הקובץ נכשלה. ניתן לנסות שוב מתוך מסמכי הפרויקט.',
    'Could not open the file. Try from project documents.',
    'Δεν ήταν δυνατό το άνοιγμα. Δοκιμάστε από τα έγγραφα έργου.',
  ],
  [
    'יש למלא דיווח ביצוע כדי להשלים משימה.',
    'Submit an execution report to complete a task.',
    'Υποβάλετε αναφορά εκτέλεσης για να ολοκληρώσετε εργασία.',
  ],
];
export const heTaskReports = Object.fromEntries(entries.map(([he]) => [he, he]));
export const enTaskReports = Object.fromEntries(entries.map(([he, en]) => [he, en]));
export const elTaskReports = Object.fromEntries(entries.map(([he, , el]) => [he, el]));
