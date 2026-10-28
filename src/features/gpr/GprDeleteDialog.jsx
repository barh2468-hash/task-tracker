import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, X } from 'lucide-react';
import { t, useLanguage } from '../language/LanguageContext.jsx';
import { orderName } from './model.js';

export default function GprDeleteDialog({ order, busy, error, onConfirm, onClose }) {
  useTranslation();
  const { language } = useLanguage();
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => previous?.focus?.();
  }, []);
  return (
    <dialog
      ref={ref}
      className="gprDialog gprDeleteDialog"
      dir={language === 'he' ? 'rtl' : 'ltr'}
      aria-labelledby="gpr-delete-title"
      aria-describedby="gpr-delete-help"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="gprDialogHeader">
        <h2 id="gpr-delete-title">{t('gpr.deleteTitle')}</h2>
        <button
          type="button"
          className="iconOnly"
          disabled={busy}
          onClick={onClose}
          aria-label={t('gpr.close')}
        >
          <X size={18} />
        </button>
      </header>
      <div className="gprDialogBody">
        <b dir="auto">{orderName(order, t)}</b>
        <p id="gpr-delete-help">{t('gpr.deleteHelp')}</p>
        {error && (
          <p className="gprError" role="alert">
            {t(error)}
          </p>
        )}
      </div>
      <footer className="gprDialogFooter">
        <button type="button" className="ghost" disabled={busy} onClick={onClose}>
          {t('gpr.cancel')}
        </button>
        <button type="button" className="danger" disabled={busy} onClick={onConfirm}>
          <Trash2 size={16} />
          {t(busy ? 'gpr.deleting' : 'gpr.deleteTitle')}
        </button>
      </footer>
    </dialog>
  );
}
