import { useState } from 'react';
import {
  Ban,
  Check,
  CheckCheck,
  CircleAlert,
  Clock,
  Copy,
  MoreHorizontal,
  Pencil,
  Reply,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import { useMessage } from '../../../context/MessageContext.jsx';
import { initials } from '../initials.js';
import { isProjectReferenceOnly } from '../chatEvents.js';
import { linkifySegments } from '../linkify.js';
import ProjectReferenceCard from './ProjectReferenceCard.jsx';

function MessageText({ body }) {
  return (
    <p dir="auto">
      {linkifySegments(body).map((segment, index) =>
        segment.type === 'text' ? (
          segment.value
        ) : (
          <a
            key={index}
            href={segment.href}
            className="chatInlineLink"
            {...(segment.type === 'url' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {segment.value}
          </a>
        ),
      )}
    </p>
  );
}

// One person-written message. `message.status` is set only on messages that
// are still on their way ("sending") or could not be saved ("failed").
export default function MessageBubble({
  message,
  mine,
  senderName,
  senderColor,
  referencedProject,
  quoted,
  receipts,
  locale,
  highlighted,
  canReply,
  canEdit,
  canDelete,
  menuOpen,
  onMenuChange,
  onReply,
  onEdit,
  onDelete,
  onRetry,
  onDiscard,
  onJumpTo,
}) {
  const { setMessage } = useMessage();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleted = Boolean(message.deleted_at);
  const pending = message.status === 'sending';
  const failed = message.status === 'failed';
  const time = new Date(message.created_at).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  function closeMenu() {
    setConfirmingDelete(false);
    onMenuChange(false);
  }

  async function copyText() {
    closeMenu();
    try {
      await navigator.clipboard.writeText(message.body);
      setMessage(t('ההודעה הועתקה'), 'info');
    } catch {
      setMessage(t('לא ניתן להעתיק את ההודעה'), 'error');
    }
  }

  const hasMenu = !deleted && !pending && !failed;

  return (
    <div
      id={`chat-message-${message.id}`}
      className={`chatMessageRow ${mine ? 'mine' : ''} ${highlighted ? 'highlighted' : ''}`}
      style={{ '--chat-sender-color': senderColor }}
    >
      <span className="chatMessageAvatar" aria-hidden="true">
        {initials(senderName)}
      </span>
      <article className={`chatBubble ${mine ? 'mine' : ''} ${failed ? 'failed' : ''}`}>
        <b>{mine ? t('אני') : senderName || t('משתמש')}</b>

        {quoted && !deleted && (
          <button
            type="button"
            className="chatReplyQuote"
            onClick={() => quoted.id && onJumpTo(quoted.id)}
          >
            <small>{quoted.senderName}</small>
            <span dir="auto">{quoted.text}</span>
          </button>
        )}

        {deleted ? (
          <p className="chatDeletedText">
            <Ban size={14} aria-hidden="true" /> {t('ההודעה נמחקה')}
          </p>
        ) : (
          !isProjectReferenceOnly(message) && <MessageText body={message.body} />
        )}

        {message.project_id && !deleted && (
          <ProjectReferenceCard
            projectId={message.project_id}
            label={message.project_label}
            project={referencedProject}
          />
        )}

        <footer className="chatBubbleFooter">
          <time dateTime={message.created_at}>{time}</time>
          {message.edited_at && !deleted && <span>{t('נערך')}</span>}
          {mine && pending && (
            <span className="chatSendState" title={t('שולח...')}>
              <Clock size={12} aria-label={t('שולח...')} />
            </span>
          )}
          {mine && !pending && !failed && !deleted && receipts && (
            <span
              className={`chatSendState ${receipts.readByAll ? 'read' : ''}`}
              title={receipts.readByAll ? t('נקרא') : t('נשלח')}
            >
              {receipts.readByAll ? (
                <CheckCheck size={14} aria-label={t('נקרא')} />
              ) : (
                <Check size={14} aria-label={t('נשלח')} />
              )}
            </span>
          )}
          {hasMenu && (
            <span
              className="projectMoreActions chatMessageActions"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) closeMenu();
              }}
            >
              <button
                type="button"
                className="chatMessageMenuButton"
                aria-label={t('פעולות להודעה')}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => (menuOpen ? closeMenu() : onMenuChange(true))}
              >
                <MoreHorizontal size={14} />
              </button>
              {menuOpen && (
                <span className="projectMoreActionsMenu" role="menu">
                  {canReply && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeMenu();
                        onReply();
                      }}
                    >
                      <Reply size={15} /> {t('השב')}
                    </button>
                  )}
                  <button type="button" role="menuitem" onClick={copyText}>
                    <Copy size={15} /> {t('העתקה')}
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeMenu();
                        onEdit();
                      }}
                    >
                      <Pencil size={15} /> {t('עריכה')}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        if (!confirmingDelete) {
                          setConfirmingDelete(true);
                          return;
                        }
                        closeMenu();
                        onDelete();
                      }}
                    >
                      <Trash2 size={15} />
                      {confirmingDelete ? t('לחצו שוב למחיקה') : t('מחיקה')}
                    </button>
                  )}
                  {mine && receipts && (
                    <span className="chatReadInfo">
                      <span>
                        <b>{t('נקרא על ידי')}</b>{' '}
                        {receipts.readerNames.length ? receipts.readerNames.join(', ') : '—'}
                      </span>
                      {receipts.waitingNames.length > 0 && (
                        <span>
                          <b>{t('טרם נקרא')}</b> {receipts.waitingNames.join(', ')}
                        </span>
                      )}
                    </span>
                  )}
                </span>
              )}
            </span>
          )}
        </footer>

        {failed && (
          <div className="chatSendFailed" role="alert">
            <CircleAlert size={14} aria-hidden="true" />
            <span>{t('ההודעה לא נשלחה')}</span>
            <button type="button" onClick={onRetry}>
              <RotateCcw size={13} /> {t('נסה שוב')}
            </button>
            <button type="button" onClick={onDiscard} aria-label={t('הסרה')}>
              <X size={13} />
            </button>
          </div>
        )}
      </article>
    </div>
  );
}
