/**
 * These workbooks accumulate one sheet per year in the same file rather
 * than being re-exported fresh each year (e.g. "2021".."2025"). Picks the
 * sheet for the requested year, falling back to the closest earlier year
 * (the most recent carried-forward data) when that year's own sheet
 * doesn't exist yet, instead of blindly using the first (oldest) sheet.
 *
 * Returns the resolved year alongside the sheet: this reconciliation flow
 * combines two independently-uploaded files, so silently substituting a
 * different year's sheet in just one of them (e.g. the requested year was
 * never created yet in the workbook) must never pass unnoticed — the caller
 * is expected to surface `matchedYear !== year` to the user instead of
 * quietly proceeding.
 */
export function pickYearSheet(workbook, year) {
  const yearSheets = workbook.SheetNames.filter((name) => /^\d{4}$/.test(name));
  if (!yearSheets.length) return { sheet: workbook.Sheets[workbook.SheetNames[0]], matchedYear: null };

  const exactMatch = String(year);
  if (yearSheets.includes(exactMatch)) return { sheet: workbook.Sheets[exactMatch], matchedYear: year };

  const atOrBefore = yearSheets.filter((name) => Number(name) <= year).sort((a, b) => Number(b) - Number(a));
  const fallbackName = atOrBefore[0] || yearSheets.sort((a, b) => Number(a) - Number(b))[0];
  return { sheet: workbook.Sheets[fallbackName], matchedYear: Number(fallbackName) };
}
