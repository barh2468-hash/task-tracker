import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';

export default function DashboardHero({ title, subtitle }) {
  useTranslation();

  return (
    <div className="dashboardHero">
      <div>
        <span className="eyebrow">MAYA TASKS</span>
        <h2>{t(title)}</h2>
        <p>{t(subtitle)}</p>
      </div>
    </div>
  );
}
