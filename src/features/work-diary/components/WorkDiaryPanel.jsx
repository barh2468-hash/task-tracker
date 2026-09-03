import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileSignature, PenLine, PlusCircle, Trash2, X } from 'lucide-react';
import {
  getWorkDiariesForProject,
  insertWorkDiary,
  deleteWorkDiary,
} from '../../../services/api/workDiaries.js';
import { getCurrentUser } from '../../../services/api/auth.js';
import { useRealtimeRefresh } from '../../../hooks/useRealtimeRefresh.js';
import { exportWorkDiaryPdf } from '../utils/exportWorkDiaryPdf.js';
import { workKinds, leakKinds } from '../utils/helpers.js';
import SignaturePad from './SignaturePad.jsx';

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDiary(project, teamLeadName) {
  return {
    work_date: todayValue(),
    contact_name: '',
    contact_phone: project.contact_phone || '',
    start_time: '',
    end_time: '',
    site: project.location,
    role: '',
    infrastructure_type: '',
    color_marking: false,
    sketch_marking: false,
    autocad_mapping: false,
    excavation_escort: false,
    cable_fault: false,
    suction_small: false,
    suction_large: false,
    gpr_usage: false,
    work_day: '',
    area_sqm: '',
    infrastructure_length: '',
    units_to_meter: '',
    units_over_meter: '',
    units_depth: '',
    leak_detection: false,
    point_leak: false,
    depreciation_survey: false,
    leak_notes: '',
    additional_services: '',
    maya_equipment: '',
    customer_equipment: '',
    equipment_name: '',
    existing_map_marking: '',
    miscellaneous: '',
    customer_name: '',
    customer_phone: project.contact_phone || '',
    team_lead_name: teamLeadName,
    team_lead_phone: '',
    additional_notes: '',
  };
}

