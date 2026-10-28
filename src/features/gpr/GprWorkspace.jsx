import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderKanban,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import { GPR_STATUSES, isOpenOrder, orderName } from './model.js';
import GprOrderForm from './GprOrderForm.jsx';
import GprWorkCard from './GprWorkCard.jsx';
import { GprChecklist, GprQuickStatus } from './GprProgress.jsx';
import '../projects/project-workspace.css';
import './gpr.css';

export default function GprWorkspace({
  orders,
  emailIntakeConnected = false,
  projects = [],
  loading,
  error,
  onRetry,
  onSave,
  onUpdate,
  renderEmails,
  onOpenProject,
  onNewProject,
  selectedId,
  onSelect,
}) {
  useTranslation();
  const { language } = useLanguage();
  const locale = localeForLanguage(language);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active');
  const [editor, setEditor] = useState(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState([]);
  const pendingRef = useRef(new Set());
  const [progressMessage, setProgressMessage] = useState(null);
  const [progressError, setProgressError] = useState('');
  const selected = orders.find((order) => order.id === selectedId);
  const number = (value) => new Intl.NumberFormat(locale).format(value);
  const date = (value) =>
    new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Hebron', dateStyle: 'medium' }).format(
      new Date(value),
    );
  const day = (value) => date(`${value}T12:00:00Z`);
  const filtered = orders.filter(
    (order) =>
      (filter === '' || (filter === 'active' ? isOpenOrder(order) : order.status === filter)) &&
      [
        order.title,
        order.order_number,
        order.client_name,
        order.location,
        order.contact_name,
        order.contact_email,
        order.description,
      ]
        .join(' ')
        .toLocaleLowerCase(locale)
        .includes(query.trim().toLocaleLowerCase(locale)),
  );
  async function save(form) {
    const result = await onSave(form);
    setEditor(null);
    setSaved(true);
    onSelect(result.id);
  }
  async function update(order, change) {
    if (!onUpdate || pendingRef.current.has(order.id)) return;
    pendingRef.current.add(order.id);
    setPending([...pendingRef.current]);
    setProgressError('');
    setProgressMessage(null);
    setSaved(false);
    try {
      await onUpdate(order, change);
      setProgressMessage({
        name: orderName(order, t),
        key:
          change.type === 'status' && change.value === 'completed'
            ? 'gpr.workCompleted'
            : 'gpr.progressSaved',
      });
    } catch (error) {
      setProgressError(error.code === 'PGRST116' ? 'gpr.conflict' : 'gpr.progressError');
    } finally {
      pendingRef.current.delete(order.id);
      setPending([...pendingRef.current]);
    }
  }
  const status = (order) => (
    <span className={`pill gprStatus gprStatus-${order.status}`}>
      {t(`gpr.status.${order.status}`)}
    </span>
  );
  const project = selected && projects.find((project) => project.id === selected.project_id);

  return (
    <section className="card projectsPage gprPage">
      {progressMessage && (
        <p role="status" className="gprNotice gprSavedProgress">
          <CheckCircle2 size={16} aria-hidden="true" />
          {t(progressMessage.key, { name: progressMessage.name })}
        </p>
      )}
      {progressError && (
        <div role="alert" className="gprError">
          <p>{t(progressError)}</p>
          <button type="button" className="ghost smallBtn" onClick={onRetry}>
            {t('gpr.retry')}
          </button>
        </div>
      )}
      {saved && (
        <p role="status" className="gprNotice">
          {t('gpr.saved')}
        </p>
      )}
      {selected ? (
        <article className="project projectWorkspace gprDetail">
          <div className="projectWorkspaceTop">
            <button
              type="button"
              className="ghost smallBtn projectBackButton"
              onClick={() => onSelect(null)}
            >
              <ArrowRight size={16} />
              {t('gpr.back')}
            </button>
            <span className="gprPrivate">
              <ShieldCheck size={14} />
              {t('gpr.adminOnly')}
            </span>
          </div>
          <header className="gprDetailHeader">
            <div>
              <span className="gprEyebrow">{t('gpr.title')}</span>
              <h2 dir="auto">{orderName(selected, t)}</h2>
              <p className="muted">
                <bdi>{selected.client_name}</bdi>
                {selected.order_number && (
                  <span>
                    {t('gpr.number')} <bdi>{selected.order_number}</bdi>
                  </span>
                )}
              </p>
            </div>
            <div className="actionsRow">
              {status(selected)}
              <button
                className="ghost smallBtn"
                type="button"
                onClick={() => setEditor({ order: selected, mode: 'form' })}
              >
                <Pencil size={16} />
                {t('gpr.edit')}
              </button>
            </div>
          </header>
          <div className="gprDetailActions">
            <GprQuickStatus
              order={selected}
              busy={pending.includes(selected.id)}
              onChange={(change) => update(selected, change)}
            />
            <p>{t('gpr.autoSaveHelp')}</p>
          </div>
          <div className="gprDetailGrid">
            <div className="gprDetailMain">
              <section className="gprPanel">
                <h3>
                  <FileText size={17} />
                  {t('gpr.scope')}
                </h3>
                <p dir="auto">{selected.description || '—'}</p>
                <div className="gprInfoGrid">
                  <div>
                    <span>{t('gpr.location')}</span>
                    <b dir="auto">{selected.location || t('gpr.missingLocation')}</b>
                  </div>
                  <div>
                    <span>{t('gpr.days')}</span>
                    <b>{selected.planned_days != null ? number(selected.planned_days) : '—'}</b>
                  </div>
                  <div>
                    <span>{t('gpr.date')}</span>
                    <b>
                      {selected.scheduled_for ? day(selected.scheduled_for) : t('gpr.unscheduled')}
                    </b>
                  </div>
                </div>
              </section>
              <section className="gprPanel gprTasksPanel">
                <GprChecklist
                  order={selected}
                  busy={pending.includes(selected.id)}
                  onChange={(change) => update(selected, change)}
                />
              </section>
              {renderEmails?.(selected)}
              {selected.notes && (
                <section className="gprPanel">
                  <h3>{t('gpr.notes')}</h3>
                  <p dir="auto">{selected.notes}</p>
                </section>
              )}
              {selected.source_email && !renderEmails && (
                <details className="gprPanel gprOriginal">
                  <summary>
                    <Mail size={16} />
                    {t('gpr.original')}
                  </summary>
                  {selected.source_subject && (
                    <p dir="auto">
                      {t('gpr.originalSubject', { subject: selected.source_subject })}
                    </p>
                  )}
                  <pre dir="auto">{selected.source_email}</pre>
                </details>
              )}
            </div>
            <aside className="gprDetailAside">
              <section className="gprPanel">
                <h3>
                  <UserRound size={17} />
                  {t('gpr.contact')}
                </h3>
                <b dir="auto">{selected.contact_name || t('gpr.missingContact')}</b>
                {selected.contact_phone && (
                  <a
                    className="gprContactLink"
                    href={`tel:${selected.contact_phone.replace(/[^+\d]/g, '')}`}
                    aria-label={t('gpr.call', {
                      name: selected.contact_name || selected.contact_phone,
                    })}
                  >
                    <Phone size={15} />
                    <bdi dir="ltr">{selected.contact_phone}</bdi>
                  </a>
                )}
                {selected.contact_email && (
                  <a
                    className="gprContactLink"
                    href={`mailto:${selected.contact_email}`}
                    aria-label={t('gpr.emailContact', {
                      name: selected.contact_name || selected.contact_email,
                    })}
                  >
                    <Mail size={15} />
                    <bdi>{selected.contact_email}</bdi>
                  </a>
                )}
              </section>
              <section className="gprPanel">
                <h3>
                  <FolderKanban size={17} />
                  {t('gpr.project')}
                </h3>
                <p className="muted" dir="auto">
                  {project?.name || t('gpr.noProject')}
                </p>
                {project ? (
                  <button
                    className="ghost smallBtn"
                    type="button"
                    onClick={() => onOpenProject(project)}
                  >
                    {t('gpr.openProject')}
                    <ArrowLeft size={15} />
                  </button>
                ) : (
                  <>
                    <button
                      className="ghost smallBtn"
                      type="button"
                      onClick={() => setEditor({ order: selected, mode: 'form' })}
                    >
                      {t('gpr.project')}
                    </button>
                    {onNewProject && (
                      <button
                        className="ghost smallBtn"
                        type="button"
                        onClick={() => onNewProject(selected)}
                      >
                        <Plus size={15} />
                        {t('gpr.newProject')}
                      </button>
                    )}
                  </>
                )}
              </section>
              <div className="gprReceived">
                <CalendarDays size={14} />
                <span>{t('gpr.received', { date: date(selected.created_at) })}</span>
              </div>
            </aside>
          </div>
        </article>
      ) : (
        <>
          <header className="gprHeader">
            <div>
              <div className="gprTitleLine">
                <h2>{t('gpr.title')}</h2>
                <span className="gprPrivate">
                  <ShieldCheck size={14} />
                  {t('gpr.adminOnly')}
                </span>
              </div>
              <p className="muted">{t('gpr.workspaceHelp')}</p>
            </div>
            <div className="actionsRow">
              <button
                type="button"
                className="ghost"
                onClick={() => setEditor({ mode: 'email' })}
                disabled={Boolean(error) || loading}
              >
                <Mail size={17} />
                {t('gpr.paste')}
              </button>
              <button
                type="button"
                onClick={() => setEditor({ mode: 'form' })}
                disabled={Boolean(error) || loading}
              >
                <Plus size={18} />
                {t('gpr.add')}
              </button>
            </div>
          </header>
          {!error && (
            <div className="gprOverview" role="group" aria-label={t('gpr.overview')}>
              {[
                ['active', 'toHandle', orders.filter(isOpenOrder).length, ClipboardList],
                [
                  'scheduled',
                  'scheduledWork',
                  orders.filter((order) => order.status === 'scheduled').length,
                  CalendarDays,
                ],
                [
                  'completed',
                  'completedWork',
                  orders.filter((order) => order.status === 'completed').length,
                  CheckCircle2,
                ],
                ['', 'allWork', orders.length, FolderKanban],
              ].map(([value, key, count, Icon]) => (
                <button
                  type="button"
                  key={key}
                  className={filter === value ? 'isActive' : ''}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span>{t(`gpr.${key}`)}</span>
                  <b>{number(count)}</b>
                </button>
              ))}
            </div>
          )}
          <div className="projectListHeader gprFilters">
            <div className="projectListSearch">
              <Search size={18} aria-hidden="true" />
              <label className="visuallyHidden" htmlFor="gpr-search">
                {t('gpr.search')}
              </label>
              <input
                id="gpr-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('gpr.searchPlaceholder')}
              />
            </div>
            <label className="visuallyHidden" htmlFor="gpr-status">
              {t('gpr.filter')}
            </label>
            <select
              id="gpr-status"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="active">{t('gpr.active')}</option>
              <option value="">{t('gpr.all')}</option>
              {GPR_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`gpr.status.${status}`)}
                </option>
              ))}
            </select>
          </div>
          {error ? (
            <div className="gprError" role="alert">
              <p>{t(error)}</p>
              <button className="ghost smallBtn" type="button" onClick={onRetry}>
                {t('gpr.retry')}
              </button>
            </div>
          ) : loading ? (
            <p className="empty" role="status">
              {t('gpr.loading')}
            </p>
          ) : !filtered.length ? (
            <div className="empty gprEmpty">
              <FolderKanban size={32} aria-hidden="true" />
              <h3>
                {t(
                  !orders.length
                    ? 'gpr.empty'
                    : !query.trim() && filter === 'active'
                      ? 'gpr.noOpenWork'
                      : 'gpr.noResults',
                )}
              </h3>
              {orders.length ? (
                <button
                  type="button"
                  className="ghost smallBtn"
                  onClick={() => {
                    setQuery('');
                    setFilter('');
                  }}
                >
                  {t('gpr.clearFilters')}
                </button>
              ) : (
                <>
                  <p>{t('gpr.emptyHelp')}</p>
                  <button
                    type="button"
                    className="ghost smallBtn"
                    onClick={() => setEditor({ mode: 'email' })}
                  >
                    <Mail size={16} />
                    {t('gpr.paste')}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="gprWorkGrid">
              {filtered.map((order) => (
                <GprWorkCard
                  key={order.id}
                  order={order}
                  busy={pending.includes(order.id)}
                  onChange={(change) => update(order, change)}
                  onOpen={() => {
                    setSaved(false);
                    onSelect(order.id);
                  }}
                  onEdit={() => setEditor({ order, mode: 'form' })}
                />
              ))}
            </div>
          )}
          {!emailIntakeConnected && (
            <p className="gprMailSetup">
              <Mail size={15} aria-hidden="true" />
              {t('gpr.mailSetup')}
            </p>
          )}
        </>
      )}
      {editor && (
        <GprOrderForm
          order={editor.order}
          mode={editor.mode}
          projects={projects}
          onSave={save}
          onClose={() => setEditor(null)}
        />
      )}
    </section>
  );
}
