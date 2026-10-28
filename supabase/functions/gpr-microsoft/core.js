import { parseGprEmail, orderPayload } from '../_shared/gpr-model.js';

export class IntakeError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export const normalizeEmail = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();
export const validEmail = (value) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const uuid = (value) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value || '');
const bytes = (value) => new TextEncoder().encode(value);
export const base64url = (value) =>
  btoa(String.fromCharCode(...value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
const unbase64 = (value) =>
  Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
export const randomSecret = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export const digest = async (value) =>
  base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(value))));
export function secureEqual(a, b) {
  if (!a || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export function readConfig(env) {
  const tenant = env('M365_TENANT_ID') || '',
    client = env('M365_CLIENT_ID') || '',
    secret = env('M365_CLIENT_SECRET') || '',
    key = env('GPR_M365_TOKEN_KEY') || '';
  const missing = [];
  if (!uuid(tenant)) missing.push('M365_TENANT_ID');
  if (!uuid(client)) missing.push('M365_CLIENT_ID');
  if (!secret) missing.push('M365_CLIENT_SECRET');
  try {
    if (unbase64(key).length !== 32) missing.push('GPR_M365_TOKEN_KEY');
  } catch {
    missing.push('GPR_M365_TOKEN_KEY');
  }
  return {
    tenant,
    client,
    secret,
    key,
    missing,
    callback: `${env('SUPABASE_URL')}/functions/v1/gpr-microsoft?callback=1`,
  };
}
export function allowedOrigins(env) {
  const values = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    env('APP_URL'),
    ...(env('GPR_M365_APP_ORIGINS') || '').split(','),
  ];
  return new Set(
    values.filter(Boolean).flatMap((value) => {
      try {
        const u = new URL(value);
        return u.protocol === 'https:' ||
          ['http://localhost:5173', 'http://127.0.0.1:5173'].includes(u.origin)
          ? [u.origin]
          : [];
      } catch {
        return [];
      }
    }),
  );
}
export async function seal(value, key) {
  const imported = await crypto.subtle.importKey('raw', unbase64(key), 'AES-GCM', false, [
    'encrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: bytes('maya-gpr-m365-v1') },
    imported,
    bytes(value),
  );
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(cipher))}`;
}
export async function unseal(value, key) {
  try {
    const [version, iv, cipher] = String(value).split('.');
    if (version !== 'v1') throw new IntakeError('reconnect', 409);
    const imported = await crypto.subtle.importKey('raw', unbase64(key), 'AES-GCM', false, [
      'decrypt',
    ]);
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: unbase64(iv), additionalData: bytes('maya-gpr-m365-v1') },
        imported,
        unbase64(cipher),
      ),
    );
  } catch {
    throw new IntakeError('reconnect', 409);
  }
}
export function validateSettings(input) {
  const mailbox = normalizeEmail(input.mailbox);
  const allowed_senders = [
    ...new Set(
      (Array.isArray(input.allowed_senders) ? input.allowed_senders : []).map(normalizeEmail),
    ),
  ];
  if (
    !validEmail(mailbox) ||
    !allowed_senders.length ||
    allowed_senders.length > 50 ||
    allowed_senders.some((email) => !validEmail(email))
  )
    throw new IntakeError('settings_invalid');
  return {
    mailbox,
    allowed_senders,
  };
}
export function authorizeUrl(config, state, challenge, mailbox) {
  const u = new URL(`https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/authorize`);
  u.search = new URLSearchParams({
    client_id: config.client,
    response_type: 'code',
    redirect_uri: config.callback,
    response_mode: 'query',
    scope:
      'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
    login_hint: mailbox,
  }).toString();
  return u.href;
}
export async function tokenRequest(config, parameters, fetcher = fetch) {
  const response = await fetcher(
    `https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.client,
        client_secret: config.secret,
        redirect_uri: config.callback,
        ...parameters,
      }),
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    },
  );
  const body = await response.json();
  if (!response.ok || !body.access_token)
    throw new IntakeError(
      body.error === 'invalid_grant' ? 'reconnect' : 'microsoft_error',
      response.status === 429 ? 429 : 502,
    );
  return body;
}
export function safeGraphUrl(raw) {
  const u = new URL(raw);
  if (
    u.origin !== 'https://graph.microsoft.com' ||
    !u.pathname.startsWith('/v1.0/') ||
    u.username ||
    u.password ||
    u.hash
  )
    throw new IntakeError('graph_url', 502);
  return u.href;
}
export function safeMailboxUrl(raw, connection) {
  const u = new URL(safeGraphUrl(raw)),
    path = decodeURIComponent(u.pathname);
  const prefixes = ['/v1.0/me', `/v1.0/users/${connection.mailbox_object_id}`];
  const paths = [...prefixes, `/v1.0/users('${connection.mailbox_object_id}')`].map(
    (prefix) => `${prefix}/messages`,
  );
  if (!paths.some((value) => value === path)) throw new IntakeError('graph_url', 502);
  return u.href;
}
export async function graphGet(path, token, fetcher = fetch) {
  const url = safeGraphUrl(
    path.startsWith('https:') ? path : `https://graph.microsoft.com/v1.0${path}`,
  );
  const response = await fetcher(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.body-content-type="text", IdType="ImmutableId"',
    },
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  if (!response.ok)
    throw new IntakeError(
      response.status === 410
        ? 'delta_expired'
        : response.status === 401
          ? 'reconnect'
          : response.status === 429
            ? 'throttled'
            : 'microsoft_error',
      response.status,
    );
  const text = await response.text();
  if (text.length > 2000000) throw new IntakeError('oversized', 502);
  return JSON.parse(text);
}
export const LOOKBACK_DAYS = 14;
const LOOKBACK_MS = LOOKBACK_DAYS * 86400000;
export function mailboxLookbackStart(now = new Date().toISOString()) {
  const end = Date.parse(now);
  if (!Number.isFinite(end)) throw new IntakeError('microsoft_error', 502);
  return new Date(end - LOOKBACK_MS).toISOString();
}
// Every completed scan starts a fresh rolling fortnight. An unfinished scan
// resumes Graph's opaque nextLink unchanged; local date checks still enforce
// the current cutoff, even if a message ages out while paging is in progress.
export function mailboxScan(connection, now = new Date().toISOString()) {
  const cutoff = mailboxLookbackStart(now);
  let saved;
  try {
    saved = JSON.parse(connection.delta_url);
  } catch {
    /* Legacy folder or incremental cursor. */
  }
  const savedStart = Date.parse(saved?.since),
    savedEnd = Date.parse(saved?.until);
  const valid =
    saved?.version === 3 &&
    typeof saved.next === 'string' &&
    savedEnd - savedStart === LOOKBACK_MS &&
    savedEnd <= Date.parse(now) &&
    savedEnd > Date.parse(cutoff);
  const since = valid ? saved.since : cutoff;
  const until = valid ? saved.until : now;
  const query = new URLSearchParams({
    $select:
      'id,internetMessageId,conversationId,subject,from,sender,receivedDateTime,hasAttachments,webLink,isDraft',
    $top: '25',
    $orderby: 'receivedDateTime desc',
    $filter: `receivedDateTime ge ${since} and receivedDateTime le ${until} and (${connection.allowed_senders
      .map((email) => `from/emailAddress/address eq '${email.replaceAll("'", "''")}'`)
      .join(' or ')})`,
  });
  const next = valid ? saved.next : null;
  return {
    version: 3,
    since,
    until,
    cutoff,
    url: next
      ? safeMailboxUrl(next, connection)
      : `https://graph.microsoft.com/v1.0/me/messages?${query}`,
  };
}
export function mailboxCheckpoint(scan, next, connection) {
  if (next) {
    safeMailboxUrl(next, connection);
    return JSON.stringify({ version: 3, since: scan.since, until: scan.until, next });
  }
  return JSON.stringify({ version: 3 });
}
export function allowedMessage(meta, connection) {
  const sender = normalizeEmail(meta.from?.emailAddress?.address);
  const actual = normalizeEmail(meta.sender?.emailAddress?.address);
  return (
    !meta.isDraft &&
    connection.allowed_senders.includes(sender) &&
    (!actual || connection.allowed_senders.includes(actual))
  );
}
export function outlookUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' &&
      ['outlook.office.com', 'outlook.office365.com', 'outlook.live.com'].includes(u.hostname)
      ? u.href
      : '';
  } catch {
    return '';
  }
}
export function prepareMessage(meta, full, connection) {
  const sender = normalizeEmail(meta.from?.emailAddress?.address),
    actual = normalizeEmail(meta.sender?.emailAddress?.address);
  const accepted = allowedMessage(meta, connection);
  const original = String(full?.body?.content || '');
  const plain = full?.body?.contentType?.toLowerCase() === 'text';
  const body = original.slice(0, 100000);
  const message = {
    key: String(meta.internetMessageId || meta.id || ''),
    conversation: String(meta.conversationId || ''),
    sender,
    actual_sender: actual,
    subject: String(meta.subject || '').slice(0, 1000),
    body: accepted ? body : '',
    received: meta.receivedDateTime || null,
    attachments: Boolean(meta.hasAttachments),
    web_url: outlookUrl(meta.webLink),
  };
  if (!message.key || message.key.length > 2048) throw new IntakeError('invalid_message', 502);
  if (!accepted) return { message, order: null };
  if (!/\bGPR\b/i.test(`${meta.subject || ''}\n${plain ? body : ''}`)) {
    message.body = '';
    message.reason = 'not_gpr';
    return { message, order: null };
  }
  if (!plain || original.length > 100000 || String(meta.subject || '').length > 1000) {
    message.reason = plain ? 'oversized' : 'unrecognized';
    return { message, order: null };
  }
  const parsed = parseGprEmail(body, meta.subject);
  if (!parsed.order_number || !parsed.description) {
    message.reason = 'unrecognized';
    return { message, order: null };
  }
  const issuer = /^([\s\S]*?)\s*[-–—]\s*פרויקט(?:\s|:)/u.exec(
    String(meta.subject || '').replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i, ''),
  );
  parsed.client_name = issuer?.[1]?.trim() || sender.split('@')[1];
  if (
    parsed.title.length > 300 ||
    parsed.client_name.length > 254 ||
    parsed.description.length > 10000
  ) {
    message.reason = 'oversized';
    return { message, order: null };
  }
  return { message, order: orderPayload(parsed) };
}
