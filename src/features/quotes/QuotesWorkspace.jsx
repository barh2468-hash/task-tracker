import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Bell,
  Download,
  FileText,
  Mail,
  Plus,
  Settings2,
  Upload,
  Users,
} from 'lucide-react';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import {
  changeTracking,
  demoState,
  normalize,
  prepareDraft,
  quotePriority,
  respond,
  saveClient,
  saveQuote,
  saveSettings,
  today,
} from './model.js';
import { readLocalState, storageKey, writeLocalState } from './localStore.js';
import { applyImport } from './import.js';
import { intakeMessage, markMessage } from './mailbox.js';
import { downloadCsv } from './export.js';
import QuoteDialog from './QuoteDialog.jsx';
import {
  ClientForm,
  FormActions,
  MessageForm,
  QuoteForm,
  ResponseFields,
  ResponseForm,
  SnoozeForm,
} from './forms.jsx';
import ImportQuotes from './ImportQuotes.jsx';
import MailboxSettings from './MailboxSettings.jsx';
import { heQuotes } from './translations.js';
import './quotes.css';

const tabs = [
  ['quotes', FileText, 'title'],
  ['clients', Users, 'clients'],
  ['inbox', Bell, 'inbox'],
  ['drafts', Mail, 'drafts'],
  ['settings', Settings2, 'settings'],
];
const errorKey = (error) =>
  Object.hasOwn(heQuotes, `quotes.error.${error.code}`)
    ? `quotes.error.${error.code}`
    : 'quotes.error.generic';

