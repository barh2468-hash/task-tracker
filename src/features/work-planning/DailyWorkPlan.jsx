import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Copy, CornerDownLeft, Eye, Info, Maximize2, Minimize2, PencilLine, Plus, Printer, Save, Send, Table2, Trash2 } from 'lucide-react';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import { applyProject, createPlanRow, planColumns, planStorageKey, samePlanRows, shiftPlanDate, todayPlanDate } from './localPlans.js';
import { copyPreviousPlan } from './previousPlan.js';
import useLocalPlan from './useLocalPlan.js';
import { getPlanProjectChoices } from './projectChoices.js';
import { getWorkerCellGroups, updateWorkerGroup } from './rowGroups.js';
import WorkerPicker from './WorkerPicker.jsx';
import StaffingCounter from './StaffingCounter.jsx';
import SharedPlanLoader from './SharedPlanLoader.jsx';
import './work-planning.css';

function WorkPlanTextarea(props) {
  // The hidden mirror gives the editor its full natural height before focus.
  return <div className="workPlanTextEditor" data-value={props.value || props.placeholder || ''} dir="auto">
    <textarea {...props} rows={1} wrap="soft" />
  </div>;
}

function formatStart(value, language) {
  if (value === '__after__') return t('workPlan.after');
  // These are civil work-site times, not instants. Format without shifting the hour.
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return new Intl.DateTimeFormat(localeForLanguage(language), {
      timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date(`2000-01-01T${value}:00Z`));
  }
  return value;
}

