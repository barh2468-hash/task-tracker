import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { createSignedUrl } from '../../../services/api/storage.js';

const PREVIEW_COUNT = 6;

export default function PhotoGallery({ photos, canDelete = false, onDelete }) {
  useTranslation();
  const [urls, setUrls] = useState({});
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadUrls() {
      const next = {};
      for (const photo of photos) {
        const { data } = await createSignedUrl('project-photos', photo.file_path);
        if (data?.signedUrl) next[photo.id] = data.signedUrl;
      }
      if (!cancelled) setUrls(next);
    }
    loadUrls();
    return () => {
      cancelled = true;
    };
  }, [photos]);

  if (!photos.length) return <div className="muted photosEmpty">{t('אין תמונות בפרויקט')}</div>;

  const visiblePhotos = showAll ? photos : photos.slice(0, PREVIEW_COUNT);

  return (
    <>
      <div className="photos">
        {visiblePhotos.map((photo) =>
          urls[photo.id] ? (
            <div key={photo.id} className="photoItem">
              <a className="photoThumb" href={urls[photo.id]} target="_blank" rel="noreferrer">
                <img src={urls[photo.id]} alt={photo.category || t('תמונת שטח')} />
                <span>{photo.category || t('תמונת שטח')}</span>
              </a>
              {canDelete && (
                <button
                  type="button"
                  className="photoDeleteButton"
                  aria-label={t('מחיקת {{value0}}', { value0: photo.category || t('תמונת שטח') })}
                  title={t('מחיקת תמונה')}
                  onClick={() => onDelete?.(photo)}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ) : (
            <div key={photo.id} className="photoSkeleton" />
          ),
        )}
      </div>
      {photos.length > PREVIEW_COUNT && (
        <button
          type="button"
          className="ghost smallBtn photosToggle"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll
            ? t('הצגת פחות תמונות')
            : t('הצגת כל התמונות ({{count}})', { count: photos.length })}
        </button>
      )}
    </>
  );
}
