export const EQUIPMENT_CHECKLIST_COLUMNS = [
  5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
  28, 29, 30, 31, 32, 33,
];

export function getEquipmentQuantity(value) {
  const text = String(value ?? '').trim();
  if (/^v$/i.test(text)) return 1;
  if (!/^\d+$/.test(text)) return 0;
  return Math.min(999, Math.max(0, Number.parseInt(text, 10) || 0));
}

export function toEquipmentQuantityCell(value) {
  const quantity = Math.min(999, Math.max(0, Number.parseInt(value, 10) || 0));
  return quantity > 0 ? String(quantity) : '-';
}

export function getEquipmentQuantityTotal(cells = []) {
  return EQUIPMENT_CHECKLIST_COLUMNS.reduce(
    (total, index) => total + getEquipmentQuantity(cells[index]),
    0,
  );
}
