import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';
import AttendanceHeroWidget from '../features/attendance/components/AttendanceHeroWidget.jsx';

export default function DashboardHero({ title, subtitle, widget }) {
  useTranslation();

  return (
    <div className="dashboardHero">
      <div>
        <span className="eyebrow">MAYA TASKS</span>
        <h2>{t(title)}</h2>
        <p>{t(subtitle)}</p>
      </div>
      {widget === undefined ? <AttendanceHeroWidget /> : widget}
    </div>
  );
}
