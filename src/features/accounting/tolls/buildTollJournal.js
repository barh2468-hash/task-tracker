import {
  GENERAL_VEHICLE_CARD,
  RECOGNIZED_VAT_FRACTION,
  TOLL_REMARK_PREFIX,
  TOLL_SUPPLIER_ACCOUNT_TYPE,
  TOLL_SUPPLIER_CARD,
  TRUCKS,
  VAT_INPUT_CARD,
  VAT_RATE_PERCENT,
} from '../fuel/fuelConfig.js';
import { balanceCheck, money, pad, sapDate } from '../fuel/journalCommon.js';

/**
 * Journal entries for one Road 6 tax invoice. All maths is in integer cents.
 *
 * Posting, value, document and VAT dates are all the invoice issue date.
 * Reference 2 = invoice number, reference 3 = allocation number (when the
 * invoice has one). General vehicles carry 2/3 of the VAT, trucks are booked
 * alone with the full VAT, then the general-vehicle card is split over the
 * vehicles (the last vehicle takes the balance).
 */
export function buildTollJournal(invoice, cardFor) {
  const { invoiceNumber, allocationNumber, issueDate, taxableCents, vatCents, totalCents, vehicles } = invoice;
  const dateText = sapDate(issueDate);
  const remark = `${TOLL_REMARK_PREFIX} ${pad(issueDate.month)}.${String(issueDate.year).slice(2)}`;
  const header = (ref2) => ({ posting: dateText, due: dateText, document: dateText, vat: dateText, remarks: remark, ref2, ref3: allocationNumber });
  const invoiceDigits = invoiceNumber.replace(/\D/g, '');

  // A vehicle can appear on more than one row; sum per vehicle, keeping invoice order.
  const byPlate = new Map();
  for (const row of vehicles) {
    const current = byPlate.get(row.plateDigits) || { plate: row.plate, plateDigits: row.plateDigits, exVatCents: 0 };
    current.exVatCents += row.exVatCents;
    byPlate.set(row.plateDigits, current);
  }
  const perVehicle = [...byPlate.values()];
  const trucks = perVehicle
    .filter((v) => TRUCKS[v.plateDigits])
    .map((v) => {
      const vat = Math.round((v.exVatCents * VAT_RATE_PERCENT) / 100);
      return { ...v, vatCents: vat, inclVatCents: v.exVatCents + vat };
    });
  const others = perVehicle.filter((v) => !TRUCKS[v.plateDigits]);

  const truckInclCents = trucks.reduce((sum, v) => sum + v.inclVatCents, 0);
  const truckVatCents = trucks.reduce((sum, v) => sum + v.vatCents, 0);
  const generalInclCents = totalCents - truckInclCents;
  const generalVatCents = Math.round((vatCents - truckVatCents) * RECOGNIZED_VAT_FRACTION);
  const generalExpenseCents = generalInclCents - generalVatCents;

  const supplierName = 'כביש 6 (דרך ארץ הייווייז) — ספק';
  const entries = [
    {
      step: 1,
      key: 'general',
      title: 'פקודה כללית — רכבים כלליים',
      ...header(invoiceNumber),
      lines: [
        { type: 'GL', code: GENERAL_VEHICLE_CARD, name: 'רכב כללי', debit: generalExpenseCents },
        { type: 'GL', code: VAT_INPUT_CARD, name: 'מע"מ תשומות', debit: generalVatCents },
        { type: TOLL_SUPPLIER_ACCOUNT_TYPE, code: TOLL_SUPPLIER_CARD, name: supplierName, credit: generalInclCents },
      ],
    },
  ];

  for (const truck of trucks) {
    const cfg = TRUCKS[truck.plateDigits];
    entries.push({
      step: 1,
      key: `truck-${truck.plateDigits}`,
      title: `${cfg.name} — ${truck.plate}`,
      ...header(invoiceDigits.slice(-cfg.refDigits)),
      lines: [
        { type: 'GL', code: cfg.card, name: cfg.name, debit: truck.exVatCents },
        { type: 'GL', code: VAT_INPUT_CARD, name: 'מע"מ תשומות', debit: truck.vatCents },
        { type: TOLL_SUPPLIER_ACCOUNT_TYPE, code: TOLL_SUPPLIER_CARD, name: supplierName, credit: truck.inclVatCents },
      ],
    });
  }

  const unmappedPlates = [];
  const rows = others.map((v) => {
    const code = cardFor(v.plateDigits);
    if (!code) unmappedPlates.push(v);
    return { plate: v.plate, code, cents: v.exVatCents };
  });
  const lastRow = rows[rows.length - 1];
  const allButLast = rows.slice(0, -1).reduce((sum, row) => sum + row.cents, 0);
  const gapCents = lastRow ? generalExpenseCents - allButLast - lastRow.cents : 0;
  if (lastRow) lastRow.cents = generalExpenseCents - allButLast;

  entries.push({
    step: 2,
    key: 'split',
    title: 'פיצול רכב כללי לכרטיסי הרכבים',
    ...header(invoiceNumber),
    lines: [
      { type: 'GL', code: GENERAL_VEHICLE_CARD, name: 'רכב כללי', debit: -generalExpenseCents },
      ...rows.map((row) => ({ type: 'GL', code: row.code, name: `רכב ${row.plate}`, debit: row.cents })),
    ],
  });

  const sumRowsCents = vehicles.reduce((sum, row) => sum + row.exVatCents, 0);
  const expectedVat = Math.round((taxableCents * VAT_RATE_PERCENT) / 100);
  const checks = [
    {
      ok: sumRowsCents === taxableCents,
      label: `סכום הרכבים (${money(sumRowsCents)}) = סה"כ לפני מע"מ בחשבונית (${money(taxableCents)})`,
    },
    {
      ok: taxableCents + vatCents === totalCents,
      label: `חשבונית: ${money(taxableCents)} + מע"מ ${money(vatCents)} = ${money(totalCents)}`,
    },
    {
      ok: Math.abs(vatCents - expectedVat) <= 1,
      label: `המע"מ בחשבונית (${money(vatCents)}) = ${VAT_RATE_PERCENT}% מהסכום לפני מע"מ (${money(expectedVat)})`,
    },
    ...entries.map(balanceCheck),
    {
      ok: unmappedPlates.length === 0,
      label: unmappedPlates.length ? `${unmappedPlates.length} רכבים ללא כרטיס` : 'לכל הרכבים יש כרטיס',
    },
  ];
  if (lastRow && lastRow.cents < 0) checks.push({ ok: false, label: 'הרכב האחרון יצא בסכום שלילי' });

  return {
    kind: 'toll',
    fileTag: invoiceDigits,
    entries,
    checks,
    unmappedPlates,
    gapCents,
    lastPlate: lastRow ? lastRow.plate : '',
    ok: checks.every((check) => check.ok),
    period: { year: issueDate.year, month: issueDate.month },
    invoiceNumber,
    totalCents,
  };
}
