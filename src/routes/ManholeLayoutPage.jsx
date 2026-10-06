import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, Eye, FileDown, FolderKanban, Layers, Pencil, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useAuth } from '../features/auth/useAuth.js';
import { t } from '../features/language/LanguageContext.jsx';
import { useProjects } from '../features/projects/ProjectsContext.jsx';
import { getSheetProjectOptions } from '../features/manhole-layout/projectOptions.js';
import sheetHtml from '../features/manhole-layout/maya-sheets.html?raw';
import editorStyles from '../features/manhole-layout/editor.css?raw';
import { readSheetValues, saveSheetValue } from '../features/manhole-layout/draftStorage.js';
import SavedLayoutsPanel from '../features/manhole-layout/SavedLayoutsPanel.jsx';
import EmailLayoutsDialog from '../features/manhole-layout/EmailLayoutsDialog.jsx';
import DeleteLayoutDialog from '../features/manhole-layout/DeleteLayoutDialog.jsx';
import * as sheetApi from '../services/api/manholeLayouts.js';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh.js';
import '../features/manhole-layout/manhole-layout.css';

const styledSheetHtml = sheetHtml
  .replace('<html lang="he" dir="rtl">', '<html lang="he" dir="rtl" data-theme="light">')
  .replace('<div class="wrap"', `<style>${editorStyles}</style><div class="wrap"`);

