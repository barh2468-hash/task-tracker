import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, LoaderCircle } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.js';
import { useProjects } from '../ProjectsContext.jsx';

const emptyProject = {
  name: '',
  client_name: '',
  location: '',
  contact_phone: '',
  contact_email: '',
  description: '',
  assigned_to: '',
  assigned_workers: [],
  due_date: '',
  requires_work_diary: false,
  boundary_sketch: null,
};

export default function NewProjectForm() {
  useTranslation();
  const { workers, createProject } = useProjects();
  const { isManager } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(emptyProject);
  const [creating, setCreating] = useState(false);

  const projectLeads = workers.filter((worker) => worker.role !== 'drafter');
  const fieldWorkers = workers.filter((worker) => worker.role === 'field_worker');

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const result = await createProject(project);
      if (result?.message?.startsWith('הפרויקט נוצר')) {
        setProject(emptyProject);
        navigate(`/app/projects?filter=${isManager ? 'all' : 'mine'}`);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="card form">
      <h2>{t('הוספת פרויקט חדש')}</h2>
      <div className="formGrid">
        <label>
          {t('שם פרויקט')}

          <input
            value={project.name}
            onChange={(e) => setProject({ ...project, name: e.target.value })}
            placeholder={t('לדוגמה: כביש 531 - קטע צפוני')}
          />
        </label>
        <label>
          {t('לקוח')}

          <input
            value={project.client_name}
            onChange={(e) => setProject({ ...project, client_name: e.target.value })}
            placeholder={t('לדוגמה: עיריית הרצליה')}
          />
        </label>
        <label>
          {t('מיקום')}

          <input
            value={project.location}
            onChange={(e) => setProject({ ...project, location: e.target.value })}
            placeholder={t('עיר / רחוב / אזור')}
          />
        </label>
        <label>
          {t('טלפון איש קשר בשטח')}

          <input
            type="tel"
            dir="ltr"
            value={project.contact_phone}
            onChange={(e) => setProject({ ...project, contact_phone: e.target.value })}
            placeholder={t('לדוגמה: 050-1234567')}
          />
        </label>
        <label>
          {t('מייל איש קשר בשטח')}

          <input
            type="email"
            dir="ltr"
            value={project.contact_email}
            onChange={(e) => setProject({ ...project, contact_email: e.target.value })}
            placeholder={t('לדוגמה: contact@company.com')}
          />
        </label>
        <label>
          {t('שיוך לאחראי ראשי (מנהל או עובד שטח), אופציונלי')}

          <select
            value={project.assigned_to}
            onChange={(e) => setProject({ ...project, assigned_to: e.target.value })}
          >
            <option value="">{t('ללא שיוך כרגע')}</option>
            {projectLeads.map((w) => (
              <option key={w.id} value={w.id}>
                {w.full_name} - {w.email}
              </option>
            ))}
          </select>
        </label>
        <label className="wideField">
          {t('עובדים נוספים בפרויקט, אופציונלי')}

          <div className="workerChecks">
            {fieldWorkers.map((w) => (
              <label key={w.id} className="checkLine">
                <input
                  type="checkbox"
                  checked={project.assigned_workers.includes(w.id)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? Array.from(new Set([...project.assigned_workers, w.id]))
                      : project.assigned_workers.filter((id) => id !== w.id);
                    setProject({ ...project, assigned_workers: next });
                  }}
                />
                {w.full_name} - {w.email}
              </label>
            ))}
          </div>
        </label>
        <label>
          {t('תאריך יעד')}

          <input
            type="date"
            value={project.due_date}
            onChange={(e) => setProject({ ...project, due_date: e.target.value })}
          />
        </label>
        <label className="workDiaryProjectToggle">
          <input
            type="checkbox"
            checked={Boolean(project.requires_work_diary)}
            onChange={(e) => setProject({ ...project, requires_work_diary: e.target.checked })}
          />

          {t('הפרויקט דורש יומן עבודה וחתימות')}
        </label>
        <label className="wideField boundarySketchField">
          {t('סקיצת גבול עבודה, אופציונלי')}

          <span className="filePickerControl">
            <FileUp size={18} />
            <span>
              {project.boundary_sketch?.name || t('בחירת קובץ PDF של סקיצת גבול עבודה')}
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              disabled={creating}
              onChange={(event) =>
                setProject({ ...project, boundary_sketch: event.target.files?.[0] || null })
              }
            />
          </span>
        </label>
      </div>
      <label>
        {t('תיאור העבודה')}

        <textarea
          value={project.description}
          onChange={(e) => setProject({ ...project, description: e.target.value })}
          placeholder={t('פירוט איתור תשתיות, דרישות לקוח, חסמים וכו׳')}
        />
      </label>
      <button onClick={handleCreate} disabled={creating}>
        {creating && <LoaderCircle className="spinIcon" size={17} />}
        {creating ? t('יוצר פרויקט...') : t('צור פרויקט')}
      </button>
    </section>
  );
}
