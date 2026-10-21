// SAP account codes and rules for the monthly Delek fuel-summary journal.
// Everything accounting may need to change lives here.

export const GENERAL_VEHICLE_CARD = '8223'; // רכב כללי
export const VAT_INPUT_CARD = '6113'; // מע"מ תשומות
export const SUPPLIER_CARD = '5325'; // חברת הדלק הישראלית - ספק
export const SUPPLIER_ACCOUNT_TYPE = 'BP'; // 'BP' = supplier card, 'GL' = ledger account

export const VAT_RATE_PERCENT = 18;
// General vehicles recognise 2/3 of the VAT (12/118 of the gross amount).
export const RECOGNIZED_VAT_FRACTION = 2 / 3;

export const REMARK_PREFIX = 'חש.דלק ריכוז';
export const WASH_REMARK_PREFIX = 'ריכוז שטיפומט';

// Trucks are booked on their own (full 18% VAT). `refDigits` = how many last
// digits of the summary invoice number go into "אסמכתא 2".
export const TRUCKS = {
  5664231: { card: '8243', name: 'משאית קטנה (רנו)', refDigits: 2 },
  8935384: { card: '8288', name: 'משאית גדולה', refDigits: 3 },
  45363903: { card: '8397', name: 'משאית סופר מאן', refDigits: 4 },
};

// plate digits -> SAP vehicle card (seeded from the August 2026 step-2 file).
export const SEED_VEHICLE_CARDS = {
  6554434: '8399',
  11019704: '8182',
  11261004: '8191',
  17423303: '8360',
  22626903: '8368',
  22910103: '8365',
  28470703: '8362',
  31863903: '8364',
  42442202: '8369',
  43654203: '8205', // from the balance-prep file (verify: vehicle 436-54-203)
  49578004: '8230',
  50308503: '8371',
  55330203: '8398',
  58109604: '8261',
  62131603: '8277',
  65177503: '8238',
  70322103: '8272',
  70815503: '8291',
  74719901: '8251',
  75143803: '8237',
  78718201: '8193',
  82119903: '8272',
  83493903: '8181',
  87446603: '8187',
  88393803: '8270',
};
