const STORAGE_KEYS = ['maya-sheet-draft', 'maya-projects', 'maya-leaders'];
const MAX_VALUE_LENGTH = 200_000;

function validValue(key, value) {
  if (key === 'maya-sheet-draft') return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  return Array.isArray(value) && value.length <= 12 && value.every(item => typeof item === 'string');
}

export function readSheetValues(storage, userId) {
  const values = {};
  if (!userId) return values;
  for (const key of STORAGE_KEYS) {
    try {
      const raw = storage.getItem(`maya-sheets:${userId}:${key}`);
      if (raw && raw.length <= MAX_VALUE_LENGTH) {
        const value = JSON.parse(raw);
        if (validValue(key, value)) values[key] = value;
      }
    } catch { /* A corrupt or unavailable draft should not prevent opening the tool. */ }
  }
  return values;
}

export function saveSheetValue(storage, userId, key, value) {
  if (!userId || !STORAGE_KEYS.includes(key)) return false;
  if (!validValue(key, value)) return false;
  try {
    const raw = JSON.stringify(value);
    if (raw.length > MAX_VALUE_LENGTH) return false;
    storage.setItem(`maya-sheets:${userId}:${key}`, raw);
    return true;
  } catch {
    return false;
  }
}
