import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { createSignedUrl } from '../../../services/api/storage.js';

export default function PhotoGallery({ photos, canDelete = false, onDelete }) {
  const [urls, setUrls] = useState({});

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

  if (!photos.length)
    return <div className="muted photosEmpty">אין תמונות בפרויקט</div>;

  return (
    <div className="photos">
      {photos.slice(0, 6).map((photo) =>
        urls[photo.id] ? (
          <div key={photo.id} className="photoItem">
            <a
              className="photoThumb"
              href={urls[photo.id]}
              target="_blank"
              rel="noreferrer"
            >
              <img src={urls[photo.id]} alt={photo.category || "תמונת שטח"} />
              <span>{photo.category || "תמונת שטח"}</span>
            </a>
            {canDelete && (
              <button
                type="button"
                className="photoDeleteButton"
                aria-label={`מחיקת ${photo.category || 'תמונת שטח'}`}
                title="מחיקת תמונה"
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
  );
}
