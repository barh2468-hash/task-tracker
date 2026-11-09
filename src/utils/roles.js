export function isManagerRole(role) {
  return role === 'manager' || role === 'admin';
}

export function isViewerRole(role) { return role === 'viewer'; }
export function canViewAllRole(role) { return isManagerRole(role) || isViewerRole(role); }

export function isAdminRole(role) {
  return role === 'admin';
}
