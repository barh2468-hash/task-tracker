import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { t } from '../language/LanguageContext.jsx';

export default function QuoteDialog({ title, onClose, error, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current,
      previous = document.activeElement;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      previous?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="quotesDialog"
      aria-labelledby="quotes-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2 id="quotes-dialog-title">{title}</h2>
        <button
          type="button"
          className="ghost iconOnly"
          aria-label={t('quotes.close')}
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      {error && (
        <p className="quotesError" role="alert">
          {t(error)}
        </p>
      )}
      {children}
    </dialog>
  );
}
