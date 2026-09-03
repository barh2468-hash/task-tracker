import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';
import { MapPin } from 'lucide-react';
import { mapsLink } from '../utils/format.js';

export default function LocationLine({ label, lat, lng, accuracy }) {
  useTranslation();
  const link = mapsLink(lat, lng);
  if (!link) {
    return (
      <>
        <br />
        <span className="muted locationLine">
          <MapPin size={13} /> {t(label)}
          {t(': לא נשמר')}
        </span>
      </>
    );
  }
  return (
    <>
      <br />
      <a className="muted locationLine" href={link} target="_blank" rel="noreferrer">
        <MapPin size={13} /> {t(label)}
        {t(': פתח במפה')}
        {typeof accuracy === 'number'
          ? t(' · דיוק כ-{{value0}} מ׳', { value0: Math.round(accuracy) })
          : ''}
      </a>
    </>
  );
}
