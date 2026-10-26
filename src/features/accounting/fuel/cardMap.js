// Manually entered plate -> SAP vehicle card codes, kept in this browser only.
const STORAGE_KEY = 'maya-fuel-card-map';

export function loadManualMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveManualMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Mapping still works for this session if storage is unavailable.
  }
}
