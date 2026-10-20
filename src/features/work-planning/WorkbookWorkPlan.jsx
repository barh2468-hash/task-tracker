import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import DailyWorkPlan from './DailyWorkPlan.jsx';
import workbook from './october-20-work-plan.json';
import { importWorkbookPlan } from './importWorkbookPlan.js';
import { planStorageKey, readPlan } from './localPlans.js';
import { planWorkerNames } from './staffingSummary.js';

const planningRoster = planWorkerNames(workbook.rows);

// This wrapper and its private workbook data are imported only by development routes.
export default function WorkbookWorkPlan({ storageScope, workers = [], projects = [], projectsReady = true }) {
  useTranslation();
  const { language } = useLanguage();
  const [importVersion, setImportVersion] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const locale = localeForLanguage(language);
  const date = new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Hebron', dateStyle: 'short' })
    .format(new Date(`${workbook.source.date}T12:00:00Z`));
  const count = new Intl.NumberFormat(locale).format(workbook.rows.length);

  function loadWorkbook() {
    try {
      const existing = readPlan(window.localStorage, planStorageKey(storageScope, workbook.source.date));
      if (existing && !window.confirm(t('workPlan.confirmImportWorkbook'))) return;
      importWorkbookPlan(window.localStorage, storageScope, workbook);
      setImportStatus('success');
      setImportVersion((version) => version + 1);
    } catch { setImportStatus('error'); }
  }

  return <>
    <details className="workPlanWorkbookSource">
      <summary>{t('workPlan.workbookSummary', { count, date })}</summary>
      <div className="workPlanWorkbookSourceBody"><p>{t('workPlan.workbookSource', { filename: workbook.source.filename })}</p>
        <button type="button" onClick={loadWorkbook}>{t('workPlan.importWorkbook')}</button>
      </div>
    </details>
    {importStatus && <p className="workPlanImportFeedback" role={importStatus === 'error' ? 'alert' : 'status'}>
      {t(importStatus === 'error' ? 'workPlan.importWorkbookError' : 'workPlan.importWorkbookSuccess', { count })}
    </p>}
    <DailyWorkPlan key={importVersion} storageScope={storageScope} canEdit initialDate={workbook.source.date}
      planningRoster={planningRoster} rosterSource="workbook"
      initialRows={workbook.rows} projects={[...projects, ...workbook.projects]} workers={[...workers, ...workbook.workers]} projectsReady={projectsReady} />
  </>;
}
