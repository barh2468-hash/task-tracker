import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Camera,
  CircleCheck,
  ExternalLink,
  FileText,
  FolderKanban,
  ListPlus,
  MessageCircle,
  RefreshCw,
  Search,
  SendHorizontal,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import { localeForLanguage } from '../../language/locale.js';
import { useAuth } from '../../auth/useAuth.js';
import { useProjects } from '../../projects/ProjectsContext.jsx';
import { useChat } from '../ChatContext.jsx';
import { readDrafts, saveDraft } from '../drafts.js';
import { initials } from '../initials.js';
import { chatEventNote, chatEventText } from '../chatEvents.js';
import { firstUnreadIndex } from '../unreadDivider.js';
import { useRealtimeRefresh } from '../../../hooks/useRealtimeRefresh.js';
import { projectDeepLinkPath } from '../../../utils/navigation.js';
import '../chat.css';

const NEAR_BOTTOM_PX = 80;

const EVENT_ICONS = {
  status_changed: RefreshCw,
  photo_added: Camera,
  document_added: FileText,
  task_added: ListPlus,
  task_completed: CircleCheck,
};

function senderColor(id) {
  const colors = ['#176b93', '#7c3f91', '#a14b20', '#186d5e', '#4e55a2'];
  const hash = [...String(id || '')].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  return colors[hash % colors.length];
}

// Phones and tablets type a newline with Enter and send with the button.
function enterSendsMessage() {
  return !window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
}

