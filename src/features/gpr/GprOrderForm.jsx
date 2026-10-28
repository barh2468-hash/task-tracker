import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Save, X } from 'lucide-react';
import { t } from '../language/LanguageContext.jsx';
import { emptyOrder, GPR_STATUSES, parseGprEmail, REQUIREMENT_KEYS } from './model.js';

export default function GprOrderForm({ order, mode, projects, onSave, onClose }) {
  useTranslation();
  const dialogRef = useRef(null);
  const [form, setForm] = useState(() => ({ ...emptyOrder(), ...order }));
  const [stage, setStage] = useState(mode === 'email' ? 'email' : 'form');
  const [emailText, setEmailText] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const initial = useRef(JSON.stringify(form));
  const dirty =
    JSON.stringify(form) !== initial.current || Boolean(emailText) || Boolean(emailSubject);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    dialog.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = oldOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  function close() {
    if (saving) return;
    if (dirty && !window.confirm(t('gpr.discard'))) return;
    onClose();
  }
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  function toggleRequirement(key) {
    setForm((current) => ({
      ...current,
      requirements: current.requirements.some((item) => item.key === key)
        ? current.requirements.filter((item) => item.key !== key)
        : [...current.requirements, { key, done: false, detail: '' }],
    }));
  }
  function updateRequirement(key, patch) {
    setForm((current) => ({
      ...current,
      requirements: current.requirements.map((item) =>
        item.key === key ? { ...item, ...patch } : item,
      ),
    }));
  }
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (!form.title.trim() && !form.order_number.trim()) {
      setError('gpr.required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (error) {
      setError(
        error.code === '23505'
          ? 'gpr.duplicate'
          : error.code === 'PGRST116'
            ? 'gpr.conflict'
            : 'gpr.saveError',
      );
    } finally {
      setSaving(false);
    }
  }
  const fields = [
    ['title', 'name', 'text', 'nameHelp'],
    ['order_number', 'number', 'text'],
    ['client_name', 'client', 'text', 'clientHelp'],
    ['location', 'location', 'text'],
    ['contact_name', 'contact', 'text'],
    ['contact_phone', 'phone', 'tel'],
    ['contact_email', 'email', 'email'],
    ['planned_days', 'days', 'number'],
    ['scheduled_for', 'date', 'date'],
  ];
  return (
    <dialog
      ref={dialogRef}
      className="gprDialog"
      aria-labelledby="gpr-form-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className="gprDialogHeader">
        <h2 id="gpr-form-title">
          {t(stage === 'email' ? 'gpr.pasteTitle' : order?.id ? 'gpr.edit' : 'gpr.add')}
        </h2>
        <button
          type="button"
          className="ghost smallBtn"
          aria-label={t('gpr.close')}
          onClick={close}
          disabled={saving}
        >
          <X size={19} />
        </button>
      </header>
      {stage === 'email' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseGprEmail(emailText, emailSubject);
            setForm(parsed);
            setNotice(parsed.order_number ? 'gpr.review' : 'gpr.noOrder');
            setStage('form');
          }}
        >
          <div className="gprDialogBody">
            <p className="muted">{t('gpr.pasteHelp')}</p>
            <label>
              {t('gpr.emailSubject')}
              <input
                type="text"
                dir="auto"
                maxLength={1000}
                value={emailSubject}
                placeholder={t('gpr.subjectPlaceholder')}
                aria-describedby="gpr-subject-help"
                onChange={(event) => setEmailSubject(event.target.value)}
              />
            </label>
            <p className="muted" id="gpr-subject-help">
              {t('gpr.subjectHelp')}
            </p>
            <label>
              {t('gpr.emailBody')}
              <textarea
                className="gprEmailInput"
                dir="auto"
                required
                maxLength={100000}
                value={emailText}
                onChange={(event) => setEmailText(event.target.value)}
              />
            </label>
          </div>
          <footer className="gprDialogFooter">
            <button type="submit" disabled={!emailText.trim()}>
              <Mail size={16} />
              {t('gpr.extract')}
            </button>
            <button type="button" className="ghost" onClick={close}>
              {t('gpr.cancel')}
            </button>
          </footer>
        </form>
      ) : (
        <form onSubmit={submit}>
          <div className="gprDialogBody">
            {notice && (
              <p className="gprNotice" role="status">
                {t(notice)}
              </p>
            )}
            {error && (
              <p className="gprError" role="alert">
                {t(error)}
              </p>
            )}
            <fieldset disabled={saving} className="gprFields">
              <div className="formGrid">
                {fields.map(([key, label, type, hint]) => (
                  <label key={key}>
                    {t(`gpr.${label}`)}
                    <input
                      type={type}
                      value={form[key] ?? ''}
                      dir={
                        ['contact_phone', 'contact_email', 'order_number'].includes(key)
                          ? 'ltr'
                          : 'auto'
                      }
                      min={type === 'number' ? '0.5' : undefined}
                      max={type === 'number' ? '3650' : undefined}
                      step={type === 'number' ? '0.5' : undefined}
                      maxLength={
                        type === 'number' || type === 'date'
                          ? undefined
                          : key === 'title'
                            ? 300
                            : 254
                      }
                      placeholder={hint ? t(`gpr.${hint}`) : undefined}
                      onChange={(event) => set(key, event.target.value)}
                    />
                  </label>
                ))}
                <label>
                  {t('gpr.status')}
                  <select
                    value={form.status}
                    onChange={(event) => set('status', event.target.value)}
                  >
                    {GPR_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {t(`gpr.status.${status}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                {t('gpr.scope')}
                <textarea
                  dir="auto"
                  value={form.description}
                  maxLength={10000}
                  onChange={(event) => set('description', event.target.value)}
                />
              </label>
              <section className="gprRequirementEditor">
                <h3>{t('gpr.requirements')}</h3>
                {REQUIREMENT_KEYS.map((key) => {
                  const item = form.requirements.find((item) => item.key === key);
                  const name = t(`gpr.requirement.${key}`);
                  return (
                    <div key={key} className="gprRequirementEditRow">
                      <label className="gprCheck">
                        <input
                          type="checkbox"
                          checked={Boolean(item)}
                          aria-label={t('gpr.includeRequirement', { name })}
                          onChange={() => toggleRequirement(key)}
                        />
                        {name}
                      </label>
                      {item && (
                        <>
                          <label className="gprCheck gprComplete">
                            <input
                              type="checkbox"
                              checked={item.done}
                              onChange={(event) =>
                                updateRequirement(key, { done: event.target.checked })
                              }
                              aria-label={t('gpr.completeRequirement', { name })}
                            />
                            {t('gpr.status.completed')}
                          </label>
                          <input
                            className="gprRequirementDetailInput"
                            value={item.detail}
                            dir="auto"
                            maxLength={2000}
                            aria-label={t('gpr.requirementDetail', { name })}
                            onChange={(event) =>
                              updateRequirement(key, { detail: event.target.value })
                            }
                          />
                        </>
                      )}
                    </div>
                  );
                })}
              </section>
              <label>
                {t('gpr.notes')}
                <textarea
                  dir="auto"
                  value={form.notes}
                  maxLength={10000}
                  onChange={(event) => set('notes', event.target.value)}
                />
              </label>
              <label>
                {t('gpr.project')}
                <select
                  value={form.project_id || ''}
                  onChange={(event) => set('project_id', event.target.value)}
                >
                  <option value="">{t('gpr.noProject')}</option>
                  {(projects || []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">{t('gpr.projectHelp')}</p>
              {form.source_email && (
                <details className="gprOriginal">
                  <summary>{t('gpr.original')}</summary>
                  {form.source_subject && (
                    <p dir="auto">{t('gpr.originalSubject', { subject: form.source_subject })}</p>
                  )}
                  <pre dir="auto">{form.source_email}</pre>
                </details>
              )}
            </fieldset>
          </div>
          <footer className="gprDialogFooter">
            <button type="submit" disabled={saving}>
              <Save size={16} />
              {t(saving ? 'gpr.saving' : 'gpr.save')}
            </button>
            <button type="button" className="ghost" onClick={close} disabled={saving}>
              {t('gpr.cancel')}
            </button>
          </footer>
        </form>
      )}
    </dialog>
  );
}