export default function ManholeLayoutPage() {
  useTranslation();
  const { session, profile, isManager } = useAuth();
  const { projects, projectsLoaded } = useProjects();
  const frameRef = useRef(null);
  const previewDialogRef = useRef(null);
  const previewCloseRef = useRef(null);
  const [storageFailed, setStorageFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewZoomed, setPreviewZoomed] = useState(false);
  const [previewMode, setPreviewMode] = useState('editor');
  const [mobileEditing, setMobileEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('editor');
  const [layouts, setLayouts] = useState([]);
  const [layoutsLoading, setLayoutsLoading] = useState(true);
  const [layoutsError, setLayoutsError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [editingLayout, setEditingLayout] = useState(null);
  const [emailRows, setEmailRows] = useState(null);
  const [deleteRow, setDeleteRow] = useState(null);
  const [layoutsStatus, setLayoutsStatus] = useState('');
  const saveInProgressRef = useRef(false);
  const savedSnapshotRef = useRef(null);
  const layoutsRequestRef = useRef(0);
  const userId = session?.user?.id;
  const projectOptions = useMemo(
    () => getSheetProjectOptions(projects, userId, profile?.role),
    [projects, userId, profile?.role],
  );

  const loadLayouts = useCallback(async () => {
    const request = ++layoutsRequestRef.current;
    setLayoutsLoading(true);
    setLayoutsError('');
    try {
      const rows = userId ? await sheetApi.listLayouts() : [];
      if (request === layoutsRequestRef.current) {
        setLayouts(rows);
        if (savedSnapshotRef.current && !rows.some(row => row.id === savedSnapshotRef.current.row.id)) {
          savedSnapshotRef.current = null; setEditingLayout(null);
        }
      }
    } catch {
      if (request === layoutsRequestRef.current) setLayoutsError(t('לא ניתן לטעון את הפרישות השמורות. בדקו את החיבור ונסו שוב.'));
    } finally {
      if (request === layoutsRequestRef.current) setLayoutsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    savedSnapshotRef.current = null; setEditingLayout(null); setLayouts([]); setDeleteRow(null); setLayoutsStatus('');
    loadLayouts();
  }, [loadLayouts]);
  useRealtimeRefresh({ enabled: Boolean(userId), channelName: 'manhole-layouts', tables: ['project_manhole_layouts'], onRefresh: loadLayouts });

  const publishLayout = useCallback(async (data, frameWindow) => {
    if (saveInProgressRef.current) {
      frameWindow.postMessage({ type: 'maya-sheets-published', requestId: data.requestId, ok: false, error: t('שמירה כבר מתבצעת. נסו שוב לאחר סיומה.') }, '*');
      return;
    }
    saveInProgressRef.current = true;
    setActionBusy(true); setLayoutsStatus('');
    try {
      if (!projectOptions.some(project => project.id === data.source?.draft?.projectId)) throw new Error(t('יש לבחור פרויקט פעיל מהרשימה שלכם.'));
      const sourceJson = JSON.stringify(data.source);
      const previous = savedSnapshotRef.current;
      const row = previous?.sourceJson === sourceJson ? previous.row : await sheetApi.saveLayout({
        source: data.source, pdf: data.pdf, preview: data.preview, fileName: data.fileName,
        userId, id: crypto.randomUUID(),
        revisionOf: previous?.row.project_id === data.source.draft.projectId && previous.row.manhole_number === data.source.draft.num.trim() ? previous.row.id : null,
      });
      if (frameRef.current?.contentWindow !== frameWindow) return;
      savedSnapshotRef.current = { sourceJson, row };
      setEditingLayout(row);
      layoutsRequestRef.current++; setLayoutsLoading(false);
      setLayouts(rows => [row, ...rows.filter(item => item.id !== row.id)]);
      frameWindow.postMessage({ type: 'maya-sheets-published', requestId: data.requestId, ok: true }, '*');
    } catch (error) {
      frameWindow.postMessage({ type: 'maya-sheets-published', requestId: data.requestId, ok: false, error: error.message || t('שמירת הפרישה נכשלה. הטיוטה נשארה בטופס.') }, '*');
    } finally { saveInProgressRef.current = false; setActionBusy(false); }
  }, [userId, projectOptions]);

  async function savedLayoutAction(row, action) {
    setActionBusy(true); setLayoutsError('');
    try {
      if (action === 'edit') {
        const source = await sheetApi.loadLayoutSource(row);
        savedSnapshotRef.current = { sourceJson: JSON.stringify(source), row };
        setEditingLayout(row); setActiveTab('editor');
        frameRef.current?.contentWindow?.postMessage({ type: 'maya-sheets-load', source, projects: projectOptions, projectsLoaded, defaultLeader: profile?.full_name || '' }, '*');
      } else if (action === 'view') {
        const [image, pdfUrl] = await Promise.all([sheetApi.layoutUrl(row, 'preview'), sheetApi.layoutUrl(row)]);
        setPreviewMode('saved'); setPreview({ image, pdfUrl, fileName: row.file_name }); setPreviewZoomed(false); setPreviewOpen(true);
      } else {
        const link = document.createElement('a');
        link.href = await sheetApi.layoutUrl(row, 'pdf', true); link.download = row.file_name;
        document.body.appendChild(link); link.click(); link.remove();
      }
    } catch (error) { setLayoutsError(error.message || t('לא ניתן לפתוח את הפרישה. נסו שוב.')); }
    finally { setActionBusy(false); }
  }

  async function deleteSavedLayout(row) {
    setActionBusy(true); setLayoutsError(''); setLayoutsStatus('');
    try {
      await sheetApi.deleteLayout(row);
      layoutsRequestRef.current++; setLayoutsLoading(false);
      setLayouts(rows => rows.filter(item => item.id !== row.id));
      if (savedSnapshotRef.current?.row.id === row.id) { savedSnapshotRef.current = null; setEditingLayout(null); }
      setDeleteRow(null); setLayoutsStatus(t('הפרישה נמחקה מהפרישות השמורות.'));
    } finally { setActionBusy(false); }
  }

  function initializeFrame() {
    let values = {};
    try { values = readSheetValues(window.localStorage, userId); } catch { setStorageFailed(true); }
    // An opaque sandbox has no addressable origin. The Window reference limits the recipient.
    frameRef.current?.contentWindow?.postMessage({
      type: 'maya-sheets-init', values, projects: projectOptions, projectsLoaded,
      defaultLeader: profile?.full_name || '',
      previewActive: previewOpen && previewMode === 'editor',
    }, '*');
  }

  useEffect(() => {
    if (activeTab !== 'editor') return;
    const frame = frameRef.current;
    const viewport = window.visualViewport;
    let raf = 0;
    let previous = '';
    let editing = false;
    function updateViewport() {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        if (!frame || !window.matchMedia('(max-width:759px)').matches) return;
        const viewportTop = viewport?.offsetTop || 0;
        let viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
        const navigation = document.querySelector('.mobileBottomNav')?.getBoundingClientRect();
        if (!editing && navigation?.height > 0 && navigation.top >= viewportTop) viewportBottom = Math.min(viewportBottom, navigation.top);
        frame.style.setProperty('--mobile-editor-top', `${viewportTop}px`);
        frame.style.setProperty('--mobile-editor-height', `${Math.max(1, viewportBottom - viewportTop)}px`);
        const bounds = frame.getBoundingClientRect();
        const top = Math.max(0, viewportTop - bounds.top);
        const height = Math.max(0, Math.min(bounds.bottom, viewportBottom) - Math.max(bounds.top, viewportTop));
        if (height < 1) return;
        const next = JSON.stringify([Math.round(top), Math.round(height)]);
        if (next === previous) return;
        previous = next;
        frame.contentWindow?.postMessage({ type: 'maya-sheets-viewport', top, height }, '*');
      });
    }
    function editorReady(event) {
      if (event.source !== frame?.contentWindow || event.origin !== 'null' || event.data?.type !== 'maya-sheets-editor-focus') return;
      const nextEditing = event.data.editing === true;
      if (nextEditing && !editing) frame.parentElement.style.setProperty('--editor-placeholder-height', `${frame.getBoundingClientRect().height}px`);
      editing = nextEditing;
      setMobileEditing(editing);
      previous = '';
      updateViewport();
    }
    window.addEventListener('message', editorReady);
    window.addEventListener('resize', updateViewport);
    window.addEventListener('scroll', updateViewport, { passive: true });
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    updateViewport();
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('message', editorReady);
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('scroll', updateViewport);
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
    };
  }, [activeTab, userId]);

  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({
      type: 'maya-sheets-projects', projects: projectOptions, projectsLoaded,
      defaultLeader: profile?.full_name || '',
    }, '*');
  }, [projectOptions, projectsLoaded, profile?.full_name]);

  useEffect(() => {
    function receiveMessage(event) {
      if (event.source !== frameRef.current?.contentWindow || event.origin !== 'null') return;
      if (event.data?.type === 'maya-sheets-save') {
        try {
          setStorageFailed(!saveSheetValue(window.localStorage, userId, event.data.key, event.data.value));
        } catch { setStorageFailed(true); }
      }
      if (event.data?.type === 'maya-sheets-preview' &&
          previewMode === 'editor' &&
          typeof event.data.image === 'string' && event.data.image.startsWith('data:image/png;base64,') &&
          typeof event.data.fileName === 'string') {
        setPreview({ image: event.data.image, fileName: event.data.fileName });
      }
      if (event.data?.type === 'maya-sheets-publish' && typeof event.data.requestId === 'string') void publishLayout(event.data, event.source);
      if (event.data?.type === 'maya-sheets-new') { savedSnapshotRef.current = null; setEditingLayout(null); }
      if (event.data?.type === 'maya-sheets-open-preview') { setPreviewMode('editor'); setPreview(null); setPreviewZoomed(false); setPreviewOpen(true); }
    }
    window.addEventListener('message', receiveMessage);
    return () => window.removeEventListener('message', receiveMessage);
  }, [userId, previewMode, publishLayout]);

  useEffect(() => {
    const dialog = previewDialogRef.current;
    const frameWindow = frameRef.current?.contentWindow;
    frameWindow?.postMessage({ type: 'maya-sheets-preview', active: previewOpen && previewMode === 'editor' }, '*');
    if (!previewOpen) return;
    dialog.showModal();
    previewCloseRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      frameWindow?.postMessage({ type: 'maya-sheets-preview', active: false }, '*');
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [previewOpen, previewMode]);

  return (
    <section className="manholeLayoutPage" aria-labelledby="manhole-layout-title" data-mobile-editing={mobileEditing || undefined}>
      <header className="manholeLayoutHeader">
        <div className="manholeLayoutHeading">
          <span className="manholeLayoutIcon"><Layers size={27} aria-hidden="true" /></span>
          <div>
            <h2 id="manhole-layout-title">{t('פרישת שוחות')}</h2>
            <p>{t('מילוי פרטי שוחה, פרישת דפנות וקנים, צירוף תמונות והפקת PDF.')}</p>
          </div>
        </div>
        <div className="manholeLayoutBadges">
          <span><FolderKanban size={15} aria-hidden="true" />{t(isManager ? 'כל הפרויקטים' : 'הפרויקטים שלי')} · {projectsLoaded ? projectOptions.length : t('טוען...')}</span>
          <span><FileDown size={15} aria-hidden="true" />PDF</span>
        </div>
      </header>
      <div className="manholeLayoutTabs" role="group" aria-label={t('תצוגת פרישות שוחות')}>
        <button type="button" aria-pressed={activeTab === 'editor'} onClick={() => setActiveTab('editor')}><Pencil size={17} aria-hidden="true" />{t('מילוי פרישה')}</button>
        <button type="button" aria-pressed={activeTab === 'saved'} onClick={() => setActiveTab('saved')}><Archive size={17} aria-hidden="true" />{t('פרישות שמורות')} <span>{layouts.length}</span></button>
      </div>
      {activeTab === 'saved' && <>
        {layoutsStatus && <p className="manholeEmailSuccess" role="status">{layoutsStatus}</p>}
        <SavedLayoutsPanel rows={layouts} loading={layoutsLoading} error={layoutsError} busy={actionBusy} editableProjectIds={projectOptions.map(project => project.id)} userId={userId} isManager={isManager} onRefresh={loadLayouts} onEdit={row => savedLayoutAction(row, 'edit')} onView={row => savedLayoutAction(row, 'view')} onDownload={row => savedLayoutAction(row, 'download')} onEmail={setEmailRows} onDelete={row => { setLayoutsStatus(''); setDeleteRow(row); }} />
      </>}
      <div className="manholeEditorPanel" hidden={activeTab !== 'editor'}>
      {editingLayout && <p className="manholeEditingNotice">{t('עריכת פרישה שמורה')}: {editingLayout.project_name} · {t('שוחה')} {editingLayout.manhole_number}. {t('שמירה יוצרת גרסה נוספת.')}</p>}
      <div className="manholeLayoutNotice">
        <small>{t('הטיוטה נשמרת במכשיר זה למשתמש המחובר. תמונות יש לצרף מחדש אחרי יציאה מהמסך.')}</small>
        {storageFailed && <p role="status">{t('לא ניתן לשמור את הטיוטה במכשיר. אפשר להמשיך ולהוריד PDF לפני יציאה מהמסך.')}</p>}
      </div>
      <iframe
        key={userId}
        ref={frameRef}
        className="manholeLayoutFrame"
        title={t('מחולל דפי שוחה')}
        srcDoc={styledSheetHtml}
        onLoad={initializeFrame}
        sandbox="allow-scripts allow-forms allow-downloads"
      />
      </div>
      {activeTab === 'editor' &&
      <button
        type="button"
        className="manholePreviewShortcut"
        aria-haspopup="dialog"
        aria-controls="manhole-preview-dialog"
        onClick={() => { setPreviewMode('editor'); setPreview(null); setPreviewZoomed(false); setPreviewOpen(true); }}
      >
        <Eye size={19} aria-hidden="true" />{t('תצוגה מקדימה של PDF')}
      </button>}
      <dialog
        id="manhole-preview-dialog"
        ref={previewDialogRef}
        className="manholePreviewDialog"
        aria-labelledby="manhole-preview-title"
        aria-describedby="manhole-preview-description"
        onCancel={(event) => { event.preventDefault(); setPreviewOpen(false); }}
      >
        <header className="manholePreviewHeader">
          <div>
            <h2 id="manhole-preview-title">{t('תצוגה מקדימה של PDF')}</h2>
            <p id="manhole-preview-description">{t(previewMode === 'editor' ? 'דף השוחה מתעדכן לפי הנתונים שמילאתם.' : 'דף השוחה השמור. קובץ ה־PDF המלא כולל גם את התמונות.')}</p>
          </div>
          <button ref={previewCloseRef} type="button" className="manholePreviewClose" aria-label={t('סגירת תצוגה מקדימה')} onClick={() => setPreviewOpen(false)}>
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        {preview ? (
          <>
            <div className="manholePreviewToolbar">
              <span>{preview.fileName}</span>
              <button type="button" aria-pressed={previewZoomed} onClick={() => setPreviewZoomed((zoomed) => !zoomed)}>
                {previewZoomed ? <ZoomOut size={17} aria-hidden="true" /> : <ZoomIn size={17} aria-hidden="true" />}
                {t(previewZoomed ? 'התאמה למסך' : 'הגדלה')}
              </button>
            </div>
            <div className={`manholePreviewSheet${previewZoomed ? ' isZoomed' : ''}`}>
              <img src={preview.image} alt={t('תצוגה מקדימה של דף השוחה')} />
            </div>
          </>
        ) : <p className="manholePreviewLoading" role="status">{t('טוען תצוגה מקדימה...')}</p>}
        <footer className="manholePreviewFooter">
          {preview?.pdfUrl && <a href={preview.pdfUrl} target="_blank" rel="noopener noreferrer">{t('פתיחת PDF מלא')}</a>}
          <button type="button" onClick={() => setPreviewOpen(false)}>{t(previewMode === 'editor' ? 'חזרה לעריכה' : 'חזרה לרשימה')}</button>
        </footer>
      </dialog>
      {emailRows && <EmailLayoutsDialog rows={emailRows} onSend={sheetApi.emailLayouts} onClose={() => setEmailRows(null)} />}
      {deleteRow && <DeleteLayoutDialog row={deleteRow} onDelete={deleteSavedLayout} onClose={() => setDeleteRow(null)} />}
    </section>
  );
}
