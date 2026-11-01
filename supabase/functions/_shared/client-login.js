// An internal Auth identifier only. No mailbox or email delivery is required.
const CLIENT_DOMAIN = 'clients.maya.invalid';
export function normalizeClientUsername(value) {
  const username = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[a-z0-9][a-z0-9_-]{2,47}$/.test(username) ? username : null;
}
export function clientLoginEmail(username) {
  const normalized = normalizeClientUsername(username);
  return normalized ? `${normalized}@${CLIENT_DOMAIN}` : null;
}
export function clientUsernameFromEmail(email) {
  if (typeof email !== 'string' || !email.toLowerCase().endsWith(`@${CLIENT_DOMAIN}`)) return null;
  return normalizeClientUsername(email.slice(0, email.lastIndexOf('@')));
}
export function resolveLoginIdentifier(value) {
  const identifier = typeof value === 'string' ? value.trim() : '';
  return identifier.includes('@') ? identifier : clientLoginEmail(identifier);
}