// One open conversation: messages, project activity lines and the composer.
// Render it with `key={conversationId}` so every conversation starts fresh.
// `unreadCount` is the conversation's unread count from its list, or null
// while the list has not loaded yet; the read receipt waits until it is known
// so the "unread messages" divider can be placed first.
export default function ChatRoom({
  conversationId,
  unreadCount,
  header,
  allowProjectReference = true,
  onDraftsChange,
}) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const locale = localeForLanguage(language);
  const { profile } = useAuth();
  const { projects, workers } = useProjects();
  const { getMessages, sendMessage, markConversationRead } = useChat();
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState(
    () => readDrafts(profile?.id)[conversationId] || '',
  );
  const [sending, setSending] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [unreadMarker, setUnreadMarker] = useState(null);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const messagesContainerRef = useRef(null);
  const unreadDividerRef = useRef(null);
  const textareaRef = useRef(null);
  const nearBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const lastMessageIdRef = useRef(null);
  const unreadMarkerRef = useRef(null);
  const unreadCountRef = useRef(unreadCount);
  unreadCountRef.current = unreadCount;
  const mountedRef = useRef(true);

  const profilesById = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    [workers],
  );
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const selectedProject = projectsById.get(selectedProjectId) || null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function loadMessages() {
    try {
      const next = await getMessages(conversationId);
      if (!mountedRef.current) return;
      setMessages(next);
      // Remember the unread count before marking the conversation read, so the
      // divider survives the read receipt.
      if (unreadMarkerRef.current === null) {
        if (unreadCountRef.current == null) return;
        unreadMarkerRef.current = Number(unreadCountRef.current || 0);
        setUnreadMarker(unreadMarkerRef.current);
      }
      if (document.visibilityState === 'visible' && document.hasFocus() && next.length) {
        await markConversationRead(conversationId, next.at(-1).created_at);
      }
    } catch (error) {
      console.warn('Messages load failed:', error instanceof Error ? error.message : error);
    }
  }

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opened before the conversation list arrived: reload once it is known, so
  // the unread divider is captured and the conversation is marked read.
  const unreadCountKnown = unreadCount != null;
  useEffect(() => {
    if (unreadCountKnown && unreadMarkerRef.current === null) loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCountKnown]);

  useRealtimeRefresh({
    enabled: Boolean(conversationId),
    channelName: `infrastructure-tracker-chat-room-${profile?.id || 'guest'}`,
    tables: ['chat_messages'],
    onRefresh: loadMessages,
    pollIntervalMs: 5000,
  });

  const unreadIndex = useMemo(
    () => firstUnreadIndex(messages, unreadMarker || 0, profile?.id),
    [messages, unreadMarker, profile?.id],
  );

  function scrollToBottom(behavior = 'smooth') {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    nearBottomRef.current = true;
    setHasNewBelow(false);
  }

  function handleMessagesScroll() {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    nearBottomRef.current = distance < NEAR_BOTTOM_PX;
    if (nearBottomRef.current) setHasNewBelow(false);
  }

  // Background refreshes never move the view. Opening a conversation lands on
  // the first unread message; a new message follows only when the reader is
  // already at the bottom or sent it, otherwise a "new messages" button shows.
  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    const last = messages.at(-1);
    if (!container || !last) return;
    if (!initialScrollDoneRef.current) {
      if (unreadMarker === null) return;
      initialScrollDoneRef.current = true;
      lastMessageIdRef.current = last.id;
      const divider = unreadDividerRef.current;
      if (divider) {
        container.scrollTop +=
          divider.getBoundingClientRect().top - container.getBoundingClientRect().top - 12;
        handleMessagesScroll();
      } else {
        scrollToBottom('auto');
      }
      return;
    }
    if (last.id === lastMessageIdRef.current) return;
    lastMessageIdRef.current = last.id;
    if (last.sender_id === profile?.id || nearBottomRef.current) scrollToBottom();
    else setHasNewBelow(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, unreadMarker]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    // Grow with the text; the stylesheet's max-height caps it and then it scrolls.
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight + textarea.offsetHeight - textarea.clientHeight}px`;
  }, [messageText]);

  function updateDraft(text) {
    onDraftsChange?.(saveDraft(profile?.id, conversationId, text));
  }

  function handleMessageTextChange(event) {
    setMessageText(event.target.value);
    updateDraft(event.target.value);
  }

  async function handleSendMessage(event) {
    event?.preventDefault();
    const body = messageText.trim();
    if ((!body && !selectedProject) || sending) return;
    setSending(true);
    try {
      const projectReference = selectedProject
        ? { id: selectedProject.id, label: selectedProject.name }
        : null;
      const sent = await sendMessage(conversationId, body, projectReference);
      if (sent) {
        updateDraft('');
        if (!mountedRef.current) return;
        setMessages((items) =>
          items.some((item) => item.id === sent.id) ? items : [...items, sent],
        );
        setMessageText('');
        setSelectedProjectId(null);
        setProjectPickerOpen(false);
        setProjectSearch('');
        if (document.visibilityState === 'visible' && document.hasFocus()) {
          await markConversationRead(conversationId, sent.created_at);
        }
      }
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }

  const filteredProjects = projects
    .filter((project) => !project.is_archived)
    .filter((project) =>
      `${project.name || ''} ${project.client_name || ''} ${project.location || ''}`
        .toLowerCase()
        .includes(projectSearch.trim().toLowerCase()),
    );

  function renderEvent(message, createdAt) {
    const Icon = EVENT_ICONS[message.event_type] || RefreshCw;
    const actor =
      message.sender_id === profile?.id
        ? t('אני')
        : profilesById.get(message.sender_id)?.full_name || '';
    const note = chatEventNote(message.event_type, message.event_data);
    return (
      <div className="chatEventLine">
        <span className="chatEventSummary">
          <Icon size={14} aria-hidden="true" />
          <span dir="auto">
            {chatEventText(message.event_type, message.event_data, t, message.body)}
            {actor && <span className="chatEventActor"> · {actor}</span>}
          </span>
          <time dateTime={message.created_at}>
            {createdAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </time>
        </span>
        {note && <p dir="auto">{note}</p>}
      </div>
    );
  }

  function renderMessage(message, createdAt) {
    const mine = message.sender_id === profile?.id;
    const sender = mine ? profile : profilesById.get(message.sender_id);
    const referencedProject = projectsById.get(message.project_id);
    return (
      <div
        className={`chatMessageRow ${mine ? 'mine' : ''}`}
        style={{ '--chat-sender-color': senderColor(message.sender_id) }}
      >
        <span className="chatMessageAvatar" aria-hidden="true">
          {initials(sender?.full_name)}
        </span>
        <article className={`chatBubble ${mine ? 'mine' : ''}`}>
          <b>{mine ? t('אני') : sender?.full_name || t('משתמש')}</b>
          <p dir="auto">{message.body}</p>
          {message.project_id && (
            <button
              type="button"
              className="chatProjectReference"
              onClick={() => navigate(projectDeepLinkPath(message.project_id))}
            >
              <FolderKanban size={20} />
              <span>
                <small>{t('הפניה לפרויקט')}</small>
                <strong>{referencedProject?.name || message.project_label || t('פרויקט')}</strong>
              </span>
              <ExternalLink size={15} />
            </button>
          )}
          <time dateTime={message.created_at}>
            {createdAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </time>
        </article>
      </div>
    );
  }

  return (
    <>
      {header}

      <div
        className="chatMessages"
        aria-live="polite"
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
      >
        {messages.length === 0 && (
          <div className="chatFirstMessage">
            <MessageCircle size={28} />
            <b>{t('זו תחילת השיחה')}</b>
            <span>{t('שלחו הודעה ראשונה למשתתפים.')}</span>
          </div>
        )}
        {messages.map((message, index) => {
          const createdAt = new Date(message.created_at);
          const showDate =
            !index ||
            createdAt.toDateString() !== new Date(messages[index - 1].created_at).toDateString();
          return (
            <Fragment key={message.id}>
              {showDate && (
                <div className="chatDateSeparator">
                  <time dateTime={message.created_at}>
                    {createdAt.toLocaleDateString(locale, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </time>
                </div>
              )}
              {index === unreadIndex && (
                <div className="chatUnreadDivider" ref={unreadDividerRef}>
                  <span>
                    {t('{{value0}} הודעות שלא נקראו', {
                      value0: unreadMarker.toLocaleString(locale),
                    })}
                  </span>
                </div>
              )}
              {message.kind === 'event'
                ? renderEvent(message, createdAt)
                : renderMessage(message, createdAt)}
            </Fragment>
          );
        })}
        {hasNewBelow && (
          <button type="button" className="chatNewMessagesButton" onClick={() => scrollToBottom()}>
            <ArrowDown size={15} />
            {t('הודעות חדשות')}
          </button>
        )}
      </div>

      <form className="chatMessageForm" onSubmit={handleSendMessage}>
        <label htmlFor="chat-message" className="visuallyHidden">
          {t('כתיבת הודעה')}
        </label>
        {projectPickerOpen && (
          <div className="chatProjectPicker">
            <header>
              <b>{t('הפניה לפרויקט')}</b>
              <button
                type="button"
                className="iconOnly"
                onClick={() => setProjectPickerOpen(false)}
                aria-label={t('סגירה')}
              >
                <X size={16} />
              </button>
            </header>
            <label className="chatProjectSearch">
              <Search size={16} />
              <input
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
                placeholder={t('חיפוש פרויקט...')}
              />
            </label>
            <div className="chatProjectOptions">
              {filteredProjects.length === 0 && (
                <span className="chatHint">{t('לא נמצאו פרויקטים')}</span>
              )}
              {filteredProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={project.id === selectedProjectId ? 'selected' : ''}
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setProjectPickerOpen(false);
                    setProjectSearch('');
                  }}
                >
                  <FolderKanban size={18} />
                  <span>
                    <b>{project.name}</b>
                    <small>{project.location || project.client_name || t('ללא מיקום')}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {selectedProject && (
          <div className="chatSelectedProject">
            <FolderKanban size={17} />
            <span>
              <small>{t('מצורף לפרויקט')}</small>
              <b>{selectedProject.name}</b>
            </span>
            <button
              type="button"
              onClick={() => setSelectedProjectId(null)}
              aria-label={t('הסרת הפניה לפרויקט')}
            >
              <X size={15} />
            </button>
          </div>
        )}
        {allowProjectReference ? (
          <button
            type="button"
            className={`chatProjectButton ${selectedProject ? 'active' : ''}`}
            onClick={() => setProjectPickerOpen((open) => !open)}
            title={t('הפניה לפרויקט')}
            aria-label={t('הפניה לפרויקט')}
            aria-expanded={projectPickerOpen}
          >
            <FolderKanban size={19} />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <textarea
          id="chat-message"
          ref={textareaRef}
          rows="1"
          maxLength="4000"
          value={messageText}
          placeholder={t('כתבו הודעה...')}
          enterKeyHint={enterSendsMessage() ? 'send' : 'enter'}
          onChange={handleMessageTextChange}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              enterSendsMessage()
            ) {
              event.preventDefault();
              handleSendMessage();
            }
          }}
        />
        <button
          type="submit"
          className="chatSendButton"
          disabled={(!messageText.trim() && !selectedProject) || sending}
          aria-label={t('שליחת הודעה')}
        >
          <SendHorizontal size={19} />
        </button>
      </form>
    </>
  );
}
