import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, FileCheck2, HeartPulse, Palmtree, Upload, X } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import SickCertificateLink from './SickCertificateLink.jsx';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

// Sick leave and vacation share this dialog; only the copy and icon differ.
const LEAVE_COPY = {
  sick: {
    icon: HeartPulse,
    title: 'דיווח מחלה',
    subtitle: 'בחרו טווח תאריכים וצרפו אישור מחלה לפי הצורך',
    close: 'סגירת דיווח מחלה',
    fromLabel: 'תאריך תחילת המחלה',
    toLabel: 'תאריך סיום המחלה',
    fileLabel: 'אישור מחלה (אופציונלי)',
    maxDays: 'ניתן לדווח על עד 92 ימי מחלה בכל פעולה.',
    submit: 'שמירת דיווח מחלה',
  },
  vacation: {
    icon: Palmtree,
    title: 'דיווח חופש',
    subtitle: 'בחרו טווח תאריכים וצרפו אישור חופשה לפי הצורך',
    close: 'סגירת דיווח חופש',
    fromLabel: 'תאריך תחילת החופשה',
    toLabel: 'תאריך סיום החופשה',
    fileLabel: 'אישור חופשה (אופציונלי)',
    maxDays: 'ניתן לדווח על עד 92 ימי חופש בכל פעולה.',
    submit: 'שמירת דיווח חופש',
  },
};

function daysInRange(fromDate, toDate) {
  const from = new Date(`${fromDate}T12:00:00Z`);
  const to = new Date(`${toDate}T12:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;
  return Math.floor((to - from) / 86400000) + 1;
}

export default function SickLeaveDialog({
  open,
  busy,
  leaveType = 'sick',
  today,
  existingCertificate,
  onClose,
  onSubmit,
}) {
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const copy = LEAVE_COPY[leaveType] || LEAVE_COPY.sick;
  const LeaveIcon = copy.icon;

  useEffect(() => {
    if (!open) return undefined;
    setFromDate(existingCertificate?.valid_from || today);
    setToDate(existingCertificate?.valid_to || today);
    setFile(null);
    setError('');
    return undefined;
  }, [existingCertificate?.id, existingCertificate?.valid_from, existingCertificate?.valid_to, open, today]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [busy, onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  async function submit(event) {
    event.preventDefault();
    setError('');
    const dayCount = daysInRange(fromDate, toDate);
    if (!dayCount) return setError(t('טווח התאריכים אינו תקין.'));
    if (dayCount > 92) return setError(t(copy.maxDays));
    if (file && !ALLOWED_FILE_TYPES.has(file.type)) {
      return setError(t('אפשר לצרף קובץ PDF, JPG או PNG בלבד.'));
    }
    if (file && file.size > MAX_FILE_BYTES) {
      return setError(t('גודל הקובץ המקסימלי הוא 10MB.'));
    }
    const result = await onSubmit({ fromDate, toDate, file, existingCertificate });
    if (result?.success) onClose();
  }

  return createPortal(
    <div className="attendanceProjectModalBackdrop sickLeaveModalBackdrop">
      <button
        type="button"
        className="attendanceProjectModalDismiss"
        aria-label={t(copy.close)}
        onClick={busy ? undefined : onClose}
      />
      <section
        className={`sickLeaveModal ${leaveType === 'vacation' ? 'vacation' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sick-leave-dialog-title"
      >
        <header className="sickLeaveModalHeader">
          <span className="sickLeaveModalIcon" aria-hidden="true">
            <LeaveIcon size={23} />
          </span>
          <span>
            <h2 id="sick-leave-dialog-title">{t(copy.title)}</h2>
            <p>{t(copy.subtitle)}</p>
          </span>
          <button
            type="button"
            className="attendanceProjectModalClose"
            aria-label={t(copy.close)}
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <form className="sickLeaveForm" onSubmit={submit}>
          <div className="sickLeaveDateGrid">
            <label>
              <span><CalendarDays size={16} />{t(copy.fromLabel)}</span>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                required
              />
            </label>
            <label>
              <span><CalendarDays size={16} />{t(copy.toLabel)}</span>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(event) => setToDate(event.target.value)}
                required
              />
            </label>
          </div>

          <label className="sickLeaveFileField">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setError('');
              }}
            />
            <span className="sickLeaveFileIcon" aria-hidden="true">
              {file ? <FileCheck2 size={23} /> : <Upload size={23} />}
            </span>
            <span>
              <strong>{t(copy.fileLabel)}</strong>
              <small>{file?.name || t('PDF או תמונה, עד 10MB')}</small>
            </span>
            <b>{t(file ? 'החלפת קובץ' : 'בחירת קובץ')}</b>
          </label>

          {existingCertificate?.file_path && !file && (
            <div className="sickLeaveExisting">
              <span>{t('האישור המצורף')}</span>
              <SickCertificateLink certificate={existingCertificate} />
            </div>
          )}

          {error && <p className="sickLeaveError" role="alert">{error}</p>}

          <div className="sickLeaveActions">
            <button type="button" className="secondary" disabled={busy} onClick={onClose}>
              {t('ביטול')}
            </button>
            <button type="submit" className="primary" disabled={busy}>
              <LeaveIcon size={18} />
              {busy ? t('שומר דיווח...') : t(copy.submit)}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