export default function WorkDiaryPanel({ project, currentUserName, canDelete }) {
  useTranslation();
  const [diaries, setDiaries] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(() => emptyDiary(project, currentUserName));
  const [customerSignature, setCustomerSignature] = useState('');
  const [teamLeadSignature, setTeamLeadSignature] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [message, setMessage] = useState('');

  async function loadDiaries() {
    setLoading(true);
    const { data, error } = await getWorkDiariesForProject(project.id);
    if (error) {
      console.warn('Work diaries load failed:', error.message);
      setMessage(t('יומני העבודה עדיין לא הופעלו במסד הנתונים.'));
      setDiaries([]);
    } else {
      setMessage('');
      setDiaries(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadDiaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  useRealtimeRefresh({
    enabled: Boolean(project.id),
    channelName: `work-diaries-${project.id}`,
    tables: ['work_diaries'],
    onRefresh: loadDiaries,
    pollIntervalMs: 30000,
  });

  useEffect(() => {
    if (!formOpen) return;
    const previous = {
      overflow: document.body.style.overflow,
      htmlOverflow: document.documentElement.style.overflow,
      overscrollBehavior: document.body.style.overscrollBehavior,
    };
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous.overflow;
      document.body.style.overscrollBehavior = previous.overscrollBehavior;
      document.documentElement.style.overflow = previous.htmlOverflow;
    };
  }, [formOpen]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openNewDiary() {
    setForm(emptyDiary(project, currentUserName));
    setCustomerSignature('');
    setTeamLeadSignature('');
    setMessage('');
    setFormOpen(true);
  }

  async function saveDiary() {
    if (!form.work_date || !form.contact_name || !form.start_time || !form.end_time) {
      setMessage(t('יש למלא תאריך, איש קשר ושעות התחלה וסיום.'));
      return;
    }
    if (!form.customer_name || !form.team_lead_name) {
      setMessage(t('יש למלא את שמות נציג הלקוח וראש צוות מאיה.'));
      return;
    }
    if (!customerSignature || !teamLeadSignature) {
      setMessage(t('חובה להשלים את שתי החתימות לפני שמירת היומן.'));
      return;
    }
    const user = await getCurrentUser();
    if (!user) return;
    setSaving(true);
    const { data, error } = await insertWorkDiary({
      project_id: project.id,
      created_by: user.id,
      form_data: form,
      customer_signature: customerSignature,
      team_lead_signature: teamLeadSignature,
    });
    setSaving(false);
    if (error) {
      setMessage(t('שמירת היומן נכשלה: {{value0}}', { value0: error.message }));
      return;
    }
    setDiaries((current) => [data, ...current]);
    setFormOpen(false);
    setMessage(t('יומן עבודה מספר {{value0}} נשמר ונחתם.', { value0: data.diary_number }));
  }

  async function deleteDiary(diary) {
    if (!canDelete || deletingId) return;
    const confirmed = window.confirm(
      `למחוק את יומן העבודה ${diary.diary_number}? היומן והאפשרות להפיק ממנו PDF יימחקו לצמיתות.`,
    );
    if (!confirmed) return;

    setDeletingId(diary.id);
    setMessage('');
    const { error } = await deleteWorkDiary(diary.id, project.id);
    setDeletingId('');

    if (error) {
      setMessage(t('מחיקת יומן העבודה נכשלה: {{value0}}', { value0: error.message }));
      return;
    }

    setDiaries((current) => current.filter((item) => item.id !== diary.id));
    setMessage(t('יומן עבודה מספר {{value0}} וה-PDF שלו נמחקו.', { value0: diary.diary_number }));
  }

  return (
    <section className="workDiaryPanel">
      <header className="workDiaryPanelHeader">
        <div>
          <span className="workDiaryEyebrow">{t('יומן עבודה דיגיטלי')}</span>
          <h3>
            <FileSignature size={20} />
            {t('יומני עבודה חתומים')}
          </h3>
          <p>{t('מילוי בשטח, חתימת מזמין העבודה וראש צוות מאיה והפקת PDF.')}</p>
        </div>
        <button
          type="button"
          className="smallBtn workDiaryAdd"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openNewDiary();
          }}
        >
          <PlusCircle size={17} />
          {t('יומן עבודה חדש')}
        </button>
      </header>

      {message && <div className="workDiaryMessage">{message}</div>}
      {loading ? (
        <div className="muted">{t('טוען יומני עבודה...')}</div>
      ) : diaries.length ? (
        <div className="workDiaryList">
          {diaries.map((diary) => (
            <article className="workDiaryRow" key={diary.id}>
              <div className="workDiaryNumber">#{diary.diary_number}</div>
              <div>
                <b>
                  {t('יומן עבודה')}
                  {diary.diary_number}
                </b>
                <span>
                  {new Date(diary.form_data.work_date).toLocaleDateString('he-IL')} ·{' '}
                  {diary.form_data.customer_name}
                  {t('· נחתם על ידי')}
                  {diary.profiles?.full_name || t('משתמש')}
                </span>
              </div>
              <div className="workDiaryRowActions">
                <button
                  type="button"
                  className="ghost tinyBtn"
                  onClick={() => exportWorkDiaryPdf(project, diary)}
                >
                  <Download size={15} /> PDF
                </button>
                {canDelete && (
                  <button
                    type="button"
                    className="ghost tinyBtn dangerBtn"
                    disabled={deletingId === diary.id}
                    onClick={() => deleteDiary(diary)}
                  >
                    <Trash2 size={15} /> {deletingId === diary.id ? t('מוחק...') : t('מחיקת PDF')}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="workDiaryEmpty">{t('עדיין לא נוצר יומן עבודה לפרויקט זה.')}</div>
      )}

      {formOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close is a mouse convenience; the close button covers keyboard access
          <div
            className="modalBackdrop workDiaryBackdrop"
            role="dialog"
            aria-modal="true"
            onClick={() => setFormOpen(false)}
          >
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- stops the backdrop's close handler from firing for clicks inside the modal */}
            <div className="workDiaryModal" onClick={(event) => event.stopPropagation()}>
              <header className="workDiaryModalHeader">
                <div>
                  <span>{t('קבוצת מאיה')}</span>
                  <h2>{t('יומן עבודה חדש')}</h2>
                  <p>
                    {project.name}
                    {t('· המספר יינתן אוטומטית בשמירה')}
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost iconBtn"
                  aria-label={t('סגירה')}
                  onClick={() => setFormOpen(false)}
                >
                  <X size={19} />
                </button>
              </header>

              <div className="workDiaryForm">
                <DiarySection title={t('פרטי היומן והפרויקט')}>
                  <div className="workDiaryGrid three">
                    <DiaryInput
                      label={t('תאריך')}
                      type="date"
                      required
                      value={form.work_date}
                      onChange={(value) => update('work_date', value)}
                    />

                    <DiaryInput label={t('שם הפרויקט')} value={project.name} readOnly />
                    <DiaryInput label={t('שם המזמין')} value={project.client_name || ''} readOnly />
                    <DiaryInput
                      label={t('איש הקשר')}
                      required
                      value={form.contact_name}
                      onChange={(value) => update('contact_name', value)}
                    />

                    <DiaryInput
                      label={t('טלפון נייד')}
                      type="tel"
                      value={form.contact_phone}
                      onChange={(value) => update('contact_phone', value)}
                    />

                    <DiaryInput
                      label={t('שעה')}
                      type="time"
                      required
                      value={form.start_time}
                      onChange={(value) => update('start_time', value)}
                    />

                    <DiaryInput
                      label={t('עד שעה')}
                      type="time"
                      required
                      value={form.end_time}
                      onChange={(value) => update('end_time', value)}
                    />

                    <DiaryInput
                      label={t('אתר')}
                      value={form.site}
                      onChange={(value) => update('site', value)}
                    />

                    <DiaryInput
                      label={t('תפקיד')}
                      value={form.role}
                      onChange={(value) => update('role', value)}
                    />
                  </div>
                </DiarySection>

                <DiarySection title={t('איתור תשתיות תת-קרקעיות / שאיבת עפר / ביקון / מכשיר GPR')}>
                  <div className="workDiaryGrid two">
                    <div className="workDiaryChecks">
                      {workKinds.map((kind) => (
                        <label className="workDiaryCheck" key={kind.key}>
                          <input
                            type="checkbox"
                            checked={Boolean(form[kind.key])}
                            onChange={(event) => update(kind.key, event.target.checked)}
                          />

                          <span>{t(kind.label)}</span>
                        </label>
                      ))}
                    </div>
                    <div className="workDiaryGrid two compact">
                      <DiaryInput
                        label={t('סוג התשתית')}
                        value={form.infrastructure_type}
                        onChange={(value) => update('infrastructure_type', value)}
                      />

                      <DiaryInput
                        label={t('עבודה לפי יום עבודה')}
                        value={form.work_day}
                        onChange={(value) => update('work_day', value)}
                      />

                      <DiaryInput
                        label={t('עבודה לפי מ״ר - גודל שטח')}
                        value={form.area_sqm}
                        onChange={(value) => update('area_sqm', value)}
                      />

                      <DiaryInput
                        label={t('עבודה לפי מ׳ אורך - אורך תשתית')}
                        value={form.infrastructure_length}
                        onChange={(value) => update('infrastructure_length', value)}
                      />

                      <DiaryInput
                        label={t('כמות יחידות עד מטר')}
                        value={form.units_to_meter}
                        onChange={(value) => update('units_to_meter', value)}
                      />

                      <DiaryInput
                        label={t('כמות יחידות מעל מטר')}
                        value={form.units_over_meter}
                        onChange={(value) => update('units_over_meter', value)}
                      />

                      <DiaryInput
                        label={t('עומק')}
                        value={form.units_depth}
                        onChange={(value) => update('units_depth', value)}
                      />
                    </div>
                  </div>
                </DiarySection>

                <DiarySection title={t('איתור דלף')}>
                  <div className="leakDiaryFields">
                    <div className="workDiaryChecks leakChecks">
                      {leakKinds.map((kind) => (
                        <label className="workDiaryCheck" key={kind.key}>
                          <input
                            type="checkbox"
                            checked={Boolean(form[kind.key])}
                            onChange={(event) => update(kind.key, event.target.checked)}
                          />

                          <span>{t(kind.label)}</span>
                        </label>
                      ))}
                    </div>
                    <DiaryTextarea
                      label={t('הערות כלליות לאיתור דלף')}
                      value={form.leak_notes}
                      onChange={(value) => update('leak_notes', value)}
                    />
                  </div>
                </DiarySection>

                <DiarySection title={t('שירותים נוספים')}>
                  <div className="workDiaryGrid two">
                    <DiaryTextarea
                      label={t('שירותים נוספים - הערות')}
                      value={form.additional_services}
                      onChange={(value) => update('additional_services', value)}
                    />

                    <DiaryInput
                      label={t('מודד מטעם חברת מאיה')}
                      value={form.maya_equipment}
                      onChange={(value) => update('maya_equipment', value)}
                    />

                    <DiaryInput
                      label={t('מודד מטעם מזמין העבודה')}
                      value={form.customer_equipment}
                      onChange={(value) => update('customer_equipment', value)}
                    />

                    <DiaryInput
                      label={t('שם המודד')}
                      value={form.equipment_name}
                      onChange={(value) => update('equipment_name', value)}
                    />

                    <DiaryInput
                      label={t('סימון סקיצה על גבי מפה קיימת (לצרף צילום סקיצה)')}
                      value={form.existing_map_marking}
                      onChange={(value) => update('existing_map_marking', value)}
                    />

                    <DiaryInput
                      label={t('שונות')}
                      value={form.miscellaneous}
                      onChange={(value) => update('miscellaneous', value)}
                    />
                  </div>
                </DiarySection>

                <DiarySection title={t('חתימות חובה')}>
                  <div className="signatureColumns">
                    <div className="signerCard">
                      <h4>{t('נציג הלקוח')}</h4>
                      <DiaryInput
                        label={t('שם פרטי ושם משפחה')}
                        required
                        value={form.customer_name}
                        onChange={(value) => update('customer_name', value)}
                      />

                      <DiaryInput
                        label={t('טלפון')}
                        type="tel"
                        value={form.customer_phone}
                        onChange={(value) => update('customer_phone', value)}
                      />

                      <SignaturePad label={t('חתימת נציג הלקוח')} onChange={setCustomerSignature} />
                    </div>
                    <div className="signerCard">
                      <h4>{t('ראש צוות מאיה')}</h4>
                      <DiaryInput
                        label={t('שם פרטי ושם משפחה')}
                        required
                        value={form.team_lead_name}
                        onChange={(value) => update('team_lead_name', value)}
                      />

                      <DiaryInput
                        label={t('טלפון')}
                        type="tel"
                        value={form.team_lead_phone}
                        onChange={(value) => update('team_lead_phone', value)}
                      />

                      <SignaturePad
                        label={t('חתימת ראש צוות מאיה')}
                        onChange={setTeamLeadSignature}
                      />
                    </div>
                  </div>
                </DiarySection>

                <DiarySection title={t('הערות נוספות')}>
                  <DiaryTextarea
                    label={t('הערות נוספות')}
                    value={form.additional_notes}
                    onChange={(value) => update('additional_notes', value)}
                  />
                </DiarySection>
              </div>

              {message && <div className="workDiaryMessage stickyMessage">{message}</div>}
              <footer className="workDiaryActions">
                <button type="button" onClick={saveDiary} disabled={saving}>
                  <PenLine size={17} /> {saving ? t('שומר...') : t('שמירה וסגירת היומן')}
                </button>
                <button type="button" className="ghost" onClick={() => setFormOpen(false)}>
                  {t('ביטול')}
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}

function DiarySection({ title, children }) {
  return (
    <section className="workDiarySection">
      <h3>{t(title)}</h3>
      {children}
    </section>
  );
}

function DiaryInput({ label, value, onChange, type = 'text', readOnly = false, required = false }) {
  return (
    <label>
      {t(label)}
      {required && <span className="requiredMark"> *</span>}
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        required={required}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  );
}

function DiaryTextarea({ label, value, onChange }) {
  return (
    <label>
      {t(label)}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
