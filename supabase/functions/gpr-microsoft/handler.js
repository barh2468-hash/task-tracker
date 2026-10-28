import {
  IntakeError,
  readConfig,
  allowedOrigins,
  validateSettings,
  randomSecret,
  digest,
  seal,
  unseal,
  authorizeUrl,
  tokenRequest,
  graphGet,
  safeMailboxUrl,
  mailboxScan,
  mailboxCheckpoint,
  LOOKBACK_DAYS,
  allowedMessage,
  prepareMessage,
  normalizeEmail,
  secureEqual,
  uuid,
} from './core.js';

const CONNECTIONS = 'gpr_m365_connections',
  STATES = 'gpr_m365_oauth_states',
  EMAILS = 'gpr_order_emails';
const statusFields = 'id,mailbox,allowed_senders,enabled,connected_at,last_sync_at,last_error';
function checked(result) {
  if (result.error) throw new IntakeError('database_error', 503);
  return result.data;
}
export function createMicrosoftHandler({ client, env, fetcher = fetch }) {
  const config = () => readConfig(env);
  const origins = () => allowedOrigins(env);
  const json = (body, status = 200, origin = '') =>
    Response.json(body, {
      status,
      headers: {
        ...(origins().has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  const adminProfile = async (id) => {
    const row = checked(await client.from('profiles').select('id,role').eq('id', id).maybeSingle());
    if (row?.role !== 'admin') throw new IntakeError('admin_only', 403);
    return row;
  };
  async function authenticate(req) {
    const bearer = req.headers.get('Authorization') || '';
    if (!bearer.startsWith('Bearer ')) throw new IntakeError('unauthorized', 401);
    const { data, error } = await client.auth.getUser(bearer.slice(7));
    if (error || !data.user) throw new IntakeError('unauthorized', 401);
    return adminProfile(data.user.id);
  }
  async function connectionFor(id) {
    return checked(await client.from(CONNECTIONS).select('*').eq('admin_id', id).maybeSingle());
  }
  function requireConfigured() {
    const value = config();
    if (value.missing.length) throw new IntakeError('not_configured', 503);
    return value;
  }
  async function sync(connection) {
    const cfg = requireConfigured();
    await adminProfile(connection.admin_id);
    const lock = crypto.randomUUID(),
      now = new Date().toISOString(),
      deadline = Date.now() + 45000;
    const claimed = checked(
      await client
        .from(CONNECTIONS)
        .update({ sync_lock: lock, lock_until: new Date(Date.now() + 180000).toISOString() })
        .eq('id', connection.id)
        .eq('enabled', true)
        .or(`lock_until.is.null,lock_until.lt.${now}`)
        .select('*')
        .maybeSingle(),
    );
    if (!claimed) return { busy: true, imported: 0, linked: 0, review: 0 };
    connection = claimed;
    const counts = { imported: 0, linked: 0, review: 0 };
    try {
      const token = await tokenRequest(
        cfg,
        {
          grant_type: 'refresh_token',
          refresh_token: await unseal(connection.refresh_cipher, cfg.key),
        },
        fetcher,
      );
      if (token.refresh_token)
        checked(
          await client
            .from(CONNECTIONS)
            .update({ refresh_cipher: await seal(token.refresh_token, cfg.key) })
            .eq('id', connection.id)
            .eq('sync_lock', lock),
        );
      const access = token.access_token;
      const scan = mailboxScan(connection);
      let url = scan.url;
      for (let page = 0; page < 3; page++) {
        safeMailboxUrl(url, connection);
        let data;
        try {
          data = await graphGet(url, access, fetcher);
        } catch (error) {
          if (error.code === 'delta_expired') {
            checked(
              await client
                .from(CONNECTIONS)
                .update({ delta_url: null })
                .eq('id', connection.id)
                .eq('sync_lock', lock),
            );
            throw new IntakeError('delta_reset', 409);
          }
          throw error;
        }
        if (!Array.isArray(data.value)) throw new IntakeError('microsoft_error', 502);
        for (const meta of data.value) {
          // Leave the current page cursor unchanged if a run reaches its time
          // budget. Message IDs make the next run resume safely within the page.
          if (Date.now() > deadline) return counts;
          if (meta['@removed']) continue;
          const received = Date.parse(meta.receivedDateTime);
          if (
            !Number.isFinite(received) ||
            received < Date.parse(scan.cutoff) ||
            received > Date.parse(scan.until)
          )
            continue;
          const key = String(meta.internetMessageId || meta.id || '');
          const seen = checked(
            await client
              .from(EMAILS)
              .select('id')
              .eq('mailbox', connection.mailbox)
              .eq('message_key', key)
              .maybeSingle(),
          );
          if (seen) continue;
          // Recheck senders locally even though the Graph list is filtered.
          // Unrelated correspondents and drafts never have their bodies fetched.
          if (!allowedMessage(meta, connection)) continue;
          const full = await graphGet(
            `/me/messages/${encodeURIComponent(meta.id)}?$select=body`,
            access,
            fetcher,
          );
          const { message, order } = prepareMessage(meta, full, connection);
          // An ignored message retains no body. Recording its key avoids
          // repeatedly reading ordinary correspondence on overlapping scans.
          const result = checked(
            await client.rpc('ingest_gpr_m365_email', {
              p_connection: connection.id,
              p_lock: lock,
              p_message: message,
              p_order: order,
            }),
          );
          if (Object.hasOwn(counts, result.status)) counts[result.status]++;
        }
        const next = data['@odata.nextLink'] || null;
        const checkpoint = mailboxCheckpoint(scan, next, connection);
        checked(
          await client
            .from(CONNECTIONS)
            .update({
              delta_url: checkpoint,
              last_sync_at: new Date().toISOString(),
              last_error: null,
            })
            .eq('id', connection.id)
            .eq('sync_lock', lock)
            .eq('enabled', true),
        );
        url = next;
        if (!data['@odata.nextLink']) break;
      }
      return counts;
    } catch (error) {
      const code = error instanceof IntakeError ? error.code : 'sync_failed';
      checked(
        await client
          .from(CONNECTIONS)
          .update({
            last_error: code,
            ...(code === 'reconnect' ? { enabled: false, refresh_cipher: null } : {}),
          })
          .eq('id', connection.id)
          .eq('sync_lock', lock),
      );
      throw new IntakeError(code, code === 'reconnect' ? 409 : 502);
    } finally {
      await client
        .from(CONNECTIONS)
        .update({ sync_lock: null, lock_until: null })
        .eq('id', connection.id)
        .eq('sync_lock', lock);
    }
  }
  async function callback(req) {
    const requestUrl = new URL(req.url),
      state = requestUrl.searchParams.get('state') || '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(state)) return json({ error: 'invalid_state' }, 400);
    const pending = checked(
      await client
        .from(STATES)
        .delete()
        .eq('state_hash', await digest(state))
        .gt('expires_at', new Date().toISOString())
        .select('*')
        .maybeSingle(),
    );
    if (!pending || !origins().has(pending.return_origin))
      return json({ error: 'expired_state' }, 400);
    const result = new URL('/app/gpr', pending.return_origin);
    try {
      if (requestUrl.searchParams.has('error')) throw new IntakeError('consent_cancelled');
      const code = requestUrl.searchParams.get('code');
      if (!code || code.length > 10000) throw new IntakeError('invalid_state');
      const cfg = requireConfigured();
      const connection = checked(
        await client.from(CONNECTIONS).select('*').eq('id', pending.connection_id).maybeSingle(),
      );
      if (!connection || connection.enabled || connection.config_version !== pending.config_version)
        throw new IntakeError('expired_state');
      await adminProfile(connection.admin_id);
      const tokens = await tokenRequest(
        cfg,
        {
          grant_type: 'authorization_code',
          code,
          code_verifier: await unseal(pending.verifier_cipher, cfg.key),
        },
        fetcher,
      );
      if (
        !tokens.refresh_token ||
        !/(?:^|\s)(?:https:\/\/graph.microsoft.com\/)?mail.read(?:\s|$)/i.test(tokens.scope || '')
      )
        throw new IntakeError('permission_missing');
      const me = await graphGet(
        '/me?$select=id,mail,userPrincipalName',
        tokens.access_token,
        fetcher,
      );
      if (![me.mail, me.userPrincipalName].map(normalizeEmail).includes(connection.mailbox))
        throw new IntakeError('mailbox_mismatch');
      // Connection time is metadata; intake uses the rolling fourteen-day window.
      const changed = checked(
        await client
          .from(CONNECTIONS)
          .update({
            enabled: true,
            refresh_cipher: await seal(tokens.refresh_token, cfg.key),
            mailbox_object_id: me.id,
            connected_at: new Date().toISOString(),
            folder_id: null,
            delta_url: null,
            last_error: null,
            config_version: crypto.randomUUID(),
          })
          .eq('id', connection.id)
          .eq('enabled', false)
          .eq('config_version', pending.config_version)
          .select('id')
          .maybeSingle(),
      );
      if (!changed) throw new IntakeError('expired_state');
      result.searchParams.set('m365_result', 'connected');
    } catch (error) {
      result.searchParams.set(
        'm365_result',
        error instanceof IntakeError ? error.code : 'connection_failed',
      );
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: result.href,
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  }
  return async (req) => {
    const origin = req.headers.get('Origin') || '';
    try {
      if (req.method === 'OPTIONS')
        return origins().has(origin)
          ? json({}, 200, origin)
          : json({ error: 'origin_denied' }, 403);
      if (req.method === 'GET' && new URL(req.url).searchParams.get('callback') === '1')
        return await callback(req);
      if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
      if (origin && !origins().has(origin)) return json({ error: 'origin_denied' }, 403);
      const text = await req.text();
      if (text.length > 16000) return json({ error: 'request_too_large' }, 413, origin);
      let input;
      try {
        input = JSON.parse(text || '{}');
      } catch {
        throw new IntakeError('settings_invalid');
      }
      if (input.action === 'sync-all') {
        if (!secureEqual(env('CRON_SECRET') || '', req.headers.get('x-cron-secret') || ''))
          throw new IntakeError('unauthorized', 401);
        if (config().missing.length) return json({ configured: false, processed: 0 });
        const connections = checked(
          await client.from(CONNECTIONS).select('*').eq('enabled', true).limit(5),
        );
        const results = [];
        for (const connection of connections) {
          try {
            results.push(await sync(connection));
          } catch (error) {
            results.push({ error: error.code || 'sync_failed' });
          }
        }
        return json({ processed: results.length, results });
      }
      const profile = await authenticate(req);
      let connection = await connectionFor(profile.id);
      if (input.action === 'status') {
        const summaries = connection
          ? checked(
              await client.from(CONNECTIONS).select(statusFields).eq('id', connection.id).single(),
            )
          : null;
        const pending = connection
          ? checked(
              await client
                .from(EMAILS)
                .select('id,sender,subject,body_text,received_at,reason,web_url')
                .eq('connection_id', connection.id)
                .eq('status', 'review')
                .order('created_at', { ascending: false })
                .limit(20),
            )
          : [];
        return json(
          {
            configured: config().missing.length === 0,
            lookback_days: LOOKBACK_DAYS,
            missing: config().missing,
            callback: config().callback,
            connection: summaries,
            pending,
          },
          200,
          origin,
        );
      }
      if (input.action === 'settings') {
        const settings = validateSettings(input);
        if (connection?.enabled) throw new IntakeError('disconnect_first', 409);
        if (connection)
          checked(
            await client
              .from(CONNECTIONS)
              .update({
                ...settings,
                config_version: crypto.randomUUID(),
                refresh_cipher: null,
                folder_id: null,
                delta_url: null,
                last_error: null,
              })
              .eq('id', connection.id)
              .eq('enabled', false)
              .select('id')
              .single(),
          );
        else checked(await client.from(CONNECTIONS).insert({ ...settings, admin_id: profile.id }));
        return json({ ok: true }, 200, origin);
      }
      if (input.action === 'connect') {
        const cfg = requireConfigured();
        if (!connection || connection.enabled) throw new IntakeError('settings_invalid');
        validateSettings(connection);
        if (!origins().has(origin)) throw new IntakeError('origin_denied', 403);
        const state = randomSecret(),
          verifier = randomSecret();
        checked(await client.from(STATES).delete().eq('connection_id', connection.id));
        checked(
          await client.from(STATES).insert({
            state_hash: await digest(state),
            connection_id: connection.id,
            config_version: connection.config_version,
            verifier_cipher: await seal(verifier, cfg.key),
            return_origin: origin,
            expires_at: new Date(Date.now() + 600000).toISOString(),
          }),
        );
        return json(
          { url: authorizeUrl(cfg, state, await digest(verifier), connection.mailbox) },
          200,
          origin,
        );
      }
      if (!connection) throw new IntakeError('settings_invalid');
      if (input.action === 'disconnect') {
        checked(
          await client
            .from(CONNECTIONS)
            .update({
              enabled: false,
              refresh_cipher: null,
              delta_url: null,
              folder_id: null,
              mailbox_object_id: null,
              sync_lock: null,
              lock_until: null,
              config_version: crypto.randomUUID(),
            })
            .eq('id', connection.id),
        );
        checked(await client.from(STATES).delete().eq('connection_id', connection.id));
        return json({ ok: true }, 200, origin);
      }
      if (input.action === 'sync') {
        if (!connection.enabled) throw new IntakeError('reconnect', 409);
        return json(await sync(connection), 200, origin);
      }
      if (input.action === 'resolve') {
        if (!uuid(input.email_id) || !uuid(input.order_id))
          throw new IntakeError('settings_invalid');
        if (
          !checked(
            await client
              .from('gpr_work_orders')
              .select('id')
              .eq('id', input.order_id)
              .maybeSingle(),
          )
        )
          throw new IntakeError('settings_invalid');
        checked(
          await client
            .from(EMAILS)
            .update({ order_id: input.order_id, status: 'linked', reason: null })
            .eq('id', input.email_id)
            .eq('connection_id', connection.id)
            .eq('status', 'review')
            .select('id')
            .single(),
        );
        return json({ ok: true }, 200, origin);
      }
      throw new IntakeError('unknown_action');
    } catch (error) {
      // Provider errors and tokens are never returned, logged or put in URLs.
      return json(
        { error: error instanceof IntakeError ? error.code : 'server_error' },
        error instanceof IntakeError ? error.status : 500,
        origin,
      );
    }
  };
}
