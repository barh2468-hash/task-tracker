const restrictedPaths = [
  '/app/vehicles', '/app/vehicle-register', '/app/gpr', '/app/work-plan',
  '/app/accounting/year-end', '/app/accounting/fuel', '/app/accounting/cross-north',
];

export function viewerPathBlocked(pathname) {
  if (typeof pathname !== 'string') return false;
  let path;
  try { path = decodeURIComponent(pathname).replace(/\/+/g, '/').toLowerCase(); }
  catch { return true; }
  return restrictedPaths.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}