export default function QuotesWorkspace({ scope, preview = false, defaultOwner = '', remote }) {
  useTranslation();
  const { language } = useLanguage();
  const locale = localeForLanguage(language);
  const [loaded, setLoaded] = useState(() => {
    if (remote) return { state: null, revision: null, error: '' };
    try {
      return {
        state: readLocalState(localStorage, scope),
        raw: localStorage.getItem(storageKey(scope)),
        error: '',
      };
    } catch {
      return { state: null, raw: null, error: 'quotes.error.storage' };
    }
  });
  const current = useRef(loaded);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(loaded.error),
    [notice, setNotice] = useState(null);
  const [view, setView] = useState('quotes'),
    [selectedId, setSelectedId] = useState(
      () => new URLSearchParams(window.location.search).get('quote') || '',
    ),
    [dialog, setDialog] = useState(null);
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('open');
  const [connection, setConnection] = useState(null),
    [serverReady, setServerReady] = useState(false),
    [localAvailable, setLocalAvailable] = useState(false);
  const uiState = useRef({ dialog, view });
  uiState.current = { dialog, view };
  async function reloadServer() {
    try {
      const result = await remote.load();
      const next = { state: result.state, revision: result.revision, error: '' };
      current.current = next;
      setLoaded(next);
      setConnection(result.connection);
      setServerReady(result.configured);
      setError('');
      const callbackUrl = new URL(window.location.href),
        callback = callbackUrl.searchParams.get('quotes_m365');
      if (callback) {
        if (callback === 'connected') setNotice({ key: 'quotes.connected' });
        else setError(errorKey({ code: callback }));
        callbackUrl.searchParams.delete('quotes_m365');
        window.history.replaceState(window.history.state, '', callbackUrl);
      }
      try {
        const local = readLocalState(localStorage, scope);
        setLocalAvailable(
          !result.state.quotes.length &&
            !result.state.clients.length &&
            (local.quotes.length > 0 || local.clients.length > 0),
        );
      } catch {
        /* Keep local data. */
      }
    } catch (error) {
      setError(errorKey(error));
    }
  }
  useEffect(() => {
    if (!remote) return;
    void reloadServer();
    const timer = window.setInterval(() => {
      if (
        !lock.current &&
        !uiState.current.dialog &&
        uiState.current.view !== 'settings' &&
        document.visibilityState === 'visible'
      )
        void reloadServer();
    }, 60000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, scope]);
  useEffect(() => {
    if (remote) return;
    const refresh = (event) => {
      if (event && event.key !== storageKey(scope)) return;
      try {
        const next = {
          state: readLocalState(localStorage, scope),
          raw: localStorage.getItem(storageKey(scope)),
          error: '',
        };
        current.current = next;
        setLoaded(next);
        setError('');
      } catch {
        setError('quotes.error.storage');
      }
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, [scope, remote]);
  async function commit(operation, success = { key: 'quotes.saved' }, close = true) {
    if (lock.current || !current.current.state) return false;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice(null);
    const base = current.current;
    try {
      const result = await operation(base.state);
      if (!remote && localStorage.getItem(storageKey(scope)) !== base.raw) {
        const e = new Error('conflict');
        e.code = 'conflict';
        throw e;
      }
      let state = result?.state || result;
      let revision = base.revision;
      try {
        if (remote) {
          const saved = await remote.save(state, base.revision);
          state = saved.state;
          revision = saved.revision;
        } else writeLocalState(localStorage, scope, state);
      } catch (error) {
        if (remote) throw error;
        const e = new Error('storage');
        e.code = 'storage';
        throw e;
      }
      const next = { state, revision, raw: JSON.stringify(state), error: '' };
      current.current = next;
      setLoaded(next);
      setNotice(
        typeof success === 'function'
          ? success(result)
          : remote && success?.key === 'quotes.saved'
            ? { key: 'quotes.cloudSave' }
            : success,
      );
      if (close) setDialog(null);
      return true;
    } catch (error) {
      setError(errorKey(error));
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function openDialog(type, value) {
    setError('');
    setNotice(null);
    setDialog({ type, value });
  }
  function closeDialog() {
    if (!lock.current) {
      setDialog(null);
      setError('');
    }
  }
  function openView(next) {
    setView(next);
    setSelectedId('');
    setQuery('');
    setNotice(null);
    setError('');
  }
  const number = (value) => new Intl.NumberFormat(locale).format(value);
  const formatDate = (value, time = false) => {
    if (!value) return t('quotes.none');
    const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
    if (!Number.isFinite(date.getTime())) return t('quotes.none');
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Jerusalem',
      dateStyle: 'short',
      ...(time ? { timeStyle: 'short' } : {}),
    }).format(date);
  };
  const state = loaded.state;
  if (!state)
    return (
      <section className="quotesWorkspace quotesPanel">
        <h1>{t('quotes.title')}</h1>
        <p className={error ? 'quotesError' : 'quotesMuted'} role={error ? 'alert' : 'status'}>
          {t(error || (remote ? 'quotes.loading' : 'quotes.error.storage'))}
        </p>
        <button
          type="button"
          onClick={() => (remote ? void reloadServer() : window.location.reload())}
        >
          {t('quotes.retry')}
        </button>
      </section>
    );
  const selected = state.quotes.find((q) => q.id === selectedId);
  const clients = new Map(state.clients.map((c) => [c.id, c]));
  const pending = state.messages.filter((m) => m.status === 'pending').length;
  const visibleQuotes = state.quotes
    .filter(
      (q) =>
        (filter === 'all' ||
          (filter === 'attention' && q.status === 'open' && q.tracking === 'needs_attention') ||
          q.status === filter) &&
        normalize(
          `${q.number} ${q.title} ${clients.get(q.clientId)?.name || ''} ${q.owner}`,
        ).includes(normalize(query)),
    )
    .sort(
      (a, b) =>
        quotePriority(a, state) - quotePriority(b, state) || a.sentAt.localeCompare(b.sentAt),
    );
  const badge = (quote) => (
    <span
      className={`quotesBadge ${quote.status === 'open' && quote.tracking === 'needs_attention' ? 'isUrgent' : quote.status === 'won' ? 'isWon' : ''}`}
    >
      {t(
        quote.status === 'open'
          ? `quotes.tracking.${quote.tracking}`
          : `quotes.status.${quote.status}`,
      )}
    </span>
  );
  const stats = [
    ['open', state.quotes.filter((q) => q.status === 'open').length],
    [
      'attention',
      state.quotes.filter((q) => q.status === 'open' && q.tracking === 'needs_attention').length,
    ],
    [
      'awaiting',
      state.quotes.filter((q) => q.status === 'open' && q.tracking === 'awaiting_reply').length,
    ],
    [
      'closedCount',
      state.quotes.filter(
        (q) => q.closedAt && today(new Date(q.closedAt)).startsWith(today().slice(0, 7)),
      ).length,
    ],
  ];
  function exportList() {
    downloadCsv(`quotations-${today()}.csv`, [
      [
        t('quotes.number'),
        t('quotes.client'),
        t('quotes.project'),
        t('quotes.owner'),
        t('quotes.sentAt'),
        t('quotes.status'),
        t('quotes.lastResponse'),
        t('quotes.next'),
        t('quotes.amount'),
      ],
      ...visibleQuotes.map((q) => [
        q.number,
        clients.get(q.clientId)?.name,
        q.title,
        q.owner,
        formatDate(q.sentAt),
        t(`quotes.status.${q.status}`),
        q.lastResponse ? t(`quotes.response.${q.lastResponse}`) : '',
        q.nextFollowup ? formatDate(q.nextFollowup) : '',
        q.amount === '' ? '' : number(q.amount),
      ]),
    ]);
  }
  const approveMessage = (message, form) =>
    commit((value) =>
      markMessage(
        respond(value, form.quoteId, { ...form, source: 'mail_review' }),
        message.id,
        'reviewed',
        form.quoteId,
      ),
    );
  return (
    <section
      className="quotesWorkspace"
      aria-labelledby="quotes-title"
      dir={language === 'he' ? 'rtl' : 'ltr'}
    >
      <header className="quotesHeading">
        <div>
          <span className="quotesEyebrow">{t(remote ? 'quotes.server' : 'quotes.local')}</span>
          <h1 id="quotes-title">{t('quotes.title')}</h1>
          <p className="quotesMuted">{t('quotes.subtitle')}</p>
        </div>
        <span className="quotesConnection">
          <Mail size={16} aria-hidden="true" />
          {t(connection?.enabled ? 'quotes.connected' : 'quotes.notConnected')}
        </span>
      </header>
      <p className="quotesLocalNotice">{t(remote ? 'quotes.serverHelp' : 'quotes.localHelp')}</p>
      {remote && (
        <div className="quotesActions">
          <button
            className="secondary"
            type="button"
            disabled={busy}
            onClick={() => void reloadServer()}
          >
            {t('quotes.refresh')}
          </button>
          {localAvailable && (
            <>
              <p>{t('quotes.migrateHelp')}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void commit(() => readLocalState(localStorage, scope)).then((ok) => {
                    if (ok) setLocalAvailable(false);
                  })
                }
              >
                {t('quotes.migrate')}
              </button>
            </>
          )}
        </div>
      )}
      <nav className="quotesTabs" aria-label={t('quotes.tabs')}>
        {tabs.map(([key, Icon, label]) => (
          <button
            type="button"
            key={key}
            className="secondary"
            aria-current={view === key ? 'page' : undefined}
            onClick={() => openView(key)}
          >
            <Icon size={17} aria-hidden="true" />
            {t(`quotes.${label}`)}
            {key === 'inbox' && pending > 0 && (
              <span className="quotesCount">{number(pending)}</span>
            )}
          </button>
        ))}
      </nav>
      <div role="status" aria-live="polite">
        {notice && <p className="quotesSuccess">{t(notice.key, notice.values)}</p>}
      </div>
      {error && !dialog && (
        <p className="quotesError" role="alert">
          {t(error)}
        </p>
      )}
      {view === 'quotes' && !selected && (
        <>
          <div className="quotesStats">
            {stats.map(([key, count]) => (
              <div key={key} className={key === 'attention' ? 'isUrgent' : ''}>
                <span>{t(`quotes.${key}`)}</span>
                <strong>{number(count)}</strong>
              </div>
            ))}
          </div>
          <div className="quotesToolbar">
            <div className="quotesActions">
              <button
                type="button"
                onClick={() =>
                  state.clients.length
                    ? openDialog('quote')
                    : (openView('clients'), openDialog('client'))
                }
              >
                <Plus size={16} aria-hidden="true" />
                {t(state.clients.length ? 'quotes.new' : 'quotes.newClient')}
              </button>
              <button type="button" className="secondary" onClick={() => openDialog('import')}>
                <Upload size={16} aria-hidden="true" />
                {t('quotes.import')}
              </button>
              <button
                type="button"
                className="ghost"
                disabled={!visibleQuotes.length}
                onClick={exportList}
              >
                <Download size={16} aria-hidden="true" />
                {t('quotes.export')}
              </button>
            </div>
            <div className="quotesFilters">
              <input
                type="search"
                aria-label={t('quotes.search')}
                placeholder={t('quotes.search')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select
                aria-label={t('quotes.filter')}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                {['open', 'attention', 'won', 'cancelled', 'all'].map((key) => (
                  <option key={key} value={key}>
                    {t(
                      key === 'won' || key === 'cancelled'
                        ? `quotes.status.${key}`
                        : `quotes.${key}`,
                    )}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="quotesList">
            {visibleQuotes.map((q) => {
              const client = clients.get(q.clientId);
              return (
                <article
                  key={q.id}
                  className={`quotesRow ${q.tracking === 'needs_attention' && q.status === 'open' ? 'isUrgent' : ''}`}
                >
                  <div>
                    <button
                      type="button"
                      className="quotesLink"
                      onClick={() => setSelectedId(q.id)}
                    >
                      {t('quotes.quoteHeading', { number: q.number })}
                    </button>
                    <h3 dir="auto">{client?.name}</h3>
                    <p dir="auto">{q.title}</p>
                    <span className="quotesMuted">
                      {t('quotes.age', {
                        days: number(
                          Math.max(
                            0,
                            Math.floor(
                              (new Date(`${today()}T12:00:00Z`) -
                                new Date(`${q.sentAt}T12:00:00Z`)) /
                                86400000,
                            ),
                          ),
                        ),
                      })}
                    </span>
                  </div>
                  <div>
                    {badge(q)}
                    <p className="quotesMuted">
                      {q.lastResponse
                        ? t(`quotes.response.${q.lastResponse}`)
                        : t('quotes.noResponse')}
                    </p>
                    {!client?.email && <p className="quotesWarning">{t('quotes.missingEmail')}</p>}
                  </div>
                  <div>
                    <span className="quotesMuted">{t('quotes.next')}</span>
                    <p>{formatDate(q.nextFollowup)}</p>
                    <span dir="auto" className="quotesMuted">
                      {q.owner}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
          {!visibleQuotes.length && (
            <div className="quotesEmpty">
              <FileText size={28} aria-hidden="true" />
              <h2>{t('quotes.empty')}</h2>
              <p>{t('quotes.emptyHelp')}</p>
              {preview && !state.quotes.length && !state.clients.length && (
                <>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => void commit(() => demoState())}
                  >
                    {t('quotes.loadSamples')}
                  </button>
                  <p className="quotesMuted">{t('quotes.sampleHelp')}</p>
                </>
              )}
            </div>
          )}
        </>
      )}
      {view === 'quotes' && selected && (
        <>
          <button type="button" className="quotesLink" onClick={() => setSelectedId('')}>
            <ArrowLeft size={16} aria-hidden="true" />
            {t('quotes.back')}
          </button>
          <div className="quotesDetailHeading">
            <div>
              <h2>{t('quotes.quoteHeading', { number: selected.number })}</h2>
              <p dir="auto">
                {clients.get(selected.clientId)?.name} · {selected.title}
              </p>
            </div>
            {badge(selected)}
          </div>
          <div className="quotesDetailGrid">
            <section className="quotesPanel">
              <dl className="quotesFacts">
                {[
                  [t('quotes.owner'), selected.owner || t('quotes.none')],
                  [t('quotes.sentAt'), formatDate(selected.sentAt)],
                  [
                    t('quotes.email'),
                    clients.get(selected.clientId)?.email || t('quotes.missingEmail'),
                  ],
                  [t('quotes.next'), formatDate(selected.nextFollowup)],
                  [
                    t('quotes.amount'),
                    selected.amount === ''
                      ? t('quotes.none')
                      : new Intl.NumberFormat(locale, {
                          style: 'currency',
                          currency: 'ILS',
                        }).format(selected.amount),
                  ],
                  [t('quotes.source'), t(`quotes.source.${selected.source}`)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd dir="auto">{value}</dd>
                  </div>
                ))}
              </dl>
              {selected.notes && (
                <p className="quotesPlain" dir="auto">
                  {selected.notes}
                </p>
              )}
              <div className="quotesActions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => openDialog('quote', selected)}
                >
                  {t('quotes.edit')}
                </button>
                <button type="button" onClick={() => openDialog('response', selected)}>
                  {t('quotes.recordResponse')}
                </button>
                {selected.status === 'open' ? (
                  <>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        void commit(
                          (s) => prepareDraft(s, selected.id),
                          { key: 'quotes.draftSaved' },
                          false,
                        )
                      }
                      disabled={busy}
                    >
                      {t('quotes.prepare')}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        void commit(
                          (s) =>
                            changeTracking(
                              s,
                              selected.id,
                              selected.tracking === 'paused' ? 'resume' : 'pause',
                            ),
                          undefined,
                          false,
                        )
                      }
                      disabled={busy}
                    >
                      {t(selected.tracking === 'paused' ? 'quotes.resume' : 'quotes.pause')}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => openDialog('snooze', selected)}
                    >
                      {t('quotes.snooze')}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => openDialog('won', selected)}
                    >
                      {t('quotes.won')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void commit((s) => changeTracking(s, selected.id, 'reopen'), undefined, false)
                    }
                  >
                    {t('quotes.reopen')}
                  </button>
                )}
              </div>
            </section>
            <section className="quotesPanel">
              <h3>{t('quotes.history')}</h3>
              <ol className="quotesTimeline">
                {selected.events.map((e) => (
                  <li key={e.id}>
                    <time dateTime={e.at}>{formatDate(e.at, true)}</time>
                    <p>
                      {t(`quotes.event.${e.type}`, {
                        response: e.data.option ? t(`quotes.response.${e.data.option}`) : '',
                        date: e.data.date ? formatDate(e.data.date) : '',
                        round: number(e.data.round || 0),
                      })}
                    </p>
                    {e.data.note && (
                      <p className="quotesPlain" dir="auto">
                        {e.data.note}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </>
      )}
      {view === 'clients' && (
        <>
          <div className="quotesSectionHeading">
            <h2>{t('quotes.clients')}</h2>
            <button type="button" onClick={() => openDialog('client')}>
              <Plus size={16} aria-hidden="true" />
              {t('quotes.newClient')}
            </button>
          </div>
          <div className="quotesClientGrid">
            {state.clients.map((client) => (
              <article key={client.id} className="quotesPanel">
                <h3 dir="auto">{client.name}</h3>
                <p dir="auto">{client.contact}</p>
                {client.email && (
                  <p>
                    <a href={`mailto:${client.email}`}>
                      <bdi>{client.email}</bdi>
                    </a>
                  </p>
                )}
                {client.phone && <p dir="auto">{client.phone}</p>}
                <p className="quotesMuted">
                  {t('quotes.clientQuotes', {
                    count: number(
                      state.quotes.filter((q) => q.clientId === client.id && q.status === 'open')
                        .length,
                    ),
                  })}
                </p>
                {client.optOut && <p className="quotesWarning">{t('quotes.optOut')}</p>}
                <div className="quotesActions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => openDialog('client', client)}
                  >
                    {t('quotes.editClient')}
                  </button>
                  {state.quotes
                    .filter((q) => q.clientId === client.id)
                    .map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        className="quotesLink"
                        onClick={() => {
                          setView('quotes');
                          setSelectedId(q.id);
                        }}
                      >
                        {t('quotes.quoteHeading', { number: q.number })}
                      </button>
                    ))}
                </div>
              </article>
            ))}
          </div>
          {!state.clients.length && <p className="quotesEmpty">{t('quotes.clientsEmpty')}</p>}
        </>
      )}
      {view === 'settings' && (
        <MailboxSettings
          key={scope}
          settings={state.settings}
          busy={busy}
          onSave={(form) => commit((s) => saveSettings(s, form), undefined, false)}
          live={Boolean(remote)}
          connection={connection}
          configured={serverReady}
          formatDate={formatDate}
          onAction={async (action, payload = {}) => {
            if (lock.current) return;
            lock.current = true;
            setBusy(true);
            setError('');
            try {
              const result = await remote.action(action, payload);
              if (action === 'connect') {
                const url = new URL(result.url);
                if (url.origin !== 'https://login.microsoftonline.com')
                  throw new Error('unsafe redirect');
                window.location.assign(url.href);
              } else {
                await reloadServer();
                setNotice({ key: action === 'sync' ? 'quotes.syncDone' : 'quotes.cloudSave' });
              }
            } catch (error) {
              setError(errorKey(error));
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        />
      )}
      {view === 'inbox' && (
        <>
          <div className="quotesSectionHeading">
            <h2>{t('quotes.inbox')}</h2>
            <button type="button" onClick={() => openDialog('message')}>
              <Plus size={16} aria-hidden="true" />
              {t('quotes.pasteEmail')}
            </button>
          </div>
          {state.messages.map((message) => (
            <article key={message.id} className="quotesPanel">
              <div className="quotesSectionHeading">
                <h3 dir="auto">{message.subject}</h3>
                <span className="quotesBadge">{t(`quotes.${message.status}`)}</span>
              </div>
              <p>
                <bdi>{message.sender}</bdi> · {formatDate(message.receivedAt, true)}
              </p>
              <p className="quotesWarning">
                {t(
                  message.verification === 'microsoft_graph'
                    ? 'quotes.microsoftMessage'
                    : 'quotes.unverified',
                )}
              </p>
              <details>
                <summary>{t('quotes.body')}</summary>
                <pre dir="auto" className="quotesPlain">
                  {message.body}
                </pre>
              </details>
              {message.status === 'pending' && (
                <div className="quotesActions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      state.clients.length
                        ? openDialog('quote', {
                            number: '',
                            title: message.subject,
                            sentAt: today(),
                          })
                        : (openView('clients'), openDialog('client'))
                    }
                  >
                    {t('quotes.createFromMail')}
                  </button>
                </div>
              )}
              {message.status === 'pending' && (
                <MessageReview
                  state={state}
                  message={message}
                  onSave={(form) => approveMessage(message, form)}
                  onIgnore={() =>
                    commit((s) => markMessage(s, message.id, 'ignored'), undefined, false)
                  }
                  busy={busy}
                />
              )}
            </article>
          ))}
          {!state.messages.length && <p className="quotesEmpty">{t('quotes.inboxEmpty')}</p>}
        </>
      )}
      {view === 'drafts' && (
        <>
          <h2>{t('quotes.drafts')}</h2>
          {state.drafts.map((draft) => {
            const q = state.quotes.find((q) => q.id === draft.quoteId),
              client = clients.get(q?.clientId);
            if (!q || !client) return null;
            return (
              <article className="quotesPanel" key={draft.id}>
                <span className="quotesBadge">{t('quotes.draftOnly')}</span>
                {(q.status !== 'open' || client.optOut) && (
                  <p className="quotesWarning">{t('quotes.draftInactive')}</p>
                )}
                <h3>{t('quotes.draftSubject', { number: q.number, title: q.title })}</h3>
                <p>
                  {t('quotes.to')}: <bdi>{draft.to}</bdi>
                </p>
                <p>
                  {t('quotes.from')}:{' '}
                  <bdi>{state.settings.mailbox || t('quotes.mailboxMissing')}</bdi>
                </p>
                <pre className="quotesPlain" dir="auto">
                  {t('quotes.draftBody', {
                    name: client.contact || client.name,
                    number: q.number,
                    title: q.title,
                    date: formatDate(q.sentAt),
                  })}
                </pre>
                <button
                  type="button"
                  className="quotesLink"
                  onClick={() => {
                    setView('quotes');
                    setSelectedId(q.id);
                  }}
                >
                  {t('quotes.quoteHeading', { number: q.number })}
                </button>
              </article>
            );
          })}
          {!state.drafts.length && <p className="quotesEmpty">{t('quotes.draftsEmpty')}</p>}
        </>
      )}
      {dialog && (
        <QuoteDialog
          title={t(
            {
              quote: dialog.value ? 'quotes.edit' : 'quotes.new',
              client: dialog.value ? 'quotes.editClient' : 'quotes.newClient',
              response: 'quotes.recordResponse',
              import: 'quotes.import',
              snooze: 'quotes.snooze',
              won: 'quotes.won',
              message: 'quotes.pasteEmail',
            }[dialog.type],
          )}
          onClose={closeDialog}
          error={error}
        >
          {dialog.type === 'quote' && (
            <QuoteForm
              quote={dialog.value}
              clients={state.clients}
              defaultOwner={defaultOwner}
              busy={busy}
              onClose={closeDialog}
              onSave={(form) => commit((s) => saveQuote(s, form))}
            />
          )}
          {dialog.type === 'client' && (
            <ClientForm
              client={dialog.value}
              busy={busy}
              onClose={closeDialog}
              onSave={(form) => commit((s) => saveClient(s, form))}
            />
          )}
          {dialog.type === 'response' && (
            <ResponseForm
              busy={busy}
              onClose={closeDialog}
              onSave={(form) => commit((s) => respond(s, dialog.value.id, form))}
            />
          )}
          {dialog.type === 'snooze' && (
            <SnoozeForm
              busy={busy}
              onClose={closeDialog}
              onSave={(date) => commit((s) => changeTracking(s, dialog.value.id, 'snooze', date))}
            />
          )}
          {dialog.type === 'won' && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void commit((s) => changeTracking(s, dialog.value.id, 'won'));
              }}
            >
              <p>{t('quotes.wonHelp')}</p>
              <FormActions onClose={closeDialog} busy={busy} label="quotes.won" />
            </form>
          )}
          {dialog.type === 'message' && (
            <MessageForm
              busy={busy}
              onClose={closeDialog}
              onSave={(form) => commit((s) => intakeMessage(s, form))}
            />
          )}
          {dialog.type === 'import' && (
            <ImportQuotes
              state={state}
              busy={busy}
              onClose={closeDialog}
              formatNumber={number}
              onImport={(rows, source) =>
                commit(
                  (s) => applyImport(s, rows, source),
                  (result) => ({
                    key: 'quotes.importSummary',
                    values: { added: number(result.added), updated: number(result.updated) },
                  }),
                )
              }
            />
          )}
        </QuoteDialog>
      )}
    </section>
  );
}

function MessageReview({ state, message, onSave, onIgnore, busy }) {
  const [form, setForm] = useState({
    quoteId: message.suggestedQuoteId || '',
    option: 'interested',
    date: '',
    note: '',
  });
  return (
    <form
      className="quotesReview"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(form);
      }}
    >
      <label>
        {t('quotes.linkQuote')}
        <select
          aria-label={t('quotes.linkQuote')}
          value={form.quoteId}
          required
          onChange={(event) => setForm((current) => ({ ...current, quoteId: event.target.value }))}
        >
          <option value="">{t('quotes.chooseQuote')}</option>
          {state.quotes.map((q) => (
            <option value={q.id} key={q.id}>
              {t('quotes.quoteHeading', { number: q.number })}
            </option>
          ))}
        </select>
      </label>
      <ResponseFields form={form} setForm={setForm} />
      <div className="quotesActions">
        <button type="submit" disabled={busy || !state.quotes.length}>
          {t('quotes.recordEmailResponse')}
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={() => void onIgnore()}>
          {t('quotes.ignore')}
        </button>
      </div>
    </form>
  );
}
