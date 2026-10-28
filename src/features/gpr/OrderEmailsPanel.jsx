import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import { getOrderEmails } from './api.js';
import { Mail, Paperclip } from 'lucide-react';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh.js';

export default function OrderEmailsPanel({ order, loadEmails = getOrderEmails, live = true }) {
  useTranslation();
  const { language } = useLanguage();
  const [emails, setEmails] = useState([]);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  useRealtimeRefresh({
    enabled: live,
    channelName: `gpr-order-emails-${order.id}`,
    tables: ['gpr_order_emails'],
    onRefresh: () => setReload((value) => value + 1),
  });
  useEffect(() => {
    let active = true;
    setError(false);
    setLoading(true);
    setEmails([]);
    void loadEmails(order.id)
      .then((data) => {
        if (active) setEmails(data);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [order.id, reload, loadEmails]);
  const rows =
    order.source_email && !emails.some((email) => email.status === 'imported')
      ? [
          ...emails,
          {
            id: 'original',
            subject: order.source_subject || t('gpr.original'),
            body_text: order.source_email,
            status: 'imported',
          },
        ]
      : emails;
  return (
    <section className="gprPanel gprMicrosoftEmails">
      <h3>
        <Mail size={17} aria-hidden="true" />
        {t('gpr.emailHistory')}
      </h3>
      <p className="muted">{t('gpr.emailHistoryHelp')}</p>
      {loading && <p role="status">{t('gpr.loadingEmails')}</p>}
      {error && (
        <>
          <p role="alert">{t('gpr.microsoft.failed')}</p>
          <button
            type="button"
            className="ghost smallBtn"
            onClick={() => setReload((value) => value + 1)}
          >
            {t('gpr.retry')}
          </button>
        </>
      )}
      {rows.map((email) => (
        <details key={email.id} className="gprEmailEntry">
          <summary>
            <span className="gprEmailType">
              {t(email.status === 'imported' ? 'gpr.original' : 'gpr.emailUpdate')}
            </span>
            <span dir="auto">{email.subject || t('gpr.original')}</span>
            {email.has_attachments && <Paperclip size={14} aria-label={t('gpr.hasAttachments')} />}
          </summary>
          <p>
            <bdi>{email.sender}</bdi>
            {email.received_at && (
              <span>
                {' '}
                ·{' '}
                {new Intl.DateTimeFormat(localeForLanguage(language), {
                  timeZone: 'Asia/Hebron',
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(email.received_at))}
              </span>
            )}
          </p>
          <pre dir="auto">{email.body_text}</pre>
          {email.has_attachments && <p>{t('gpr.microsoft.attachmentsNote')}</p>}
          {email.web_url && (
            <a href={email.web_url} target="_blank" rel="noreferrer">
              {t('gpr.microsoft.openOutlook')}
            </a>
          )}
        </details>
      ))}
      {!loading && !error && !rows.length && <p>{t('gpr.noEmails')}</p>}
    </section>
  );
}
