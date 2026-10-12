export function isManagerRole(role) {
  return role === 'manager' || role === 'admin';
}

export function isAdminRole(role) {
  return role === 'admin';
}
