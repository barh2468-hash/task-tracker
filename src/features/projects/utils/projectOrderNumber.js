export function getProjectOrderNumber(project) {
  const explicitOrderNumber = String(project?.reference_number || '').trim();
  if (explicitOrderNumber) return explicitOrderNumber;

  const numericParts = String(project?.name || '').match(/\d{6,}/g) || [];
  return numericParts.find((value) => value.length === 7) || numericParts[0] || '';
}

export function compareProjectsByOrderNumber(a, b) {
  const aOrderNumber = getProjectOrderNumber(a);
  const bOrderNumber = getProjectOrderNumber(b);

  if (aOrderNumber && bOrderNumber) {
    const numericComparison = Number(aOrderNumber) - Number(bOrderNumber);
    if (numericComparison !== 0) return numericComparison;
  } else if (aOrderNumber) {
    return -1;
  } else if (bOrderNumber) {
    return 1;
  }

  return String(a?.name || '').localeCompare(String(b?.name || ''), 'he', {
    numeric: true,
    sensitivity: 'base',
  });
}
