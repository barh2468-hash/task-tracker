import { MapPin } from 'lucide-react';
import { mapsLink } from '../utils/format.js';

export default function LocationLine({ label, lat, lng, accuracy }) {
  const link = mapsLink(lat, lng);
  if (!link) {
    return (
      <>
        <br />
        <span className="muted locationLine">
          <MapPin size={13} /> {label}: לא נשמר
        </span>
      </>
    );
  }
  return (
    <>
      <br />
      <a className="muted locationLine" href={link} target="_blank" rel="noreferrer">
        <MapPin size={13} /> {label}: פתח במפה
        {typeof accuracy === 'number' ? ` · דיוק כ-${Math.round(accuracy)} מ׳` : ''}
      </a>
    </>
  );
}
