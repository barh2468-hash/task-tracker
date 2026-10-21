import {
  GENERAL_VEHICLE_CARD,
  RECOGNIZED_VAT_FRACTION,
  SUPPLIER_ACCOUNT_TYPE,
  SUPPLIER_CARD,
  TRUCKS,
  VAT_INPUT_CARD,
  VAT_RATE_PERCENT,
  WASH_REMARK_PREFIX,
} from './fuelConfig.js';
import { balanceCheck, lastDayOfMonth, money, pad, sapDate } from './journalCommon.js';

/**
 * Journal entries for the Shtipomat car-wash invoice inside the Delek report.
 * Same shape as the fuel journal: one general entry (2/3 VAT), one entry per
 * truck (full VAT), and the step-2 split of card 8223 over the vehicles with
 * the last vehicle taking the balance. Returns null when the month had no
 * washes (the report then has no wash invoice and no wash page).
 */
export function buildWashJournal(report, cardFor) {
  const { wash, period } = report;
  if (!wash) return null;

  const posting = { year: period.year, month: period.month, day: lastDayOfMonth(period.year, period.month) };
  const postingText = sapDate(posting);
  const remark = `${WASH_REMARK_PREFIX} ${pad(period.month)}.${String(period.year).slice(2)}`;
  // Due date = posting date (accounting's rule for the wash invoice).
  const header = (ref2) => ({ posting: postingText, due: postingText, document: postingText, vat: postingText, remarks: remark, ref2 });

  // Washes per vehicle, in report order.
  const byPlate = new Map();
  for (const row of wash.rows) {
    const current = byPlate.get(row.plateDigits) || { plate: row.plate, plateDigits: row.plateDigits, exVatCents: 0, count: 0 };
    current.exVatCents += row.exVatCents;
    current.count += 1;
    byPlate.set(row.plateDigits, current);
  }
  const vehicles = [...byPlate.values()];
  const trucks = vehicles.filter((v) => TRUCKS[v.plateDigits]);
  const others = vehicles.filter((v) => !TRUCKS[v.plateDigits]);

  const truckParts = trucks.map((truck) => {
    const vat = Math.round((truck.exVatCents * VAT_RATE_PERCENT) / 100);
    return { ...truck, vatCents: vat, inclVatCents: truck.exVatCents + vat };
  });
  const truckInclCents = truckParts.reduce((sum, v) => sum + v.inclVatCents, 0);
  const generalInclCents = wash.invoiceTotalCents - truckInclCents;
  const recognizedPercent = VAT_RATE_PERCENT * RECOGNIZED_VAT_FRACTION;
  const generalVatCents = Math.round((generalInclCents * recognizedPercent) / (100 + VAT_RATE_PERCENT));
  const generalExpenseCents = generalInclCents - generalVatCents;

  const supplierName = 'שטיפומט (חברת הדלק) — ספק';
  const entries = [];

  entries.push({
    step: 1,
    key: 'general',
    title: 'פקודה כללית — שטיפות רכבים כלליים',
    ...header(wash.invoiceNumber),
    lines: [
      { type: 'GL', code: GENERAL_VEHICLE_CARD, name: 'רכב כללי', debit: generalExpenseCents },
      { type: 'GL', code: VAT_INPUT_CARD, name: 'מע"מ תשומות', debit: generalVatCents },
      { type: SUPPLIER_ACCOUNT_TYPE, code: SUPPLIER_CARD, name: supplierName, credit: generalInclCents },
    ],
  });

  for (const truck of truckParts) {
    const cfg = TRUCKS[truck.plateDigits];
    entries.push({
      step: 1,
      key: `truck-${truck.plateDigits}`,
      title: `${cfg.name} — ${truck.plate}`,
      ...header(wash.invoiceNumber.slice(-cfg.refDigits)),
      lines: [
        { type: 'GL', code: cfg.card, name: cfg.name, debit: truck.exVatCents },
        { type: 'GL', code: VAT_INPUT_CARD, name: 'מע"מ תשומות', debit: truck.vatCents },
        { type: SUPPLIER_ACCOUNT_TYPE, code: SUPPLIER_CARD, name: supplierName, credit: truck.inclVatCents },
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
    ...header(wash.invoiceNumber),
    lines: [
      { type: 'GL', code: GENERAL_VEHICLE_CARD, name: 'רכב כללי', debit: -generalExpenseCents },
      ...rows.map((row) => ({ type: 'GL', code: row.code, name: `רכב ${row.plate}`, debit: row.cents })),
    ],
  });

  const sumRowsCents = wash.rows.reduce((sum, row) => sum + row.exVatCents, 0);
  const checks = [
    {
      ok: sumRowsCents === wash.reportTotalCents,
      label: `סכום הרחיצות בדוח (${money(sumRowsCents)}) = סה"כ דוח רחיצות (${money(wash.reportTotalCents)})`,
    },
    {
      ok: wash.reportTotalCents === wash.taxableCents,
      label: `סה"כ דוח רחיצות (${money(wash.reportTotalCents)}) = סה"כ חייב במע"מ בחשבונית (${money(wash.taxableCents)})`,
    },
    {
      ok: wash.taxableCents + wash.exemptCents + wash.vatCents === wash.invoiceTotalCents,
      label: `חשבונית: ${money(wash.taxableCents)} + מע"מ ${money(wash.vatCents)} = ${money(wash.invoiceTotalCents)}`,
    },
    ...(wash.reportCount !== null
      ? [{ ok: wash.reportCount === wash.rows.length, label: `מספר הרחיצות שנקראו (${wash.rows.length}) = מספר הרחיצות בדוח (${wash.reportCount})` }]
      : []),
    ...entries.map(balanceCheck),
    {
      ok: unmappedPlates.length === 0,
      label: unmappedPlates.length ? `${unmappedPlates.length} רכבים ללא כרטיס` : 'לכל הרכבים יש כרטיס',
    },
  ];
  if (lastRow && lastRow.cents < 0) checks.push({ ok: false, label: 'הרכב האחרון יצא בסכום שלילי' });

  return {
    kind: 'wash',
    entries,
    checks,
    unmappedPlates,
    gapCents,
    lastPlate: lastRow ? lastRow.plate : '',
    ok: checks.every((check) => check.ok),
    period,
    invoiceNumber: wash.invoiceNumber,
    totalCents: wash.invoiceTotalCents,
  };
}
