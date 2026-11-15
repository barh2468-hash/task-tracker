import { useState } from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import { t } from '../language/LanguageContext.jsx';
import { Field } from './forms.jsx';

export default function MailboxSettings({
  settings,
  onSave,
  busy,
  live = false,
  connection,
  configured,
  onAction,
  formatDate,
}) {
  const [form, setForm] = useState(() => ({
    ...settings,
    allowedSenders: settings.allowedSenders.join('\n'),
  }));
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  return (
    <section className="quotesPanel">
      <div className="quotesSectionHeading">
        <h2>
          <Mail size={20} aria-hidden="true" />
          {t('quotes.mailboxTitle')}
        </h2>
        <span className="quotesBadge">
          {t(connection?.enabled ? 'quotes.connected' : 'quotes.notConnected')}
        </span>
      </div>
      <p className="quotesMuted">{t(live ? 'quotes.connectionHelp' : 'quotes.mailboxHelp')}</p>
      {live && (
        <>
          <p className="quotesMuted">{t('quotes.folderHelp')}</p>
          <p className="quotesMuted">{t('quotes.replyHelp')}</p>
          {!configured && <p className="quotesWarning">{t('quotes.error.not_configured')}</p>}
          <div className="quotesActions">
            {connection?.enabled ? (
              <>
                <span className="quotesBadge">
                  {t(
                    connection.automation_enabled ? 'quotes.automationOn' : 'quotes.automationOff',
                  )}
                </span>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => void onAction('sync')}
                >
                  {t('quotes.sync')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (connection.automation_enabled || window.confirm(t('quotes.enableConfirm')))
                      void onAction('automation', { enabled: !connection.automation_enabled });
                  }}
                >
                  {t(
                    connection.automation_enabled
                      ? 'quotes.disableAutomation'
                      : 'quotes.enableAutomation',
                  )}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(t('quotes.disconnectConfirm'))) void onAction('disconnect');
                  }}
                >
                  {t('quotes.disconnect')}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy || !configured || !form.mailbox}
                onClick={async () => {
                  if (await onSave(form)) void onAction('connect');
                }}
              >
                {t(busy ? 'quotes.connecting' : 'quotes.connect')}
              </button>
            )}
          </div>
          {connection?.last_sync_at && (
            <p className="quotesMuted">
              {t('quotes.lastSync', { date: formatDate(connection.last_sync_at, true) })}
            </p>
          )}
          {connection?.last_error && (
            <p className="quotesWarning">
              {t(`quotes.error.${connection.last_error}`, {
                defaultValue: t('quotes.error.generic'),
              })}
            </p>
          )}
          <p className="quotesMuted">{t('quotes.automationHelp')}</p>
        </>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(form);
        }}
      >
        <div className="quotesFormGrid">
          <Field
            label="quotes.mailboxAddress"
            type="email"
            dir="ltr"
            placeholder="name@company.com"
            value={form.mailbox}
            onChange={set('mailbox')}
          />
          <Field
            label="quotes.folder"
            value={form.folder}
            required
            maxLength={200}
            onChange={set('folder')}
          />
        </div>
        <label>
          {t('quotes.senders')}
          <textarea
            dir="ltr"
            value={form.allowedSenders}
            rows={3}
            onChange={set('allowedSenders')}
            aria-describedby="quotes-senders-help"
          />
        </label>
        <p id="quotes-senders-help" className="quotesMuted">
          {t('quotes.sendersHelp')}
        </p>
        <div className="quotesFormGrid">
          <Field
            label="quotes.firstDelay"
            type="number"
            required
            min="1"
            max="90"
            value={form.firstDelayDays}
            onChange={set('firstDelayDays')}
          />
          <Field
            label="quotes.reminderDelay"
            type="number"
            required
            min="1"
            max="90"
            value={form.reminderDays}
            onChange={set('reminderDays')}
          />
          <Field
            label="quotes.maxEmails"
            type="number"
            required
            min="1"
            max="10"
            value={form.maxEmails}
            onChange={set('maxEmails')}
          />
        </div>
        <p className="quotesMuted">{t('quotes.settingsScope')}</p>
        <p className="quotesSecurity">
          <ShieldCheck size={18} aria-hidden="true" />
          {t('quotes.credentialsHelp')}
        </p>
        <div className="quotesActions">
          <button type="submit" disabled={busy}>
            {t('quotes.save')}
          </button>
        </div>
      </form>
    </section>
  );
}
