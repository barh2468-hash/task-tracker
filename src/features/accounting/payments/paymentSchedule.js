// Pure helpers for the monthly installment update. Months are 'YYYY-MM-01'.

export function monthDiff(fromMonth, toMonth) {
  const [fy, fm] = fromMonth.split('-').map(Number);
  const [ty, tm] = toMonth.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

// Payment number for `month`, counted from the fixed base columns (L, M).
export function paymentNoFor(device, month) {
  return device.base_payment_no + monthDiff(device.base_month, month);
}

export function balanceFor(device, paymentNo) {
  return Math.max(device.total_payments - paymentNo, 0) * Number(device.monthly_payment);
}

export function projectDevice(device, month) {
  const raw = paymentNoFor(device, month);
  const paymentNo = Math.min(Math.max(raw, 0), device.total_payments);
  return {
    due_month: month,
    payment_no: paymentNo,
    balance: balanceFor(device, paymentNo),
    finished: paymentNo >= device.total_payments,
    overrun: raw > device.total_payments,
  };
}

export function formatMonth(month) {
  if (!month) return '';
  const [y, m] = month.split('-');
  return `${m}/${y}`;
}

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
