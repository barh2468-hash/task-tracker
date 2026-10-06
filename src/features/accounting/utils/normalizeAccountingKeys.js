export function normalizeCardNumber(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/^0+(?=\d)/, '');
}

export function normalizePlateNumber(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[^0-9]/g, '');
}

const MIN_PLATE_DIGITS = 6;

/**
 * Free text (a balance label like "8193 - רכב 78718201 קרן", or a payroll
 * row label like "נגרר 80366601") often embeds a plate number — sometimes
 * contiguous, sometimes still dashed ("767-00-501 גבי"). Matches digit runs
 * that may contain internal dashes (so a dashed plate stays one token
 * instead of splitting into 767/00/501), normalizes each, and keeps the ones
 * long enough to be a plate rather than a card number or a date.
 */
export function extractPlateNumbers(text) {
  const candidates = String(text ?? '').match(/\d[\d-]*\d|\d/g) || [];
  return candidates.map(normalizePlateNumber).filter((plate) => plate.length >= MIN_PLATE_DIGITS);
}

// The payroll sheet's first section lists real vehicles by their dashed
// license plate ("747-19-901"); the second section is card-only rows
// (trailers, trucks, fuel refunds, parking) whose "plate" cell is free text
// ("נגרר 80366601", "החזר סולר"). Only the dashed shape is an actual vehicle
// with drivers/months of use.
const DASHED_PLATE_PATTERN = /^\d{2,3}-\d{2,3}-\d{2,3}$/;

export function isVehiclePlate(plateLabel) {
  return DASHED_PLATE_PATTERN.test(String(plateLabel ?? '').trim());
}
