export const pad = (n) => String(n).padStart(2, '0');
export const sapDate = ({ year, month, day }) => `${year}/${pad(month)}/${pad(day)}`;
export const money = (cents) => (cents / 100).toFixed(2);

export function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** Sum of debits / credits of one entry, in cents. */
export function entryTotals(entry) {
  return {
    debit: entry.lines.reduce((sum, line) => sum + (line.debit || 0), 0),
    credit: entry.lines.reduce((sum, line) => sum + (line.credit || 0), 0),
  };
}

/** Balance check shared by the fuel and wash journals. */
export function balanceCheck(entry) {
  const { debit, credit } = entryTotals(entry);
  if (entry.step === 2) {
    return { ok: debit === 0, label: `${entry.title}: הרכבים מסתכמים בדיוק לסכום ברכב כללי (הפרש ${money(debit)})` };
  }
  return { ok: debit === credit, label: `${entry.title}: חובה ${money(debit)} = זכות ${money(credit)}` };
}
