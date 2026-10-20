import { useTranslation } from 'react-i18next';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { localeForLanguage } from '../language/locale.js';
import WorkbookWorkPlan from './WorkbookWorkPlan.jsx';
import workbook from './october-20-work-plan.json';

// Development-only route: no authentication shortcuts, API requests or backend writes.
// The full workbook fixture is reachable only through the development-only route.
const storageScope = 'local-development-preview';

export default function LocalWorkPlanPreview() {
  useTranslation();
  const { language, setLanguage } = useLanguage();
  const locale = localeForLanguage(language);
  const date = new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Hebron', dateStyle: 'short' })
    .format(new Date(`${workbook.source.date}T12:00:00Z`));
  return <div className="workPlanPreview">
    <header className="workPlanPreviewHeader"><div className="workPlanPreviewBrand">
      <img src="/logo-transparent.png" alt="" /><div><strong>{t('workPlan.brand')}</strong><p>{t('workPlan.workday')} / {t('workPlan.title')}</p></div>
    </div><div className="workPlanPreviewControls">
      <a href="/app/work-plan">{t('workPlan.openApp')}</a>
      <label>{t('workPlan.language')}<select value={language} onChange={(event) => void setLanguage(event.target.value)}>
        <option value="he" lang="he">עברית</option><option value="en" lang="en">English</option><option value="el" lang="el">Ελληνικά</option>
      </select></label>
    </div></header>
    <p className="workPlanPreviewIntro"><strong>{t('workPlan.preview')}</strong> · {t('workPlan.previewDescription', { date })}</p>
    <WorkbookWorkPlan storageScope={storageScope} />
  </div>;
}
