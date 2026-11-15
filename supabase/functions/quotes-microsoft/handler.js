import {
  allowedOrigins,
  randomSecret,
  digest,
  seal,
  unseal,
  secureEqual,
  tokenRequest,
} from '../gpr-microsoft/core.js';
import {
  initialState,
  saveSettings,
  saveClient,
  today,
  addDays,
} from '../../../src/features/quotes/model.js';
import { validLocalState } from '../../../src/features/quotes/localStore.js';
import {
  configForQuotes,
  connectUrl,
  hasScopes,
  graph,
  safeFolderCursor,
  mailCandidate,
  incomingRecord,
  matchQuote,
  followupMail,
  followupState,
  quoteCycle,
  dueQuote,
  sendingWindow,
  validateSnapshot,
  IntakeError,
} from './core.js';
const W = 'quote_workspaces',
  C = 'quote_mailbox_connections',
  O = 'quote_oauth_states',
  J = 'quote_delivery_jobs';
const checked = (result) => {
  if (result.error)
    throw new IntakeError(result.error.code === '23505' ? 'duplicate' : 'database_error', 503);
  return result.data;
};
const safeConnection = (c) =>
  c
    ? Object.fromEntries(
        [
          'mailbox',
          'folder_name',
          'enabled',
          'automation_enabled',
          'last_sync_at',
          'connected_at',
          'last_error',
        ].map((k) => [k, c[k]]),
      )
    : null;
const makeEvent = (type, data = {}) => ({
  id: crypto.randomUUID(),
  type,
  data,
  at: new Date().toISOString(),
  actor: 'system',
});