function PlanForDate({ date, onDateChange, storageScope, workers, projects, projectsReady, canEdit, initialRows, planningRoster, rosterSource, shared }) {
  const { language } = useLanguage();
  const locale = localeForLanguage(language);
  const local = useLocalPlan(planStorageKey(storageScope, date), initialRows);
  const { plan, error, unsaved } = local;
  // Open the shared publication first, even when this device has an older or empty draft.
  const [viewing, setViewing] = useState(!canEdit || Boolean(shared?.record));
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copyRequestRef = useRef(null);
  const pageRef = useRef(null);
  const expandButtonRef = useRef(null);
  const tableRef = useRef(null);
  const listId = useId();
  const editing = canEdit && !viewing;
  const publishedRows = shared ? shared.record?.rows || [] : plan.publishedRows;
  const publishedAt = shared ? shared.record?.published_at : plan.publishedAt;
  const rows = editing ? plan.rows : publishedRows || [];
  const rowNumber = (index) => new Intl.NumberFormat(locale).format(index + 1);
  const displayedDate = new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Hebron', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));
  const changed = editing && publishedAt && !samePlanRows(plan.rows, publishedRows);
  const blocked = error === 'invalid' || error === 'conflict' || publishing || copying;
  const draftRoster = plan.rosterNames ?? planningRoster;
  const registeredWorkers = workers.filter((worker) => worker.id);
  const sortedWorkers = [...new Set((registeredWorkers.length ? registeredWorkers : workers)
    .map((worker) => worker.full_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale));
  const cellGroups = getWorkerCellGroups(rows, workers);
  const activeProjects = projects.filter((project) => !project.is_archived).sort((a, b) => a.name.localeCompare(b.name, locale));

  useEffect(() => () => { copyRequestRef.current = null; }, []);

  useEffect(() => {
    if (!expanded) return;
    const page = pageRef.current;
    const expandButton = expandButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    const siblings = [];
    for (let node = page; node?.parentElement && node !== document.body; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling !== node) { siblings.push([sibling, sibling.inert]); sibling.inert = true; }
      }
    }
    document.body.style.overflow = 'hidden';
    expandButton?.focus({ preventScroll: true });
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); setExpanded(false); }
      if (event.key !== 'Tab') return;
      const controls = [...page.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')]
        .filter((element) => element.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    page.addEventListener('keydown', onKeyDown);
    return () => {
      page.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      siblings.forEach(([sibling, inert]) => { sibling.inert = inert; });
      expandButton?.focus({ preventScroll: true });
    };
  }, [expanded]);

  function changeDate(next) {
    if (copying || !next || next === date) return;
    if (unsaved && !window.confirm(t('workPlan.unsaved'))) return;
    onDateChange(next);
  }

  function updateCell(id, column, value) {
    setNotice('');
    if (column === 'leader' || column === 'helpers') {
      const group = cellGroups[rows.findIndex((row) => row.id === id)][column];
      local.updateRows((current) => updateWorkerGroup(current, group.rowIds, column, value));
      return;
    }
    local.updateRows((current) => current.map((row) => row.id === id ? {
      ...row, [column]: column === 'start' && value === t('workPlan.after') ? '__after__' : value,
    } : row));
  }

  function addRow(afterId) {
    const id = crypto.randomUUID();
    local.updateRows((current) => {
      if (!afterId) return [...current, createPlanRow({ id })];
      const index = current.findIndex((row) => row.id === afterId);
      const previous = current[index];
      const next = createPlanRow({ id, leader: previous.leader, helpers: previous.helpers, start: '__after__' });
      return [...current.slice(0, index + 1), next, ...current.slice(index + 1)];
    });
    window.requestAnimationFrame(() => {
      const row = tableRef.current?.querySelector(`[data-row-id="${id}"]`);
      const input = row?.querySelector('select:not(:disabled),button:not(:disabled),input:not(:disabled),textarea:not(:disabled)');
      input?.focus();
    });
  }

  function move(id, delta) {
    local.updateRows((current) => {
      const index = current.findIndex((row) => row.id === id);
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function copyPrevious() {
    if (blocked || copyRequestRef.current) return;
    const request = {};
    copyRequestRef.current = request;
    setCopying(true);
    setCopyError(false);
    setNotice('');
    try {
      const source = await copyPreviousPlan({ date, storageScope, storage: window.localStorage, loadPublished: shared?.loadPublication });
      if (copyRequestRef.current !== request) return;
      if (!source) { setNotice('workPlan.noPrevious'); return; }
      if (plan.rows.length && !window.confirm(t('workPlan.confirmCopy'))) return;
      if (local.replaceDraft({ rows: source.rows, rosterNames: source.rosterNames ?? draftRoster })) setNotice('workPlan.copySuccess');
    } catch {
      if (copyRequestRef.current === request) setCopyError(true);
    } finally {
      if (copyRequestRef.current === request) { copyRequestRef.current = null; setCopying(false); }
    }
  }

  function loadPublishedDraft() {
    if (!publishedRows?.length) return;
    if (plan.rows.length && !window.confirm(t('workPlan.confirmLoadPublished'))) return;
    if (local.replaceDraft({ rows: structuredClone(publishedRows), rosterNames: planningRoster })) setNotice('workPlan.loadedPublished');
  }

  function field(row, column, index) {
    const group = cellGroups[index][column];
    const label = group?.span > 1
      ? t('workPlan.groupField', { column: t(`workPlan.${column}`), from: rowNumber(index), to: rowNumber(index + group.span - 1) })
      : t('workPlan.field', { column: t(`workPlan.${column}`), row: rowNumber(index) });
    const value = column === 'start' ? formatStart(row.start, language) : row[column];
    if (!editing) return <div className="workPlanCellValue" dir="auto">{value}</div>;
    const assignmentDescriptionId = `${listId}-${row.id}-projects`;
    const placeholders = { leader: 'workPlan.workerPlaceholder', helpers: 'workPlan.helpersPlaceholder', work: 'workPlan.workPlaceholder', start: 'workPlan.startPlaceholder' };
    const props = {
      'aria-label': label,
      'data-column': column,
      value: column === 'start' && row.start !== '__after__' ? row.start : value,
      title: value || label,
      dir: 'auto',
      disabled: blocked,
      onChange: (event) => updateCell(row.id, column, event.target.value),
      placeholder: placeholders[column] ? t(placeholders[column]) : undefined,
      'aria-describedby': column === 'leader' ? assignmentDescriptionId : undefined,
    };
    if (column === 'leader' || column === 'helpers') return <>
      <WorkerPicker value={value} names={sortedWorkers} multiple={column === 'helpers'} label={label}
        compact={column === 'helpers' && group.solo}
        disabled={blocked} describedBy={column === 'leader' ? assignmentDescriptionId : undefined}
        onChange={(next) => updateCell(row.id, column, next)} />
      <div className="workPlanPrintValue" dir="auto">{value}</div>
    </>;
    let projectPicker;
    if (column === 'work') {
      const choices = getPlanProjectChoices(row.leader, workers, activeProjects);
      const workerName = choices.worker?.full_name.trim();
      const savedProject = row.projectId && !choices.projects.some((project) => project.id === row.projectId);
      const savedName = projects.find((project) => project.id === row.projectId)?.name || row.work;
      const descriptionKey = !projectsReady ? 'workPlan.assignedLoading'
        : choices.status === 'missing' ? 'workPlan.chooseWorkerForProjects'
          : choices.status === 'ambiguous' ? 'workPlan.ambiguousWorker'
            : choices.status === 'unknown' ? 'workPlan.unknownWorker'
              : !choices.projects.length ? 'workPlan.noAssignedProjects' : 'workPlan.assignedProjectsCount';
      projectPicker = <>
        <select
          aria-label={choices.worker ? t('workPlan.projectForWorkerRow', { row: rowNumber(index), name: workerName }) : t('workPlan.projectForRow', { row: rowNumber(index) })}
          aria-describedby={assignmentDescriptionId}
          title={t(descriptionKey, { name: workerName || row.leader, count: new Intl.NumberFormat(locale).format(choices.projects.length) })}
          className="workPlanProjectPicker" value={row.projectId}
          disabled={blocked || !projectsReady || !choices.projects.length}
          onChange={(event) => {
            const selectedId = event.target.value;
            local.updateRows((current) => current.map((item) => {
              if (item.id !== row.id) return item;
              if (!selectedId) return applyProject(item, null);
              const project = getPlanProjectChoices(item.leader, workers, activeProjects).projects.find((candidate) => candidate.id === selectedId);
              return project ? applyProject(item, project) : item;
            }));
            setNotice('');
          }}
        >
          <option value="">{t(choices.worker ? 'workPlan.assignedProjectPlaceholder' : 'workPlan.projectPlaceholder')}</option>
          {savedProject && <option value={row.projectId} disabled>{t('workPlan.savedProjectOption', { name: savedName })}</option>}
          {choices.projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
        </select>
        <p id={assignmentDescriptionId} className="workPlanAssignmentHint">{t(descriptionKey, {
          name: workerName || row.leader,
          count: new Intl.NumberFormat(locale).format(choices.projects.length),
        })}</p>
      </>;
    }
    return <>
      {projectPicker}
      {column === 'start' && <select className="workPlanTimePicker" aria-label={t('workPlan.timeForRow', { row: rowNumber(index) })}
        title={t('workPlan.startPlaceholder')} value={row.start} disabled={blocked}
        onChange={(event) => updateCell(row.id, column, event.target.value)}>
        <option value="">{t('workPlan.startPlaceholder')}</option>
        {row.start && !['07:00', '08:00', '20:00', '22:00', '01:00', '__after__'].includes(row.start)
          && <option value={row.start}>{value}</option>}
        {['07:00', '08:00', '20:00', '22:00', '01:00', '__after__'].map((start) => <option key={start} value={start}>{formatStart(start, language)}</option>)}
      </select>}
      <WorkPlanTextarea {...props} />
      <div className="workPlanPrintValue" dir="auto">{value}</div>
    </>;
  }

  async function publish() {
    if (!shared) {
      if (local.publish()) setNotice('workPlan.publishSuccess');
      return;
    }
    if (!local.save()) return;
    setPublishing(true);
    setPublishError('');
    setNotice('');
    try {
      await shared.publish(structuredClone(plan.rows), draftRoster);
      setNotice('workPlan.sharedPublishSuccess');
    } catch (failure) {
      setPublishError(failure.message === 'conflict' ? 'workPlan.sharedConflict' : 'workPlan.sharedPublishError');
    } finally { setPublishing(false); }
  }

  const time = (value) => new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Hebron', dateStyle: 'short', timeStyle: 'short',
  }).format(new Date(value));

  return <section ref={pageRef} id={`${listId}-plan-screen`} className={`workPlanPage${expanded ? ' workPlanExpanded' : ''}`}
    role={expanded ? 'dialog' : undefined} aria-modal={expanded ? true : undefined} aria-label={t('workPlan.title')}>
    <header className="workPlanHeading">
      <div className="workPlanIdentity"><span className="workPlanIcon"><Table2 size={25} aria-hidden="true" /></span><div>
        <h1>{t('workPlan.title')}</h1><p>{t('workPlan.subtitle')}</p>
      </div></div>
      <span className={`workPlanStatus${changed ? ' changed' : ''}`}>
        {t(changed ? 'workPlan.draftChanged' : publishedAt ? shared ? 'workPlan.sharedPublished' : 'workPlan.published' : 'workPlan.draft')}
      </span>
    </header>
    <p className="workPlanLocalNotice"><Info size={14} aria-hidden="true" /><span>{t(shared ? 'workPlan.sharedNotice' : 'workPlan.local')}</span></p>
    <div className="workPlanToolbar">
      <div className="workPlanDateNavigation">
        <button type="button" className="ghost workPlanSquare" disabled={copying || date === '1900-01-01'} aria-label={t('workPlan.previous')} onClick={() => changeDate(shiftPlanDate(date, -1))}>
          {language === 'he' ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}
        </button>
        <label className="workPlanDateLabel"><CalendarDays size={18} aria-hidden="true" /><span>{t('workPlan.date')}</span><input type="date" value={date} disabled={copying} min="1900-01-01" max="9999-12-31" onChange={(event) => changeDate(event.target.value)} /></label>
        <button type="button" className="ghost workPlanSquare" disabled={copying || date === '9999-12-31'} aria-label={t('workPlan.next')} onClick={() => changeDate(shiftPlanDate(date, 1))}>
          {language === 'he' ? <ChevronLeft size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
        </button>
      </div>
      <StaffingCounter rows={rows} rosterNames={editing ? draftRoster : planningRoster} workers={workers} source={editing && plan.rosterNames ? 'published' : rosterSource} />
      <div className="workPlanViewModes" role="group" aria-label={t('workPlan.modes')}>
        {canEdit && <button type="button" className={editing ? 'active' : 'ghost'} disabled={copying} aria-pressed={editing} onClick={() => { setViewing(false); setNotice(''); }}><PencilLine size={14} aria-hidden="true" />{t('workPlan.edit')}</button>}
        <button type="button" className={!editing ? 'active' : 'ghost'} disabled={copying} aria-pressed={!editing} onClick={() => { setViewing(true); setNotice(''); }}><Eye size={14} aria-hidden="true" />{t('workPlan.view')}</button>
      </div>
    </div>
    <div className="workPlanUtilityRow"><p>{t('workPlan.compactHint')}<span className="workPlanMobileScroll"> {t('workPlan.scroll')}</span></p><div>
      <button ref={expandButtonRef} type="button" className="ghost workPlanExpandControl" aria-expanded={expanded} aria-controls={`${listId}-plan-screen`} onClick={() => setExpanded((value) => !value)}>
        {expanded ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}{t(expanded ? 'workPlan.collapseTable' : 'workPlan.expandTable')}
      </button>
      {editing && <button type="button" className="ghost" disabled={blocked || date === '1900-01-01'} aria-busy={copying} onClick={copyPrevious}><Copy size={16} aria-hidden="true" />{t(copying ? 'workPlan.copyingPrevious' : 'workPlan.copyPrevious')}</button>}
      {editing && shared?.record && <button type="button" className="ghost" disabled={blocked || samePlanRows(plan.rows, publishedRows)} onClick={loadPublishedDraft}>
        <Copy size={16} aria-hidden="true" />{t('workPlan.loadPublished')}
      </button>}
      <button type="button" className="ghost" disabled={!rows.length} onClick={() => window.print()}><Printer size={16} aria-hidden="true" />{t('workPlan.print')}</button>
    </div></div>
    {publishError && <div className="workPlanError" role="alert">{t(publishError)}</div>}
    {copyError && <div className="workPlanError" role="alert">{t('workPlan.copyPreviousError')}</div>}
    {error && editing && <div className="workPlanError" role="alert"><p>{t(error === 'invalid' ? 'workPlan.invalidError' : error === 'conflict' ? 'workPlan.conflictError' : 'workPlan.storageError')}</p>
      <button type="button" className="ghost" onClick={() => {
        if (unsaved && !window.confirm(t('workPlan.confirmReload'))) return;
        local.reload(); setNotice('');
      }}>{t('workPlan.reload')}</button>
    </div>}
    {/* Keyboard focus is needed to scroll the read-only table horizontally. */}
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
    <div className="workPlanTableWrap" ref={tableRef} role="region" aria-label={t('workPlan.tableLabel', { date: displayedDate })} tabIndex={0}>
      <table className="workPlanTable">
        <caption><span>{t('workPlan.tableTitle', { date: displayedDate })}</span></caption>
        <colgroup>{planColumns.map((column) => <col key={column} className={`workPlanColumn-${column}`} />)}</colgroup>
        <thead><tr>{planColumns.map((column) => <th scope="col" key={column}>{t(`workPlan.${column}`)}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={row.id} data-row-id={row.id}>
          {planColumns.map((column) => {
            const group = cellGroups[index][column];
            if (group && group.start !== index) return null;
            if (column === 'helpers' && group.solo) return null;
            const solo = column === 'leader' && group.solo;
            return <td key={column} rowSpan={group?.span || undefined}
              colSpan={solo ? 2 : undefined}
              className={[group?.span > 1 ? 'workPlanMergedCell' : '', solo ? 'workPlanSoloCell' : ''].filter(Boolean).join(' ') || undefined} data-column={column}>
            {solo && editing ? <div className="workPlanSoloCrew">{field(row, column, index)}{field(row, 'helpers', index)}</div> : field(row, column, index)}
            {column === 'vehicle' && editing && <div className="workPlanRowActions">
              <button type="button" className="ghost" disabled={blocked} aria-label={t('workPlan.continue', { row: rowNumber(index) })} onClick={() => addRow(row.id)}><CornerDownLeft size={14} aria-hidden="true" /></button>
              <button type="button" className="ghost" disabled={blocked || index === 0} aria-label={t('workPlan.up', { row: rowNumber(index) })} onClick={() => move(row.id, -1)}><ArrowUp size={14} aria-hidden="true" /></button>
              <button type="button" className="ghost" disabled={blocked || index === rows.length - 1} aria-label={t('workPlan.down', { row: rowNumber(index) })} onClick={() => move(row.id, 1)}><ArrowDown size={14} aria-hidden="true" /></button>
              <button type="button" className="ghost" disabled={blocked} aria-label={t('workPlan.remove', { row: rowNumber(index) })} onClick={() => {
                if (window.confirm(t('workPlan.confirmRemove', { row: rowNumber(index) }))) local.updateRows((current) => current.filter((item) => item.id !== row.id));
              }}><Trash2 size={14} aria-hidden="true" /></button>
            </div>}
          </td>; })}
        </tr>)}</tbody>
      </table>
      {!rows.length && <div className="workPlanEmpty">{t(editing ? 'workPlan.empty' : shared ? 'workPlan.sharedEmpty' : 'workPlan.emptyPublished')}</div>}
    </div>
    <footer className="workPlanFooter">
      <div><span className="workPlanRowCount">{t('workPlan.count', { count: new Intl.NumberFormat(locale).format(rows.length) })}</span>
        {editing && <p>{plan.savedAt ? t('workPlan.savedAt', { time: time(plan.savedAt) }) : t('workPlan.autoSave')}</p>}
        {!editing && publishedAt && <p>{t(shared ? 'workPlan.sharedPublishedAt' : 'workPlan.publishedAt', { time: time(publishedAt) })}</p>}
      </div>
      {editing && <div className="workPlanActions">
        <button type="button" className="ghost" disabled={blocked} onClick={() => addRow()}><Plus size={17} aria-hidden="true" />{t('workPlan.add')}</button>
        <button type="button" className="secondary" disabled={blocked} onClick={() => { if (local.save()) setNotice('workPlan.saveSuccess'); }}><Save size={17} aria-hidden="true" />{t('workPlan.save')}</button>
        <button type="button" disabled={blocked || !plan.rows.length} onClick={publish}><Send size={17} aria-hidden="true" />{t(publishing ? 'workPlan.publishing' : shared ? 'workPlan.sharedPublish' : 'workPlan.publish')}</button>
      </div>}
    </footer>
    <p className="workPlanFeedback" role="status" aria-live="polite">{notice ? t(notice) : ''}</p>
  </section>;
}

export default function DailyWorkPlan({ storageScope, workers = [], projects = [], projectsReady = true, canEdit = false, initialDate, initialRows = [], planningRoster, rosterSource = 'directory', shared = false }) {
  useTranslation();
  const [date, setDate] = useState(initialDate || todayPlanDate);
  const props = { date, onDateChange: setDate, storageScope, workers, projects, projectsReady, canEdit,
    initialRows: date === initialDate ? initialRows : [], planningRoster: planningRoster || workers.map((worker) => worker.full_name).filter(Boolean), rosterSource };
  if (shared) return <SharedPlanLoader key={`${storageScope}:${date}`} date={date} storageScope={storageScope}>
    {(publication) => <PlanForDate {...props} shared={publication}
      initialRows={publication.record?.rows || props.initialRows}
      planningRoster={publication.record?.roster_names || props.planningRoster}
      rosterSource={publication.record?.roster_names ? 'published' : rosterSource} />}
  </SharedPlanLoader>;
  return <PlanForDate key={`${storageScope}:${date}`} date={date} onDateChange={setDate} storageScope={storageScope}
    workers={workers} projects={projects} projectsReady={projectsReady} canEdit={canEdit} initialRows={date === initialDate ? initialRows : []}
    planningRoster={planningRoster || workers.map((worker) => worker.full_name).filter(Boolean)} rosterSource={rosterSource} />;
}
