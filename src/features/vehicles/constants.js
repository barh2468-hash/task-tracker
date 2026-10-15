export const VEHICLE_BUCKET = 'vehicle-documents';
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export const VEHICLE_KINDS = {
  car: 'רכב פרטי',
  truck: 'משאית',
  trailer: 'נגרר',
  other: 'אחר',
};

export const VEHICLE_STATUSES = {
  expected: 'צפוי להגיע',
  awaiting_insurance: 'ממתין לאישור ביטוח',
  awaiting_handover: 'ממתין למסירה',
  in_use: 'בשימוש',
  in_service: 'בטיפול',
  retired: 'הוצא משימוש',
};

export const OWNERSHIP_TYPES = {
  leasing: 'ליסינג',
  owned: 'בבעלות',
  rental: 'השכרה',
};

export const HOLDER_TYPES = {
  driver: 'נהג קבוע',
  office: 'רכב משרדי',
  company: 'רכב חברה',
};

export const TOLL_KINDS = {
  kvish6: 'כביש 6',
  pango: 'פנגו',
  hatzut_zafon: 'חוצה צפון',
  carmel_tunnels: 'מנהרות הכרמל',
  dalkan: 'דלקן',
  traffilog: 'טרפילוג',
};

export const TOLL_SHORT_LABELS = {
  kvish6: 'כביש 6',
  pango: 'פנגו',
  hatzut_zafon: 'חוצה צפון',
  carmel_tunnels: 'כרמל',
  dalkan: 'דלקן',
  traffilog: 'טרפילוג',
};

export const INSURANCE_KINDS = {
  mandatory: 'ביטוח חובה',
  comprehensive: 'ביטוח מקיף',
  third_party: 'צד ג׳',
};

export const DOCUMENT_TYPES = {
  registration: 'רישיון רכב',
  insurance_mandatory: 'ביטוח חובה',
  insurance_comprehensive: 'ביטוח מקיף',
  insurance_quote: 'הצעת ביטוח',
  inspection: 'טסט',
  fine: 'דוח',
  fine_payment: 'אישור תשלום דוח',
  declaration: 'טופס הצהרה',
  swap_form: 'טופס החלפה',
  lease_contract: 'חוזה ליסינג',
  condition_photo: 'תמונת מצב',
  other: 'אחר',
};

// Days before expiry at which a policy or test is flagged as "soon".
export const EXPIRY_WARNING_DAYS = 60;
// Trailers carry no odometer, subscriptions or monthly mileage reminder.
export const KINDS_WITHOUT_ODOMETER = ['trailer'];
