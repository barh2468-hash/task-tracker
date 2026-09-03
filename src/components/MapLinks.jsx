import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';
export default function MapLinks({ startLinks, endLinks }) {
  useTranslation();
  if (!startLinks.length && !endLinks.length)
    return <span className="muted">{t('לא נשמר מיקום')}</span>;
  return (
    <div className="mapLinks">
      {startLinks.slice(0, 3).map((link, i) => (
        <a key={`s-${link}`} href={link} target="_blank" rel="noreferrer">
          {t('התחלה')}
          {i + 1}
        </a>
      ))}
      {endLinks.slice(0, 3).map((link, i) => (
        <a key={`e-${link}`} href={link} target="_blank" rel="noreferrer">
          {t('סיום')}
          {i + 1}
        </a>
      ))}
      {startLinks.length + endLinks.length > 6 && <span className="muted">{t('ועוד...')}</span>}
    </div>
  );
}
