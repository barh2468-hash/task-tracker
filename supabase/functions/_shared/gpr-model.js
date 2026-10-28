export const GPR_STATUSES = [
  'new',
  'scheduled',
  'scanning',
  'interpretation',
  'clarification',
  'completed',
  'cancelled',
];
export const REQUIREMENT_KEYS = ['plan', 'schedule', 'crew', 'copies', 'ttl'];

export function emptyOrder() {
  return {
    title: '',
    order_number: '',
    client_name: '',
    location: '',
    description: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    planned_days: '',
    scheduled_for: '',
    status: 'new',
    requirements: [],
    notes: '',
    source_email: '',
    source_subject: '',
    project_id: '',
  };
}

// Deliberately conservative: retain the original email and leave uncertain fields blank.
// This parser reads plain text as data; email contents never become executable instructions.
export function parseGprSubject(rawSubject) {
  const subject = String(rawSubject || '')
    .trim()
    .replace(/^(?:(?:re|fw|fwd|השב|הועבר)\s*:\s*)+/i, '');
  const gprMarker = /[-–—]\s*GPR(?=\s|[-–—]|$)/i.exec(subject);
  const workPart = (gprMarker ? subject.slice(0, gprMarker.index) : subject).trim();
  const projectMarker = /(?:^|[-–—]\s*)(פרויקט(?:\s|:))/u.exec(workPart);
  const projectStart = projectMarker
    ? projectMarker.index + projectMarker[0].length - projectMarker[1].length
    : 0;
  const title = workPart.slice(projectStart).trim();
  // Recognize explicit location labels or known city suffixes. An arbitrary
  // final word in a project name must not become an invented location.
  const cities = [
    'מודיעין מכבים רעות',
    'תל אביב-יפו',
    'באר שבע',
    'ראשון לציון',
    'פתח תקווה',
    'כפר סבא',
    'הוד השרון',
    'רמת השרון',
    'רמת גן',
    'בני ברק',
    'בת ים',
    'בית שמש',
    'נס ציונה',
    'ראש העין',
    'קריית גת',
    'קרית גת',
    'קריית שמונה',
    'קרית שמונה',
    'תל אביב',
    'ירושלים',
    'חיפה',
    'אילת',
    'אשדוד',
    'אשקלון',
    'נתניה',
    'הרצליה',
    'רחובות',
    'חולון',
    'רעננה',
    'מודיעין',
    'נהריה',
    'דימונה',
    'נתיבות',
    'אופקים',
    'יבנה',
    'גבעתיים',
    'רמלה',
    'לוד',
    'עכו',
    'נצרת',
    'טבריה',
  ];
  const citySuffix = new RegExp(`(?:^|[\\s,])(${cities.join('|')})[.!]?$`, 'u');
  const explicit = /(?:^|[-–—,;]\s*)(?:מיקום|location)\s*:\s*(.+)$/i.exec(title);
  return {
    title: explicit ? title.slice(0, explicit.index).trim() : title,
    location: explicit?.[1]?.trim() || citySuffix.exec(title)?.[1] || '',
  };
}

export function parseGprEmail(raw, subject = '') {
  const text = String(raw || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ');
  const normalized = text.replace(/[״“”]/g, '"').replace(/[׳’]/g, "'");
  // Label matching may normalize punctuation; extracted names and prose must not.
  const capture = (pattern) => {
    const match = normalized.match(pattern);
    if (!match?.[1]) return '';
    const start = match.index + match[0].length - match[1].length;
    return text.slice(start, start + match[1].length);
  };
  const order = emptyOrder();
  order.source_email = String(raw || '');
  order.source_subject = String(
    subject || text.match(/^(?:נושא|subject)\s*:\s*(.+)$/im)?.[1] || '',
  );
  Object.assign(order, parseGprSubject(order.source_subject));
  order.order_number =
    normalized.match(
      /(?:מס(?:פר|['.]|\s*')?\s*הזמנה|order\s*(?:number|no\.?|#))\s*[:：#]?\s*([\w/-]+)/i,
    )?.[1] || '';
  order.description = capture(
    /(?:מהות\s*העבודה|scope\s*of\s*work)\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:מס(?:פר|['.]|\s*')?\s*הזמנה|order\s*(?:number|no|#)|מנה["']?פ)|$)/i,
  )
    .trim()
    .replace(/^[•\s]+/, '');
  const contactBlock = capture(
    /(?:מנה["']?פ|project\s*manager)\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:מכון|לידיעה|מע['.]|מנה["']?פ\s*מוסר|תודה)|$)/i,
  );
  order.contact_name =
    contactBlock
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) || '';
  order.contact_phone = contactBlock.match(/(?:\+972[-\s]?|0)[\d\s()-]{8,16}\d/)?.[0]?.trim() || '';
  order.contact_email = contactBlock.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  order.planned_days =
    normalized.match(
      /(?:מתוכנ[ןת]|planned)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:י\s*"?\s*ע|ימי?\s*עבודה|work\s*days?)/i,
    )?.[1] || '';
  const crew = capture(
    /(?:מנה["']?פ\s*מוסר|manager\s*requests)\s*[:：]\s*([\s\S]*?)(?=\n\s*(?:תודה|בברכה|thanks|regards)|$)/i,
  ).trim();
  order.requirements = [
    { key: 'plan', done: false, detail: '' },
    { key: 'schedule', done: false, detail: '' },
    ...(crew ? [{ key: 'crew', done: false, detail: crew }] : []),
    ...(/מכון\s*העתקות/.test(normalized) ? [{ key: 'copies', done: false, detail: '' }] : []),
    ...(/תת["']?ל/.test(normalized) ? [{ key: 'ttl', done: false, detail: '' }] : []),
  ];
  return order;
}

export function orderPayload(form) {
  const result = {};
  for (const key of [
    'title',
    'order_number',
    'client_name',
    'location',
    'description',
    'contact_name',
    'contact_phone',
    'contact_email',
    'notes',
    'source_email',
    'source_subject',
  ]) {
    result[key] = ['notes', 'description', 'source_email', 'source_subject'].includes(key)
      ? String(form[key] || '')
      : String(form[key] || '').trim();
  }
  result.status = form.status;
  result.planned_days =
    form.planned_days === '' || form.planned_days == null ? null : Number(form.planned_days);
  result.scheduled_for = form.scheduled_for || null;
  result.project_id = form.project_id || null;
  result.requirements = (form.requirements || [])
    .filter((item) => REQUIREMENT_KEYS.includes(item.key))
    .map(({ key, done, detail }) => ({
      key,
      done: Boolean(done),
      detail: String(detail || '').trim(),
    }));
  return result;
}

export function orderName(order, t) {
  return (
    order.title ||
    (order.order_number ? t('gpr.orderTitle', { number: order.order_number }) : t('gpr.untitled'))
  );
}

export function isOpenOrder(order) {
  return !['completed', 'cancelled'].includes(order.status);
}
