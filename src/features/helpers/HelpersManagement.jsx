import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Search, UserRoundCheck, UserRoundX } from 'lucide-react';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import * as helpersApi from './api.js';
import './helpers.css';

export default function HelpersManagement({ api = helpersApi }) {
  useTranslation();
  const { language } = useLanguage();
  const [helpers, setHelpers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try { setHelpers(await api.listHelpers()); }
    catch { setLoadFailed(true); }
    finally { setLoading(false); }
  }, [api]);
  useEffect(() => { void reload(); }, [reload]);

  const visible = useMemo(() => helpers.filter((helper) =>
    (showInactive || helper.is_active) && helper.name.toLocaleLowerCase(localeForLanguage(language)).includes(query.trim().toLocaleLowerCase(localeForLanguage(language))))
    .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name, localeForLanguage(language))),
  [helpers, query, showInactive, language]);

  function openEditor(helper = {}) {
    setEditing(helper);
    setName(helper.name || '');
    setError('');
    setNotice(null);
    setStatusTarget(null);
  }
  async function mutate(id, changes, successKey) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice(null);
    try {
      const saved = await api.saveHelper(id, changes);
      setHelpers((current) => id ? current.map((row) => row.id === saved.id ? saved : row) : [...current, saved]);
      setNotice({ key: successKey, name: saved.name });
      setEditing(null);
      setStatusTarget(null);
      setName('');
    } catch (err) { setError(err.code === '23505' ? 'helpers.duplicate' : 'helpers.saveError'); }
    finally { setBusy(false); }
  }
  function submit(event) {
    event.preventDefault();
    if (!name.trim() || name.trim().length > 120) { setError('helpers.invalidName'); return; }
    void mutate(editing.id, { name }, editing.id ? 'helpers.renamed' : 'helpers.created');
  }

  return <section className="helpersManagement" aria-label={t('helpers.title')}>
    <header className="helpersHeading"><div><h2>{t('helpers.title')}</h2><p>{t('helpers.description')}</p></div>
      <button type="button" disabled={busy || loading || loadFailed} onClick={() => openEditor()}><Plus size={18} aria-hidden="true" />{t('helpers.add')}</button>
    </header>
    <div className="helpersToolbar">
      <label className="helpersSearch"><Search size={18} aria-hidden="true" /><span className="visuallyHidden">{t('helpers.search')}</span>
        <input type="search" value={query} placeholder={t('helpers.search')} onChange={(event) => setQuery(event.target.value)} /></label>
      <label className="helpersInactive"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />{t('helpers.showInactive')}</label>
      {!loading && !loadFailed && <span className="muted">{t('helpers.activeCount', { count: helpers.filter((row) => row.is_active).length.toLocaleString(localeForLanguage(language)) })}</span>}
    </div>
    {editing && <form className="helpersEditor" onSubmit={submit}>
      <h3>{t(editing.id ? 'helpers.edit' : 'helpers.add')}</h3>
      <label><span>{t('helpers.name')}</span><input type="text" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required disabled={busy} dir="auto" /></label>
      <p className="muted">{t('helpers.history')}</p>
      <div className="helpersActions"><button type="button" className="ghost" disabled={busy} onClick={() => { setEditing(null); setError(''); }}>{t('helpers.cancel')}</button>
        <button type="submit" disabled={busy || !name.trim()}>{t(busy ? 'helpers.saving' : 'helpers.save')}</button></div>
    </form>}
    {error && <p className="helpersError" role="alert">{t(error)}</p>}
    {notice && <p className="helpersNotice" role="status">{t(notice.key, { name: notice.name })}</p>}
    {loading ? <p role="status">{t('helpers.loading')}</p> : loadFailed ? <div role="alert"><p>{t('helpers.loadError')}</p><button type="button" onClick={reload}>{t('helpers.retry')}</button></div>
      : !visible.length ? <p className="helpersEmpty">{t(query || showInactive ? 'helpers.noMatches' : 'helpers.noActive')}</p>
        : <ul className="helpersList">{visible.map((helper) => <li key={helper.id} className={helper.is_active ? '' : 'helperInactive'}>
          <div className="helperIdentity"><bdi>{helper.name}</bdi><span className="helperBadge">{t(helper.is_active ? 'helpers.active' : 'helpers.inactive')}</span></div>
          <div className="helpersActions">
            <button type="button" className="ghost" disabled={busy || Boolean(editing)} aria-label={t('helpers.editLabel', { name: helper.name })} onClick={() => openEditor(helper)}><Pencil size={16} aria-hidden="true" />{t('helpers.edit')}</button>
            <button type="button" className="ghost" disabled={busy || Boolean(editing)} aria-label={t(helper.is_active ? 'helpers.deactivateLabel' : 'helpers.activateLabel', { name: helper.name })}
              onClick={() => { setStatusTarget(helper); setError(''); setNotice(null); }}>
              {helper.is_active ? <UserRoundX size={16} aria-hidden="true" /> : <UserRoundCheck size={16} aria-hidden="true" />}{t(helper.is_active ? 'helpers.deactivate' : 'helpers.activate')}</button>
          </div>
          {statusTarget?.id === helper.id && <div className="helperStatusConfirmation" role="group" aria-label={t('helpers.confirmStatus')}>
            <p>{t(helper.is_active ? 'helpers.deactivatePrompt' : 'helpers.activatePrompt', { name: helper.name })}</p>
            <div className="helpersActions"><button type="button" className="ghost" disabled={busy} onClick={() => setStatusTarget(null)}>{t('helpers.cancel')}</button>
              <button type="button" disabled={busy} onClick={() => void mutate(helper.id, { is_active: !helper.is_active }, helper.is_active ? 'helpers.deactivated' : 'helpers.activated')}>{t(busy ? 'helpers.saving' : 'helpers.confirm')}</button></div>
          </div>}
        </li>)}</ul>}
  </section>;
}
