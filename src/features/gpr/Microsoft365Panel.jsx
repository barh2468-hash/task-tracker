import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Link2, RefreshCw, Settings2, Unplug } from 'lucide-react';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import { microsoftAction } from './api.js';
import { orderName } from './model.js';
import './microsoft.css';

const errorCodes = new Set([
  'admin_only',
  'unauthorized',
  'settings_invalid',
  'not_configured',
  'disconnect_first',
  'reconnect',
  'folder_missing',
  'folder_ambiguous',
  'mailbox_mismatch',
  'permission_missing',
  'expired_state',
  'consent_cancelled',
  'throttled',
  'delta_reset',
]);
const errorKey = (code) => `gpr.microsoft.${errorCodes.has(code) ? code : 'failed'}`;
export default function Microsoft365Panel({
  orders = [],
  onChanged,
  onStatus,
  result,
  call = microsoftAction,
}) {
  useTranslation();
  const { language } = useLanguage();
  const [status, setStatus] = useState(null);
  const [mailbox, setMailbox] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [senders, setSenders] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(
    result === 'connected' ? 'gpr.microsoft.connectedNotice' : '',
  );
  const [links, setLinks] = useState({});
  const load = useCallback(async () => {
    const data = await call('status');
    setStatus(data);
    onStatus?.(Boolean(data.connection?.enabled));
    const c = data.connection;
    setMailbox(c?.mailbox || '');
    setSenders((c?.allowed_senders || []).join('\n'));
  }, [call, onStatus]);
  useEffect(() => {
    let active = true;
    void load().catch(() => {
      if (active) setError('gpr.microsoft.failed');
    });
    return () => {
      active = false;
    };
  }, [load]);
  useEffect(() => {
    if (result && result !== 'connected') setError(errorKey(result));
  }, [result]);
  async function run(action, work) {
    if (busy) return;
    setBusy(action);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (error) {
      setError(errorKey(error.code));
    } finally {
      setBusy('');
    }
  }
  const settings = () => ({
    mailbox,
    allowed_senders: senders.split(/[\s,;]+/).filter(Boolean),
  });
  const connected = status?.connection?.enabled;
  const sync = () =>
    void run('sync', async () => {
      const data = await call('sync');
      await load();
      await onChanged?.();
      setNotice(data.busy ? 'gpr.microsoft.busy' : 'gpr.microsoft.syncDone');
    });
  const formatDate = (value) =>
    new Intl.DateTimeFormat(localeForLanguage(language), {
      timeZone: 'Asia/Hebron',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  return (
    <section
      className={`card gprMicrosoft ${connected ? 'gprMicrosoftCompact' : ''}`}
      aria-labelledby="gpr-microsoft-title"
      aria-busy={Boolean(busy)}
    >
      <header>
        <div>
          <h2 id="gpr-microsoft-title">
            <Link2 size={18} aria-hidden="true" />
            {t(connected ? 'gpr.mailConnection' : 'gpr.microsoft.title')}
          </h2>
          <p>
            {connected ? (
              <bdi dir="ltr">{status.connection.mailbox}</bdi>
            ) : (
              t('gpr.microsoft.description')
            )}
          </p>
        </div>
        <div className="gprMicrosoftToolbar">
          <span className={`gprMicrosoftBadge ${connected ? 'isConnected' : ''}`}>
            {t(connected ? 'gpr.microsoft.connected' : 'gpr.microsoft.disconnected')}
          </span>
          {connected && (
            <>
              <button
                type="button"
                className="ghost smallBtn"
                disabled={Boolean(busy)}
                onClick={sync}
              >
                <RefreshCw size={15} className={busy === 'sync' ? 'gprSpinning' : ''} />
                {t(busy === 'sync' ? 'gpr.microsoft.syncing' : 'gpr.syncNow')}
              </button>
              <button
                type="button"
                className="ghost smallBtn"
                aria-expanded={settingsOpen}
                aria-controls="gpr-mail-settings"
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <Settings2 size={15} />
                {t('gpr.connectionSettings')}
              </button>
            </>
          )}
        </div>
      </header>
      {error && (
        <p className="gprError" role="alert">
          {t(error)}
        </p>
      )}
      {notice && (
        <p className="gprNotice" role="status">
          {t(notice)}
        </p>
      )}
      {!status ? (
        <button
          className="ghost smallBtn"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => run('load', load)}
        >
          {t(error ? 'gpr.retry' : 'gpr.loading')}
        </button>
      ) : (
        <>
          <div id="gpr-mail-settings" hidden={connected && !settingsOpen}>
            {!status.configured && (
              <div className="gprMicrosoftSetup">
                <b>{t('gpr.microsoft.setupRequired')}</b>
                <p>{t('gpr.microsoft.setupDescription')}</p>
                <button
                  type="button"
                  className="ghost smallBtn"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void run('check', async () => {
                      const data = await call('status');
                      setStatus(data);
                      onStatus?.(Boolean(data.connection?.enabled));
                    })
                  }
                >
                  {t('gpr.retry')}
                </button>
                <details
                  open={setupOpen}
                  onToggle={(event) => setSetupOpen(event.currentTarget.open)}
                >
                  <summary>{t('gpr.microsoft.adminInstructions')}</summary>
                  <ol>
                    <li>
                      {t('gpr.microsoft.register')}{' '}
                      <a href="https://entra.microsoft.com" target="_blank" rel="noreferrer">
                        {t('gpr.microsoft.openEntra')}
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    </li>
                    <li>
                      {t('gpr.microsoft.webCallback')}
                      <input
                        aria-label={t('gpr.microsoft.callback')}
                        readOnly
                        value={status.callback}
                        dir="ltr"
                      />
                    </li>
                    <li>{t('gpr.microsoft.permissions')}</li>
                    <li>
                      {t('gpr.microsoft.serverSecrets')}
                      <ul>
                        {status.missing.map((name) => (
                          <li key={name}>
                            <code>{name}</code>
                          </li>
                        ))}
                      </ul>
                    </li>
                  </ol>
                </details>
              </div>
            )}
            <p className="gprMicrosoftPermission">{t('gpr.microsoft.scopeDisclosure')}</p>
            <p className="gprMicrosoftPermission">
              {t('gpr.microsoft.lookback', {
                days: Number(status.lookback_days || 14).toLocaleString(
                  localeForLanguage(language),
                ),
              })}
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run('settings', async () => {
                  await call('settings', settings());
                  await load();
                  setNotice('gpr.microsoft.saved');
                });
              }}
            >
              <fieldset disabled={Boolean(busy) || connected} className="gprMicrosoftFields">
                <label>
                  {t('gpr.microsoft.mailbox')}
                  <input
                    type="email"
                    required
                    maxLength={254}
                    value={mailbox}
                    dir="ltr"
                    autoComplete="off"
                    onChange={(event) => setMailbox(event.target.value)}
                  />
                </label>
                <label className="gprMicrosoftSenders">
                  {t('gpr.microsoft.senders')}
                  <textarea
                    required
                    value={senders}
                    dir="ltr"
                    maxLength={12000}
                    onChange={(event) => setSenders(event.target.value)}
                  />
                  <small>{t('gpr.microsoft.sendersHelp')}</small>
                </label>
              </fieldset>
              <div className="actionsRow">
                {!connected ? (
                  <>
                    <button className="ghost smallBtn" type="submit" disabled={Boolean(busy)}>
                      {t(busy === 'settings' ? 'gpr.saving' : 'gpr.microsoft.saveSettings')}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      aria-describedby={
                        !status.configured ? 'gpr-microsoft-connect-help' : undefined
                      }
                      onClick={() => {
                        if (!status.configured) {
                          setError('gpr.microsoft.not_configured');
                          setSetupOpen(true);
                          return;
                        }
                        if (!mailbox.trim() || !senders.trim()) {
                          setError('gpr.microsoft.settings_invalid');
                          return;
                        }
                        void run('connect', async () => {
                          await call('settings', settings());
                          const data = await call('connect');
                          const target = new URL(data.url);
                          if (target.origin !== 'https://login.microsoftonline.com')
                            throw new Error('Invalid provider');
                          window.location.assign(target.href);
                        });
                      }}
                    >
                      <Link2 size={16} />
                      {t(busy === 'connect' ? 'gpr.microsoft.connecting' : 'gpr.microsoft.connect')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void run('sync', async () => {
                          const data = await call('sync');
                          await load();
                          await onChanged?.();
                          setNotice(data.busy ? 'gpr.microsoft.busy' : 'gpr.microsoft.syncDone');
                        })
                      }
                    >
                      <RefreshCw size={16} />
                      {t(busy === 'sync' ? 'gpr.microsoft.syncing' : 'gpr.microsoft.sync')}
                    </button>
                    <button
                      className="ghost smallBtn"
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => {
                        if (window.confirm(t('gpr.microsoft.disconnectConfirm')))
                          void run('disconnect', async () => {
                            await call('disconnect');
                            await load();
                            setNotice('gpr.microsoft.disconnectedNotice');
                          });
                      }}
                    >
                      <Unplug size={16} />
                      {t('gpr.microsoft.disconnect')}
                    </button>
                  </>
                )}
              </div>
              {!connected && !status.configured && (
                <p id="gpr-microsoft-connect-help" className="gprMicrosoftPermission">
                  {t('gpr.microsoft.connectSetupHelp')}
                </p>
              )}
            </form>
          </div>
          {connected && (
            <p className="muted">
              {t('gpr.microsoft.schedule')}
              {status.connection.last_sync_at && (
                <span>
                  {' '}
                  ·{' '}
                  {t('gpr.microsoft.lastSync', {
                    date: formatDate(status.connection.last_sync_at),
                  })}
                </span>
              )}
            </p>
          )}
          {status.connection?.last_error && (
            <p className="gprError" role="alert">
              {t(errorKey(status.connection.last_error))}
            </p>
          )}
          {(!connected || settingsOpen) && (
            <p className="gprMicrosoftAttachmentNote">{t('gpr.microsoft.attachmentsNote')}</p>
          )}
          {!!status.pending?.length && (
            <details className="gprMicrosoftReview">
              <summary>
                {t('gpr.reviewEmails', {
                  count: Number(status.pending.length).toLocaleString(localeForLanguage(language)),
                })}
              </summary>
              <section className="gprMicrosoftPending">
                <p className="muted">{t('gpr.microsoft.reviewHelp')}</p>
                {status.pending.map((mail) => (
                  <details key={mail.id}>
                    <summary>
                      <span dir="auto">{mail.subject}</span>
                      <bdi>{mail.sender}</bdi>
                    </summary>
                    <pre dir="auto">{mail.body_text}</pre>
                    <label>
                      {t('gpr.microsoft.linkOrder')}
                      <select
                        value={links[mail.id] || ''}
                        onChange={(event) =>
                          setLinks((current) => ({ ...current, [mail.id]: event.target.value }))
                        }
                      >
                        <option value="">{t('gpr.microsoft.chooseOrder')}</option>
                        {orders.map((order) => (
                          <option key={order.id} value={order.id}>
                            {orderName(order, t)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="ghost smallBtn"
                      disabled={Boolean(busy) || !links[mail.id]}
                      onClick={() =>
                        void run('resolve', async () => {
                          await call('resolve', { email_id: mail.id, order_id: links[mail.id] });
                          await load();
                          await onChanged?.();
                        })
                      }
                    >
                      {t('gpr.microsoft.linkOrder')}
                    </button>
                  </details>
                ))}
              </section>
            </details>
          )}
        </>
      )}
    </section>
  );
}
