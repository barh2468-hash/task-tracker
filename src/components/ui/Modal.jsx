import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, actions }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="uiModalBackdrop">
      <button type="button" className="uiModalDismiss" aria-label="close" tabIndex={-1} onClick={onClose} />
      <div className="uiModal" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button type="button" className="ghost iconOnly" aria-label="close" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </header>
        {children}
        {actions ? <div className="uiModalActions">{actions}</div> : null}
      </div>
    </div>
  );
}
