import { useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { t } from '../language/LanguageContext.jsx';

export default function DeleteLayoutDialog({ row, onDelete, onClose }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const inProgressRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    cancelRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; if (dialog.open) dialog.close(); };
  }, []);
  async function confirmDelete() {
    if (inProgressRef.current) return;
    inProgressRef.current = true; setDeleting(true); setError('');
    try { await onDelete(row); }
    catch (failure) { setError(failure.message || t('לא ניתן למחוק את הפרישה. בדקו את ההרשאות והחיבור ונסו שוב.')); }
    finally { inProgressRef.current = false; setDeleting(false); }
  }
  return <dialog ref={dialogRef} className="manholeEmailDialog" aria-labelledby="manhole-delete-title" aria-describedby="manhole-delete-description" onCancel={event => { event.preventDefault(); if (!inProgressRef.current) onClose(); }}>
    <header className="manholePreviewHeader"><h2 id="manhole-delete-title">{t('מחיקת פרישה')}</h2><button type="button" className="manholePreviewClose" disabled={deleting} aria-label={t('סגירה')} onClick={onClose}><X size={22} aria-hidden="true" /></button></header>
    <div className="manholeEmailForm">
      <p id="manhole-delete-description">{t('הפרישה תוסר מרשימת הפרישות השמורות. גרסאות אחרות של אותה שוחה יישארו ברשימה.')}</p>
      <div className="manholeEmailAttachments"><b>{t('שוחה')} {row.manhole_number} · {row.infrastructure}</b><p>{row.project_name}</p><small>{row.file_name}</small></div>
      {error && <p role="alert" className="manholeSavedError">{error}</p>}
      <footer className="manholeEmailActions"><button ref={cancelRef} type="button" disabled={deleting} onClick={onClose}>{t('ביטול')}</button><button type="button" className="manholeDeleteConfirm" disabled={deleting} onClick={confirmDelete}><Trash2 size={17} aria-hidden="true" />{t(deleting ? 'מוחק...' : 'מחיקת הפרישה')}</button></footer>
    </div>
  </dialog>;
}
