import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Save, Upload } from 'lucide-react';
import { t } from '../language/LanguageContext.jsx';
import { useAuth } from '../auth/useAuth.js';
import * as demoApi from './api.js';
import CaseStudies from './CaseStudies.jsx';
import { ARTICLE_SECTIONS, articleDraft } from './article.js';
import './demo.css';

const emptyData = { showcases: [], projects: [], users: [], access: [] };

function DemoManagerContent({ api = demoApi, usersRevision }) {
  useTranslation();
  const [data, setData] = useState(emptyData);
  const [projectId, setProjectId] = useState('');
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState('');
  const [noticeKey, setNoticeKey] = useState('');
  const [studyDraft, setStudyDraft] = useState(() => articleDraft());
  const [editingStudyId, setEditingStudyId] = useState(null);
  const [editingLanguage, setEditingLanguage] = useState('he');
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function reload() {
    const next = await api.loadDemoManagement();
    setData(next);
    return next;
  }
  useEffect(() => {
    let active = true;
    api
      .loadDemoManagement()
      .then((next) => {
        if (active) setData(next);
      })
      .catch(() => {
        if (active) setErrorKey('demo.setupError');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, usersRevision]);

  function chooseProject(id) {
    setProjectId(id);
    const showcase = data.showcases.find((item) => item.project_id === id);
    setDraft(
      id
        ? {
            project_id: id,
            source_project_id: showcase ? showcase.source_project_id : id,
            title: showcase?.title || data.projects.find((item) => item.id === id)?.name || '',
            summary: showcase?.summary || '',
            location: showcase?.location || '',
            is_published: showcase?.is_published || false,
          }
        : null,
    );
    setStudyDraft(articleDraft());
    setEditingStudyId(null);
    setEditingLanguage('he');
    setFile(null);
    setFileInputKey((value) => value + 1);
    setDeleteTarget(null);
    setNoticeKey('');
    setErrorKey('');
  }

  async function run(action, successKey = 'demo.saved') {
    setBusy(true);
    setErrorKey('');
    setNoticeKey('');
    try {
      await action();
      await reload();
      setNoticeKey(successKey);
    } catch (error) {
      setErrorKey(error.message === 'demo.pdfInvalid' ? 'demo.pdfInvalid' : 'demo.saveError');
    } finally {
      setBusy(false);
    }
  }

  const showcase = data.showcases.find((item) => item.project_id === projectId);
  const patch = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const editingArticle = editingLanguage === 'en' ? studyDraft.translations?.en || articleDraft() : studyDraft;
  const patchArticle = (key, value) => setStudyDraft((current) => editingLanguage === 'he'
    ? { ...current, [key]: value }
    : { ...current, translations: { ...current.translations, en: { ...current.translations?.en, [key]: value } } });

  return (
    <div className="demoManagerBody" aria-busy={busy || loading}>
      <p className="muted">{t('demo.manageHelp')}</p>
      <a className="secondary" href="/app/client-preview">{t('caseStudy.previewLibrary')}</a>
      {errorKey && <p role="alert">{t(errorKey)}</p>}
      {noticeKey && <p role="status">{t(noticeKey)}</p>}
      {loading ? (
        <p role="status">{t('demo.loading')}</p>
      ) : (
        <>
          <label>
            {t('demo.chooseProject')}
            <select
              value={projectId}
              onChange={(event) => chooseProject(event.target.value)}
              disabled={busy}
            >
              <option value="">{t('demo.chooseProjectPlaceholder')}</option>
              {data.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          {draft && (
            <>
              <form
                className="demoForm"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(() =>
                    api.saveShowcase({
                      ...draft,
                      title: draft.title.trim(),
                      summary: draft.summary.trim(),
                      location: draft.location.trim(),
                    }),
                  );
                }}
              >
                <fieldset disabled={busy}>
                  <legend>{t('demo.publicContent')}</legend>
                  <label>
                    {t('demo.title')}
                    <input
                      required
                      maxLength={200}
                      value={draft.title}
                      onChange={(event) => patch('title', event.target.value)}
                    />
                  </label>
                  <label>
                    {t('demo.location')}
                    <input
                      maxLength={300}
                      value={draft.location}
                      onChange={(event) => patch('location', event.target.value)}
                    />
                  </label>
                  <label>
                    {t('demo.summary')}
                    <textarea
                      maxLength={6000}
                      value={draft.summary}
                      onChange={(event) => patch('summary', event.target.value)}
                    />
                  </label>
                  <label className="demoCheck">
                    <input
                      type="checkbox"
                      checked={draft.is_published}
                      onChange={(event) => patch('is_published', event.target.checked)}
                    />
                    {t('demo.published')}
                  </label>
                  <button type="submit" disabled={!draft.title.trim()}>
                    <Save size={17} aria-hidden="true" />
                    {t(busy ? 'demo.saving' : 'demo.save')}
                  </button>
                </fieldset>
              </form>
              {showcase ? (
                <>
                  <fieldset className="demoAccess" disabled={busy}>
                    <legend>{t('demo.approvedUsers')}</legend>
                    <p className="muted">{t('demo.accessHelp')}</p>
                    {!data.users.length && <p>{t('demo.noUsers')}</p>}
                    {data.users.map((user) => {
                      const checked = data.access.some(
                        (item) => item.project_id === projectId && item.user_id === user.id,
                      );
                      return (
                        <label className="demoCheck" key={user.id}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const enabled = event.target.checked;
                              run(() => api.setDemoProjectAccess(user.id, projectId, enabled));
                            }}
                          />
                          <span>
                            {user.full_name}
                            <small dir="auto">{user.email}</small>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                  <CaseStudies
                    studies={showcase.demo_case_studies}
                    disabled={busy}
                    onDelete={setDeleteTarget}
                    onEdit={(study) => {
                      setEditingStudyId(study.id);
                      setStudyDraft({ ...articleDraft(study), client_name: study.client_name || '', technical_details: study.technical_details || '', translations: study.translations || {} });
                      setEditingLanguage('he');
                      setFile(null);
                      requestAnimationFrame(() => document.getElementById('case-study-editor')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
                    }}
                  />
                  {deleteTarget && (
                    <div
                      className="demoConfirm"
                      role="group"
                      aria-label={t('demo.confirmDelete', { title: deleteTarget.title })}
                    >
                      <p>{t('demo.confirmDelete', { title: deleteTarget.title })}</p>
                      <button
                        type="button"
                        disabled={busy}
                        className="danger"
                        onClick={() =>
                          run(async () => {
                            await api.deleteCaseStudy(deleteTarget.id);
                            setDeleteTarget(null);
                          })
                        }
                      >
                        {t('demo.delete')}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="secondary"
                        onClick={() => setDeleteTarget(null)}
                      >
                        {t('demo.cancel')}
                      </button>
                    </div>
                  )}
                  <form
                    className="demoForm"
                    id="case-study-editor"
                    onSubmit={(event) => {
                      event.preventDefault();
                      run(async () => {
                        if (editingStudyId) await api.saveCaseStudyArticle(editingStudyId, studyDraft);
                        else await api.uploadCaseStudy(projectId, { ...studyDraft, file });
                        setStudyDraft(articleDraft());
                        setEditingStudyId(null);
                        setEditingLanguage('he');
                        setFile(null);
                        setFileInputKey((value) => value + 1);
                      }, editingStudyId ? 'caseStudy.saved' : 'demo.uploaded');
                    }}
                  >
                    <fieldset disabled={busy}>
                      <legend>{t(editingStudyId ? 'caseStudy.edit' : 'demo.addStudy')}</legend>
                      <p className="muted">{t('caseStudy.editorHelp')}</p>
                      <label>{t('caseStudy.editingLanguage')}
                        <select value={editingLanguage} onChange={(event) => setEditingLanguage(event.target.value)}>
                          <option value="he">{t('caseStudy.hebrew')}</option><option value="en">{t('caseStudy.english')}</option>
                        </select>
                      </label>
                      <label>
                        {t('demo.studyTitle')}
                        <input
                          required
                          maxLength={200}
                          value={editingArticle.title || ''}
                          onChange={(event) => patchArticle('title', event.target.value)}
                        />
                      </label>
                      <label>
                        {t('demo.studySummary')}
                        <textarea
                          maxLength={6000}
                          value={editingArticle.summary || ''}
                          onChange={(event) => patchArticle('summary', event.target.value)}
                        />
                      </label>
                      {ARTICLE_SECTIONS.map((key) => <label key={key}>
                        {t(`caseStudy.${key}`)}
                        <textarea rows={5} maxLength={16000} value={editingArticle[key] || ''}
                          onChange={(event) => patchArticle(key, event.target.value)} />
                      </label>)}
                      <label>{t('caseStudy.client')}<input maxLength={300} value={editingArticle.client_name || ''} onChange={(event) => patchArticle('client_name', event.target.value)} /></label>
                      <label>{t('caseStudy.technical')}<textarea rows={4} maxLength={6000} value={editingArticle.technical_details || ''} onChange={(event) => patchArticle('technical_details', event.target.value)} /></label>
                      {!editingStudyId && <label>
                        {t('demo.pdfFile')}
                        <input
                          key={fileInputKey}
                          required
                          type="file"
                          accept="application/pdf,.pdf"
                          onChange={(event) => setFile(event.target.files?.[0] || null)}
                        />
                        <small className="muted">{t('demo.pdfHelp')}</small>
                      </label>}
                      <button type="submit" disabled={(!editingStudyId && !file) || !studyDraft.title.trim()}>
                        <Upload size={17} aria-hidden="true" />
                        {t(busy ? 'demo.saving' : editingStudyId ? 'caseStudy.save' : 'demo.upload')}
                      </button>
                      {editingStudyId && <button type="button" className="secondary" onClick={() => {
                        setEditingStudyId(null); setStudyDraft(articleDraft()); setFile(null);
                        setEditingLanguage('he');
                        setFileInputKey((value) => value + 1);
                      }}>{t('demo.cancel')}</button>}
                    </fieldset>
                  </form>
                </>
              ) : (
                <p className="muted">{t('demo.saveFirst')}</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function DemoManagement({ api, usersRevision }) {
  useTranslation();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  if (!isAdmin) return null;
  return (
    <section className="demoManager">
      <button
        type="button"
        className="demoManagerToggle secondary"
        aria-expanded={open}
        aria-controls="demo-manager-content"
        onClick={() => setOpen((value) => !value)}
      >
        <BookOpen size={21} aria-hidden="true" />
        {t('demo.manage')}
      </button>
      {open && (
        <div id="demo-manager-content">
          <DemoManagerContent api={api} usersRevision={usersRevision} />
        </div>
      )}
    </section>
  );
}
