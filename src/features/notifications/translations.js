const entries = [
  ['סמן כנקרא', 'סמן כנקרא', 'Mark as read', 'Σήμανση ως αναγνωσμένου'],
  [
    'התראות פנימיות על שינויי סטטוס, התחלת/סיום עבודה ומשימות.',
    'התראות פנימיות על שינויי סטטוס, התחלת/סיום עבודה ומשימות.',
    'In-app notifications about status changes, work starting or finishing, and tasks.',
    'Ειδοποιήσεις στην εφαρμογή για αλλαγές κατάστασης, έναρξη ή ολοκλήρωση εργασιών και καθήκοντα.',
  ],
  ['{{value0}} חדשות', '{{value0}} חדשות', '{{value0}} new', '{{value0}} νέες'],
];

export const heNotifications = Object.fromEntries(entries.map(([key, he]) => [key, he]));
export const enNotifications = Object.fromEntries(entries.map(([key, , en]) => [key, en]));
export const elNotifications = Object.fromEntries(entries.map(([key, , , el]) => [key, el]));
