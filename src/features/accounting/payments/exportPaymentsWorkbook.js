import { formatMonth } from './paymentSchedule.js';

const HEADERS = [
  'מכשיר',
  "מס' חש'",
  'תאריך קנייה',
  'תשלום חודשי',
  'ת.פרעון',
  'מספר תשלומים',
  'יתרה לתשלום',
  'הערות',
  'תאריך חיוב בסיסי',
  'מספר תשלום בסיסי',
  'סה״כ תשלומים',
];

// Same column meaning as the source sheet; balance is a live formula
// (total - payment number) * monthly payment.
export async function exportPaymentsWorkbook(devices) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('טכנולוגיות תפיסה מרחבית', { views: [{ rightToLeft: true }] });

  const header = sheet.addRow(HEADERS);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFFFF' } };
  });

  devices.forEach((d, i) => {
    const rowNo = i + 2;
    sheet.addRow([
      d.device_label,
      d.invoice_no || '',
      formatMonth(d.purchase_month),
      Number(d.monthly_payment),
      formatMonth(d.due_month),
      `${d.payment_no}/${d.total_payments}`,
      { formula: `(K${rowNo}-${d.payment_no})*D${rowNo}`, result: (d.total_payments - d.payment_no) * Number(d.monthly_payment) },
      d.notes || '',
      formatMonth(d.base_month),
      d.base_payment_no,
      d.total_payments,
    ]);
  });

  const last = devices.length + 1;
  const total = sheet.addRow([
    'סה״כ',
    '',
    '',
    { formula: `SUM(D2:D${last})` },
    '',
    '',
    { formula: `SUM(G2:G${last})` },
  ]);
  total.font = { bold: true };

  sheet.columns.forEach((column, index) => {
    column.width = index === 7 ? 50 : 16;
  });
  sheet.getColumn(4).numFmt = '#,##0';
  sheet.getColumn(7).numFmt = '#,##0';

  const bytes = await workbook.xlsx.writeBuffer();
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'מעקב-תשלומים.xlsx';
  link.click();
  URL.revokeObjectURL(link.href);
}
