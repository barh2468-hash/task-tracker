import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';

// Deleting removes the chat and every message for all members, with no undo,
// so the manager must tick an explicit acknowledgement first.
export default function DeleteChatDialog({ name, memberCount, deleting, onClose, onConfirm }) {
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !deleting) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [deleting, onClose]);

  return createPortal(
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- Escape and the close button provide keyboard access
    <div
      className="modalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-chat-title"
      onClick={() => !deleting && onClose()}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- prevent backdrop dismissal for clicks inside the dialog */}
      <div className="statusNoteModal" onClick={(event) => event.stopPropagation()}>
        <div className="modalHeader statusNoteHeader">
          <div>
            <h3 id="delete-chat-title">{t('מחיקת השיחה לכל המשתתפים')}</h3>
            <p className="muted" dir="auto">
              {t(
                '"{{value0}}" וכל ההודעות בה יימחקו אצל כל {{value1}} המשתתפים. אי אפשר לבטל את זה.',
                {
                  value0: name,
                  value1: memberCount,
                },
              )}
            </p>
          </div>
          <button
            type="button"
            className="ghost iconBtn"
            disabled={deleting}
            onClick={onClose}
            aria-label={t('סגור')}
          >
            <X size={18} />
          </button>
        </div>

        <p className="muted">{t('כדי להסיר את השיחה רק מהרשימה שלך, השתמשו ב„הסתרת שיחה”.')}</p>

        <label
          className="draftingReadyToggle deleteChatAcknowledge"
          htmlFor="delete-chat-acknowledge"
          aria-label={t('אני מבין/ה שכל ההודעות יימחקו לצמיתות')}
        >
          <input
            id="delete-chat-acknowledge"
            type="checkbox"
            checked={acknowledged}
            disabled={deleting}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>
            <strong>{t('אני מבין/ה שכל ההודעות יימחקו לצמיתות')}</strong>
          </span>
        </label>

        <div className="modalActions">
          <button
            type="button"
            className="danger"
            disabled={!acknowledged || deleting}
            onClick={onConfirm}
          >
            <Trash2 size={17} />
            {deleting ? t('מוחק...') : t('מחיקה לכולם')}
          </button>
          <button type="button" className="ghost" disabled={deleting} onClick={onClose}>
            {t('ביטול')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
