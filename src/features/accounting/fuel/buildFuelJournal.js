import {
  GENERAL_VEHICLE_CARD,
  RECOGNIZED_VAT_FRACTION,
  REMARK_PREFIX,
  SUPPLIER_ACCOUNT_TYPE,
  SUPPLIER_CARD,
  TRUCKS,
  VAT_INPUT_CARD,
  VAT_RATE_PERCENT,
} from './fuelConfig.js';

const pad = (n) => String(n).padStart(2, '0');
const sapDate = ({ year, month, day }) => `${year}/${pad(month)}/${pad(day)}`;
export const money = (cents) => (cents / 100).toFixed(2);

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Builds the journal entries for one Delek monthly summary.
 * All maths is in integer cents. `cardFor(plateDigits)` returns a card code or ''.
 */
export function buildFuelJournal(report, cardFor) {
  const { totalDueCents, pageTwoTotalCents, chargeDate, invoiceNumber, period, vehicles } = report;
  const posting = { year: period.year, month: period.month, day: lastDayOfMonth(period.year, period.month) };
  const remark = `${REMARK_PREFIX} ${pad(period.month)}.${String(period.year).slice(2)}`;
  const header = (ref2) => ({
    posting: sapDate(posting),
    due: sapDate(chargeDate),
    document: sapDate(posting),
    vat: sapDate(posting),
    remarks: remark,
    ref2,
  });

  const trucks = vehicles.filter((v) => TRUCKS[v.plateDigits]);
  const others = vehicles.filter((v) => !TRUCKS[v.plateDigits]);

  const truckInclCents = trucks.reduce((sum, v) => sum + v.inclVatCents, 0);
  const generalInclCents = totalDueCents - truckInclCents;
  const recognizedPercent = VAT_RATE_PERCENT * RECOGNIZED_VAT_FRACTION;
  const generalVatCents = Math.round((generalInclCents * recognizedPercent) / (100 + VAT_RATE_PERCENT));
  const generalExpenseCents = generalInclCents - generalVatCents;

  const supplierName = 'דלק חברת הדלק הישראלית — ספק';
  const entries = [];

  entries.push({
    step: 1,
    key: 'general',
    title: 'פקודה כללית — רכבים כלליים',
    ...header(invoiceNumber),
    lines: [
      { type: 'GL', code: GENERAL_VEHICLE_CARD, name: 'רכב כללי', debit: generalExpenseCents },
      { type: 'GL', code: VAT_INPUT_CARD, name: 'מע"מ תשומות', debit: generalVatCents },
      { type: SUPPLIER_ACCOUNT_TYPE, code: SUPPLIER_CARD, name: supplierName, credit: generalInclCents },
    ],
  });

  for (const truck of trucks) {
    const cfg = TRUCKS[truck.plateDigits];
    entries.push({
      step: 1,
      key: `truck-${truck.plateDigits}`,
      title: `${cfg.name} — ${truck.plate}`,
      ...header(invoiceNumber.slice(-cfg.refDigits)),
      lines: [
        { type: 'GL', code: cfg.card, name: cfg.name, debit: truck.exVatCents },
        { type: 'GL', code: VAT_INPUT_CARD, name: 'מע"מ תשומות', debit: truck.inclVatCents - truck.exVatCents },
        { type: SUPPLIER_ACCOUNT_TYPE, code: SUPPLIER_CARD, name: supplierName, credit: truck.inclVatCents },
      ],
    });
  }

  // Step 2: split 8223 over the vehicles; the last vehicle takes the balance
  // (the 1/3-of-VAT gap that general vehicles do not recover).
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

  const sumIncl = vehicles.reduce((sum, v) => sum + v.inclVatCents, 0);
  const checks = [
    {
      ok: sumIncl === totalDueCents,
      label: `סכום כל הרכבים בריכוז (${money(sumIncl)}) = סכום לחיוב (${money(totalDueCents)})`,
    },
    ...(pageTwoTotalCents !== null
      ? [{ ok: pageTwoTotalCents === totalDueCents, label: `סה"כ לתשלום בעמוד 2 (${money(pageTwoTotalCents)}) = סכום לחיוב` }]
      : []),
    {
      ok: trucks.length === Object.keys(TRUCKS).length,
      label: `נמצאו ${trucks.length} מתוך ${Object.keys(TRUCKS).length} משאיות בדוח`,
    },
    ...entries.map((entry) => {
      const debit = entry.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
      const credit = entry.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
      if (entry.step === 2) return { ok: debit === 0, label: `${entry.title}: הרכבים מסתכמים בדיוק לסכום ברכב כללי (הפרש ${money(debit)})` };
      return { ok: debit === credit, label: `${entry.title}: חובה ${money(debit)} = זכות ${money(credit)}` };
    }),
    {
      ok: unmappedPlates.length === 0,
      label: unmappedPlates.length ? `${unmappedPlates.length} רכבים ללא כרטיס` : 'לכל הרכבים יש כרטיס',
    },
  ];
  if (lastRow && lastRow.cents < 0) checks.push({ ok: false, label: 'הרכב האחרון יצא בסכום שלילי' });

  return {
    entries,
    checks,
    unmappedPlates,
    gapCents,
    lastPlate: lastRow ? lastRow.plate : '',
    ok: checks.every((check) => check.ok),
    period,
    invoiceNumber,
    totalDueCents,
  };
}