export function createQuotesHandler({ client, env, fetcher = fetch }) {
  const cfg = () => configForQuotes(env),
    origins = () => allowedOrigins(env);
  const json = (body, status = 200, origin = '') =>
    Response.json(body, {
      status,
      headers: {
        ...(origins().has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
        'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  async function profile(id) {
    const p = checked(await client.from('profiles').select('id,role').eq('id', id).maybeSingle());
    if (!['admin', 'manager'].includes(p?.role)) throw new IntakeError('unauthorized', 403);
    const access=checked(await client.from('quote_feature_access').select('user_id').eq('user_id',id).maybeSingle());
    if(!access)throw new IntakeError('unauthorized',403);
    return p;
  }
  async function authenticate(req) {
    const bearer = req.headers.get('authorization') || '';
    if (!bearer.startsWith('Bearer ')) throw new IntakeError('unauthorized', 401);
    const { data, error } = await client.auth.getUser(bearer.slice(7));
    if (error || !data.user) throw new IntakeError('unauthorized', 401);
    return profile(data.user.id);
  }
  async function connection(owner) {
    return checked(await client.from(C).select('*').eq('owner_id', owner).maybeSingle());
  }
  async function ensure(owner) {
    checked(
      await client
        .from(W)
        .upsert(
          { owner_id: owner, data: initialState() },
          { onConflict: 'owner_id', ignoreDuplicates: true },
        ),
    );
    return checked(await client.from(W).select('data,revision').eq('owner_id', owner).single());
  }
  async function claim(owner) {
    const token = crypto.randomUUID(),
      rows = checked(await client.rpc('claim_quote_workspace', { p_owner: owner, p_lock: token }));
    if (!rows?.length) throw new IntakeError('busy', 409);
    return { owner, token, data: rows[0].data, revision: rows[0].revision };
  }
  async function commit(lease, data) {
    const rows = checked(
      await client.rpc('commit_quote_workspace', {
        p_owner: lease.owner,
        p_lock: lease.token,
        p_revision: lease.revision,
        p_data: data,
      }),
    );
    if (!rows?.length) throw new IntakeError('conflict', 409);
    lease.data = data;
    lease.revision = rows[0].revision;
    return { state: data, revision: lease.revision };
  }
  async function release(lease) {
    await client
      .from(W)
      .update({ lock_token: null, lock_until: null })
      .eq('owner_id', lease.owner)
      .eq('lock_token', lease.token);
  }
  async function withLease(owner, work) {
    const lease = await claim(owner);
    try {
      return await work(lease);
    } finally {
      await release(lease);
    }
  }
  async function notify(owner, quoteId, type) {
    checked(
      await client.from('notifications').insert({
        recipient_id: owner,
        type: `quote_${type}`,
        title: `quotes.notice.${type}`,
        body: '',
        quote_id: quoteId || null,
      }),
    );
  }
  async function access(c) {
    if (!c.enabled || !c.refresh_cipher) throw new IntakeError('reconnect', 409);
    const conf = cfg();
    if (conf.missing.length) throw new IntakeError('not_configured', 503);
    const tokens = await tokenRequest(
      conf,
      { grant_type: 'refresh_token', refresh_token: await unseal(c.refresh_cipher, conf.key) },
      fetcher,
    );
    if (!hasScopes(tokens.scope)) throw new IntakeError('permission_missing', 409);
    if (tokens.refresh_token)
      checked(
        await client
          .from(C)
          .update({ refresh_cipher: await seal(tokens.refresh_token, conf.key) })
          .eq('owner_id', c.owner_id)
          .eq('config_version', c.config_version),
      );
    return tokens.access_token;
  }
  async function folder(name, token) {
    if (['inbox', 'תיבת דואר נכנס'].includes(name.toLowerCase()))
      return (await graph('/me/mailFolders/inbox?$select=id', token, { fetcher })).id;
    const value = await graph(
      `/me/mailFolders?${new URLSearchParams({ $filter: `displayName eq '${name.replaceAll("'", "''")}'`, $select: 'id', $top: '2' })}`,
      token,
      { fetcher },
    );
    if (value.value?.length !== 1) throw new IntakeError('folder_missing', 409);
    return value.value[0].id;
  }
  async function sync(c, lease, token, deadline) {
    const primary = c.folder_id || (await folder(c.folder_name, token));
    const sent = (await graph('/me/mailFolders/sentitems?$select=id', token, { fetcher })).id;
    let cursors = {};
    try {
      cursors = JSON.parse(c.cursor_url || '{}');
    } catch {
      /* start a bounded fresh scan */
    }
    let count = 0;
    for (const [kind, id] of [
      ['primary', primary],
      ['sent', sent],
    ]) {
      const since = cursors[kind]?.since || new Date(Date.now() - 14 * 86400000).toISOString(),
        until = cursors[kind]?.until || new Date().toISOString();
      let url =
        cursors[kind]?.url ||
        `https://graph.microsoft.com/v1.0/me/mailFolders/${encodeURIComponent(id)}/messages?${new URLSearchParams({ $select: 'id,internetMessageId,from,sender,toRecipients,subject,receivedDateTime,isDraft', $filter: `receivedDateTime ge ${since} and receivedDateTime le ${until}`, $orderby: 'receivedDateTime desc', $top: '30' })}`;
      let complete = false;
      for (let page = 0; page < 3 && url && Date.now() < deadline; page++) {
        safeFolderCursor(url, id);
        const list = await graph(url, token, { fetcher });
        if (!Array.isArray(list.value)) throw new IntakeError('microsoft_error', 502);
        let all = true;
        for (const meta of list.value) {
          if (Date.now() > deadline) {
            all = false;
            break;
          }
          if (meta.isDraft) continue;
          const subject = String(meta.subject || '');
          const match = matchQuote(lease.data, subject, '');
          const from = String(meta.from?.emailAddress?.address || '').toLowerCase();
          const own = kind === 'sent' && from === c.mailbox;
          if (!own && !mailCandidate(meta, lease.data)) continue;
          if (!match && !/הצעת? מחיר|הצעה|quotation|quote\b/i.test(subject)) continue;
          const key = String(meta.internetMessageId || meta.id);
          if (
            checked(
              await client
                .from('quote_incoming_messages')
                .select('id')
                .eq('owner_id', c.owner_id)
                .eq('message_key', key)
                .maybeSingle(),
            )
          )
            continue;
          const full = await graph(
            `/me/messages/${encodeURIComponent(meta.id)}?$select=body`,
            token,
            { fetcher },
          );
          const message = incomingRecord(meta, full, lease.data);
          // Crash after committing is recoverable: the message fingerprint is also in the workspace.
          if (!lease.data.messages.some((m) => m.fingerprint === key)) {
            let data = { ...lease.data, messages: [message, ...lease.data.messages] };
            if (data.messages.length > 1000) throw new IntakeError('workspace_limit', 409);
            const matchedQuote = data.quotes.find((q) => q.id === message.suggestedQuoteId);
            const matchingContact = data.clients.find(
              (v) => v.id === matchedQuote?.clientId && v.email === message.sender,
            );
            if (
              !own &&
              matchingContact &&
              message.body.trim().split(/\r?\n/)[0] === 'אבקש להסיר אותי ממיילי מעקב'
            )
              data = saveClient(data, { ...matchingContact, optOut: true }).state;
            if (!own && message.suggestedQuoteId && matchingContact)
              data.quotes = data.quotes.map((q) =>
                q.id === message.suggestedQuoteId && q.status === 'open'
                  ? {
                      ...q,
                      tracking: 'needs_attention',
                      nextFollowup: '',
                      updatedAt: new Date().toISOString(),
                      events: [makeEvent('mailReceived'), ...q.events],
                    }
                  : q,
              );
            await commit(lease, data);
            await notify(c.owner_id, message.suggestedQuoteId, 'mail_received');
            count++;
          }
          checked(
            await client
              .from('quote_incoming_messages')
              .insert({ owner_id: c.owner_id, message_key: key }),
          );
        }
        if (!all) break;
        url = list['@odata.nextLink'] || null;
        if (!url) {
          complete = true;
          break;
        }
      }
      cursors[kind] = complete ? null : { url, since, until };
    }
    checked(
      await client
        .from(C)
        .update({
          folder_id: primary,
          cursor_url: JSON.stringify(cursors),
          last_sync_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('owner_id', c.owner_id)
        .eq('config_version', c.config_version),
    );
    return count;
  }
  async function sendJob(c, lease, token, job, deadline) {
    const deliveryFetch = (url, options = {}) => {
      if (Date.now() >= deadline) throw new IntakeError('busy', 409);
      return fetcher(url, {
        ...options,
        signal: AbortSignal.any(
          [options.signal, AbortSignal.timeout(Math.max(1, deadline - Date.now()))].filter(Boolean),
        ),
      });
    };
    const quote = lease.data.quotes.find((q) => q.id === job.quote_id),
      customer = lease.data.clients.find((v) => v.id === quote?.clientId);
    if (
      !dueQuote(quote || {}, customer) ||
      customer.email !== job.recipient ||
      quoteCycle(quote) !== job.cycle
    ) {
      checked(await client.from(J).update({ status: 'cancelled' }).eq('id', job.id));
      return;
    }
    const payload = followupMail(
      quote,
      customer,
      await unseal(job.token_cipher, cfg().key),
      cfg().endpoint,
      c.mailbox,
    );
    const property = 'String {4cb79a9e-2570-48f4-8962-68e06ec42fb3} Name MayaQuoteJob';
    let graphId = job.graph_id;
    if (!graphId) {
      const found = await graph(
        `/me/messages?${new URLSearchParams({ $filter: `singleValueExtendedProperties/Any(ep: ep/id eq '${property}' and ep/value eq '${job.id}')`, $select: 'id,isDraft', $top: '2' })}`,
        token,
        { fetcher: deliveryFetch },
      );
      if (found.value?.length > 1) throw new IntakeError('delivery_unknown', 409);
      if (found.value?.length) graphId = found.value[0].id;
      else
        graphId = (
          await graph('/me/messages', token, {
            method: 'POST',
            body: { ...payload, singleValueExtendedProperties: [{ id: property, value: job.id }] },
            fetcher: deliveryFetch,
          })
        ).id;
      checked(
        await client.from(J).update({ graph_id: graphId, status: 'drafted' }).eq('id', job.id),
      );
    }
    let item;
    try {
      item = await graph(`/me/messages/${encodeURIComponent(graphId)}?$select=id,isDraft`, token, {
        fetcher: deliveryFetch,
      });
    } catch (error) {
      if (error.code === 'not_found') throw new IntakeError('delivery_unknown', 409);
      throw error;
    }
    if (item.isDraft) {
      checked(
        await client
          .from(J)
          .update({ status: 'sending', attempts: job.attempts + 1 })
          .eq('id', job.id),
      );
      await graph(`/me/messages/${encodeURIComponent(graphId)}/send`, token, {
        method: 'POST',
        fetcher: deliveryFetch,
      });
    }
    const at = new Date().toISOString();
    checked(
      await client
        .from(J)
        .update({ status: 'sent', sent_at: at, last_error: null })
        .eq('id', job.id),
    );
    const next = {
      ...lease.data,
      quotes: lease.data.quotes.map((q) =>
        q.id === quote.id
          ? {
              ...q,
              tracking: 'awaiting_reply',
              nextFollowup: addDays(today(), lease.data.settings.reminderDays),
              updatedAt: at,
              events: [
                makeEvent('followupSent', { round: job.round_no, jobId: job.id }),
                ...q.events,
              ],
            }
          : q,
      ),
    };
    await commit(lease, next);
  }
  async function runOwner(c) {
    await profile(c.owner_id);
    return withLease(c.owner_id, async (lease) => {
      const deadline = Date.now() + 45000,
        token = await access(c);
      const received = await sync(c, lease, token, deadline - 15000);
      let sent = 0;
      if (!c.automation_enabled || !sendingWindow()) return { received, sent };
      const jobs = checked(
        await client
          .from(J)
          .select('*')
          .eq('owner_id', c.owner_id)
          .order('created_at', { ascending: false })
          .limit(10000),
      );
      for (const quote of lease.data.quotes) {
        if (Date.now() > deadline || sent >= 5) break;
        const customer = lease.data.clients.find((v) => v.id === quote.clientId);
        if (!dueQuote(quote, customer)) continue;
        const next = followupState(quote, jobs, lease.data.settings);
        if (
          next.last &&
          !quote.events.some((e) => e.type === 'followupSent' && e.data.jobId === next.last.id)
        ) {
          await commit(lease, {
            ...lease.data,
            quotes: lease.data.quotes.map((q) =>
              q.id === quote.id
                ? {
                    ...q,
                    tracking: 'awaiting_reply',
                    nextFollowup: addDays(
                      today(new Date(next.last.sent_at)),
                      lease.data.settings.reminderDays,
                    ),
                    events: [
                      makeEvent('followupSent', { round: next.last.round_no, jobId: next.last.id }),
                      ...q.events,
                    ],
                  }
                : q,
            ),
          });
          continue;
        }
        if (next.last && Date.now() - Date.parse(next.last.sent_at) < 48 * 3600000) continue;
        if (next.attention) {
          await commit(lease, {
            ...lease.data,
            quotes: lease.data.quotes.map((q) =>
              q.id === quote.id
                ? {
                    ...q,
                    tracking: 'needs_attention',
                    nextFollowup: '',
                    events: [makeEvent('noResponse'), ...q.events],
                  }
                : q,
            ),
          });
          await notify(c.owner_id, quote.id, 'no_response');
          continue;
        }
        // One cycle/round has one durable job; retries reuse the same Graph draft.
        let job = jobs.find(
          (j) =>
            j.quote_id === quote.id && j.cycle === quoteCycle(quote) && j.round_no === next.round,
        );
        if (job && ['failed', 'cancelled', 'unknown'].includes(job.status)) continue;
        if (!job) {
          const raw = randomSecret();
          job = checked(
            await client
              .from(J)
              .insert({
                owner_id: c.owner_id,
                quote_id: quote.id,
                cycle: quoteCycle(quote),
                round_no: next.round,
                recipient: customer.email,
                token_hash: await digest(raw),
                token_cipher: await seal(raw, cfg().key),
                expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
              })
              .select('*')
              .single(),
          );
          jobs.push(job);
        }
        try {
          await sendJob(c, lease, token, job, deadline);
          sent++;
        } catch (error) {
          const attempts = job.attempts + 1;
          checked(
            await client
              .from(J)
              .update({
                attempts,
                last_error: error.code || 'delivery_failed',
                status:
                  error.code === 'delivery_unknown'
                    ? 'unknown'
                    : attempts >= 3
                      ? 'failed'
                      : job.graph_id
                        ? 'drafted'
                        : 'pending',
              })
              .eq('id', job.id),
          );
          if (attempts >= 3 || error.code === 'delivery_unknown') {
            await commit(lease, {
              ...lease.data,
              quotes: lease.data.quotes.map((q) =>
                q.id === quote.id
                  ? {
                      ...q,
                      tracking: 'needs_attention',
                      nextFollowup: '',
                      events: [makeEvent('deliveryFailed'), ...q.events],
                    }
                  : q,
              ),
            });
            await notify(c.owner_id, quote.id, 'delivery_failed');
          }
          if (['reconnect', 'throttled'].includes(error.code)) throw error;
        }
      }
      return { received, sent };
    });
  }
  async function callback(req) {
    const url = new URL(req.url),
      state = url.searchParams.get('state') || '';
    if (!/^q_[A-Za-z0-9_-]{43}$/.test(state)) return json({ error: 'expired_state' }, 400);
    const pending = checked(
      await client
        .from(O)
        .delete()
        .eq('state_hash', await digest(state))
        .gt('expires_at', new Date().toISOString())
        .select('*')
        .maybeSingle(),
    );
    if (!pending || !origins().has(pending.return_origin))
      return json({ error: 'expired_state' }, 400);
    const target = new URL('/app/quotes', pending.return_origin);
    try {
      await profile(pending.owner_id);
      if (url.searchParams.has('error')) throw new IntakeError('consent_cancelled');
      const code = url.searchParams.get('code');
      if (!code || code.length > 10000) throw new IntakeError('expired_state');
      const conf = cfg(),
        c = await connection(pending.owner_id);
      if (!c || c.enabled || c.config_version !== pending.config_version)
        throw new IntakeError('expired_state');
      const tokens = await tokenRequest(
        conf,
        {
          grant_type: 'authorization_code',
          code,
          code_verifier: await unseal(pending.verifier_cipher, conf.key),
        },
        fetcher,
      );
      if (!tokens.refresh_token || !hasScopes(tokens.scope))
        throw new IntakeError('permission_missing');
      const me = await graph('/me?$select=id,mail,userPrincipalName', tokens.access_token, {
        fetcher,
      });
      if (![me.mail, me.userPrincipalName].some((v) => String(v || '').toLowerCase() === c.mailbox))
        throw new IntakeError('mailbox_mismatch');
      const folderId = await folder(c.folder_name, tokens.access_token);
      const changed = checked(
        await client
          .from(C)
          .update({
            enabled: true,
            automation_enabled: false,
            refresh_cipher: await seal(tokens.refresh_token, conf.key),
            mailbox_object_id: me.id,
            folder_id: folderId,
            connected_at: new Date().toISOString(),
            last_error: null,
            config_version: crypto.randomUUID(),
          })
          .eq('owner_id', c.owner_id)
          .eq('enabled', false)
          .eq('config_version', pending.config_version)
          .select('owner_id'),
      );
      if (!changed.length) throw new IntakeError('expired_state');
      target.searchParams.set('quotes_m365', 'connected');
    } catch (error) {
      target.searchParams.set('quotes_m365', error.code || 'connection_failed');
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: target.href,
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  }
  return async (req) => {
    const url = new URL(req.url),
      origin = req.headers.get('origin') || '';
    try {
      if (req.method === 'GET' && url.searchParams.get('callback') === '1')
        return await callback(req);
      if (req.method === 'OPTIONS') return json({}, origins().has(origin) ? 200 : 403, origin);
      if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);
      if (origin && !origins().has(origin)) throw new IntakeError('origin_denied', 403);
      const raw = await req.text();
      if (raw.length > 6_000_000) throw new IntakeError('request_too_large', 413);
      let input;
      try {
        input = JSON.parse(raw);
      } catch {
        throw new IntakeError('settings_invalid');
      }
      if (input.action === 'run') {
        if (!secureEqual(env('CRON_SECRET') || '', req.headers.get('x-cron-secret') || ''))
          throw new IntakeError('unauthorized', 401);
        if (cfg().missing.length) return json({ configured: false });
        const connections = checked(
            await client
              .from(C)
              .select('*')
              .eq('enabled', true)
              .order('last_sync_at', { ascending: true, nullsFirst: true })
              .limit(1),
          ),
          results = [];
        for (const c of connections) {
          try {
            results.push(await runOwner(c));
          } catch (error) {
            await client
              .from(C)
              .update({
                last_error: error.code || 'sync_failed',
                last_sync_at: new Date().toISOString(),
                ...(error.code === 'reconnect'
                  ? { enabled: false, automation_enabled: false }
                  : {}),
              })
              .eq('owner_id', c.owner_id);
            results.push({ error: error.code || 'sync_failed' });
          }
        }
        return json({ results });
      }
      const user = await authenticate(req),
        owner = user.id;
      const workspace = await ensure(owner);
      let c = await connection(owner);
      if (input.action === 'load' || input.action === 'status')
        return json(
          {
            state: workspace.data,
            revision: workspace.revision,
            connection: safeConnection(c),
            configured: cfg().missing.length === 0,
            missing: cfg().missing,
          },
          200,
          origin,
        );
      if (input.action === 'save')
        return json(
          await withLease(owner, async (lease) => {
            if (input.revision !== lease.revision) throw new IntakeError('conflict', 409);
            const state = input.state;
            if (!validLocalState(state)) throw new IntakeError('settings_invalid');
            validateSnapshot(state);
            const settings = saveSettings(state, {
              ...state.settings,
              allowedSenders: state.settings.allowedSenders.join('\n'),
            }).settings;
            if (c?.enabled && (settings.mailbox !== c.mailbox || settings.folder !== c.folder_name))
              throw new IntakeError('disconnect_first', 409);
            // Preserve immutable audit events and provider-imported messages.
            for (const old of lease.data.quotes) {
              const q = state.quotes.find((q) => q.id === old.id);
              if (
                !q ||
                old.events.some(
                  (e) =>
                    !q.events.some((v) => v.id === e.id && JSON.stringify(v) === JSON.stringify(e)),
                )
              )
                throw new IntakeError('conflict', 409);
            }
            for (const old of lease.data.messages) {
              const m = state.messages.find((m) => m.id === old.id);
              if (!m || ['sender', 'body', 'subject', 'fingerprint'].some((k) => m[k] !== old[k]))
                throw new IntakeError('conflict', 409);
            }
            return commit(lease, { ...state, settings });
          }),
          200,
          origin,
        );
      if (input.action === 'connect')
        return json(
          await withLease(owner, async (lease) => {
            if (!origins().has(origin)) throw new IntakeError('origin_denied', 403);
            const conf = cfg();
            if (conf.missing.length) throw new IntakeError('not_configured', 503);
            const settings = lease.data.settings;
            if (!settings.mailbox) throw new IntakeError('settings_invalid');
            if (c?.enabled) throw new IntakeError('disconnect_first', 409);
            const version = crypto.randomUUID();
            checked(
              await client.from(C).upsert({
                owner_id: owner,
                mailbox: settings.mailbox,
                folder_name: settings.folder,
                enabled: false,
                automation_enabled: false,
                config_version: version,
                refresh_cipher: null,
                cursor_url: null,
              }),
            );
            const state = `q_${randomSecret()}`,
              verifier = randomSecret();
            checked(await client.from(O).delete().eq('owner_id', owner));
            checked(
              await client.from(O).insert({
                state_hash: await digest(state),
                owner_id: owner,
                config_version: version,
                verifier_cipher: await seal(verifier, conf.key),
                return_origin: origin,
                expires_at: new Date(Date.now() + 600000).toISOString(),
              }),
            );
            return { url: connectUrl(conf, state, await digest(verifier), settings.mailbox) };
          }),
          200,
          origin,
        );
      if (input.action === 'disconnect')
        return json(
          await withLease(owner, async () => {
            checked(
              await client
                .from(C)
                .update({
                  enabled: false,
                  automation_enabled: false,
                  refresh_cipher: null,
                  cursor_url: null,
                  config_version: crypto.randomUUID(),
                })
                .eq('owner_id', owner),
            );
            checked(await client.from(O).delete().eq('owner_id', owner));
            return { ok: true };
          }),
          200,
          origin,
        );
      if (input.action === 'automation')
        return json(
          await withLease(owner, async () => {
            if (!c?.enabled) throw new IntakeError('reconnect', 409);
            checked(
              await client
                .from(C)
                .update({ automation_enabled: input.enabled === true })
                .eq('owner_id', owner)
                .eq('config_version', c.config_version),
            );
            return { ok: true };
          }),
          200,
          origin,
        );
      if (input.action === 'sync') {
        if (!c?.enabled) throw new IntakeError('reconnect', 409);
        return json(await runOwner({ ...c, automation_enabled: false }), 200, origin);
      }
      throw new IntakeError('settings_invalid');
    } catch (error) {
      return json(
        { error: error instanceof IntakeError ? error.code : 'service_unavailable' },
        error.status || 500,
        origin,
      );
    }
  };
}
