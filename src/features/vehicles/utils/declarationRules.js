// Rules of the worker vehicle declaration (received / swapped / returned).
// Kept free of React so they can be unit-tested and mirror the server checks in
// supabase/migrations/20261026100000_worker_vehicle_flow.sql.

export const DECLARATION_ACTIONS = ['received', 'swapped', 'returned'];

export const CHECKLIST_ITEMS = [
  { key: 'pascal_removed', label: 'הסרתי את הפסקל' },
  { key: 'dalkan_blocked', label: 'הסרתי / חסמתי את הדלקן' },
  { key: 'no_equipment_left', label: 'לא נשאר ציוד ברכב' },
  { key: 'license_photo_sent', label: 'צילום רישיון הרכב נשלח למשרד' },
  { key: 'insurance_cert_sent', label: 'תעודת הביטוח נשלחה למשרד' },
];

export function takesVehicle(action) {
  return action === 'received' || action === 'swapped';
}

export function givesVehicle(action) {
  return action === 'returned' || action === 'swapped';
}

/** The Dalkan fuel card must be removed or blocked when a temporary vehicle is taken. */
export function dalkanRequired(action, use) {
  return takesVehicle(action) && use === 'temporary';
}

const isKm = (value) => value !== '' && value !== null && value !== undefined && Number.isInteger(Number(value)) && Number(value) >= 0;

/**
 * Returns a list of Hebrew error messages; empty when the form can be sent.
 * `form`: { action, vehicleId, returnedVehicleId, use, odometer, returnedOdometer,
 *           checklist, liabilityAck, signature, happenedAt }
 */
export function validateDeclaration(form, now = new Date()) {
  const errors = [];
  if (!DECLARATION_ACTIONS.includes(form.action)) return ['יש לבחור פעולה.'];
  if (!form.vehicleId) errors.push(form.action === 'returned' ? 'יש לבחור את הרכב שהוחזר.' : 'יש לבחור רכב.');
  if (form.action === 'swapped') {
    if (!form.returnedVehicleId) errors.push('יש לבחור את הרכב שמחזירים.');
    else if (form.returnedVehicleId === form.vehicleId) errors.push('הרכב המוחזר והרכב החדש זהים.');
  }
  if (form.odometer !== '' && form.odometer != null && !isKm(form.odometer)) errors.push('ק"מ חייב להיות מספר שלם שאינו שלילי.');
  if (form.returnedOdometer !== '' && form.returnedOdometer != null && !isKm(form.returnedOdometer)) {
    errors.push('ק"מ החזרה חייב להיות מספר שלם שאינו שלילי.');
  }
  if (form.action === 'returned' && !isKm(form.odometer)) errors.push('יש להזין ק"מ החזרה.');
  if (form.happenedAt && new Date(form.happenedAt).getTime() > now.getTime() + 5 * 60 * 1000) {
    errors.push('לא ניתן לדווח על זמן עתידי.');
  }
  if (takesVehicle(form.action)) {
    if (!form.liabilityAck) errors.push('יש לאשר את הצהרת האחריות.');
    if (!form.signature) errors.push('יש לחתום על הטופס.');
    if (dalkanRequired(form.action, form.use) && !form.checklist?.dalkan_blocked) {
      errors.push('ברכב זמני חובה להסיר או לחסום את הדלקן.');
    }
  }
  return errors;
}

/** Server error codes (from the RPC) mapped to a message for the worker. */
export function declarationErrorMessage(error) {
  const text = String(error?.message || '');
  const map = {
    odometer_lower: 'הק"מ שהוזן נמוך מהק"מ הגבוה ביותר שנרשם ברכב. יש לפנות למשרד.',
    not_your_vehicle: 'הרכב אינו רשום על שמך.',
    vehicle_not_available: 'הרכב אינו זמין לשימוש.',
    liability_required: 'יש לאשר את הצהרת האחריות.',
    signature_required: 'יש לחתום על הטופס.',
    dalkan_required: 'ברכב זמני חובה להסיר או לחסום את הדלקן.',
    returned_vehicle_required: 'יש לבחור את הרכב שמחזירים.',
    time_in_future: 'לא ניתן לדווח על זמן עתידי.',
    month_out_of_range: 'ניתן לדווח דלק לחודש הנוכחי או לחודש הקודם בלבד.',
    invalid_liters: 'יש להזין כמות ליטרים תקינה.',
    invalid_amount: 'יש להזין סכום תקין.',
  };
  const code = Object.keys(map).find((key) => text.includes(key));
  return code ? map[code] : '';
}
