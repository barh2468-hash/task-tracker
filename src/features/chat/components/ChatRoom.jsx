import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Camera,
  CircleCheck,
  FileText,
  FolderKanban,
  ListPlus,
  MessageCircle,
  Pencil,
  RefreshCw,
  Reply,
  Search,
  SendHorizontal,
  X,
} from 'lucide-react';
import { t, useLanguage } from '../../language/LanguageContext.jsx';
import { localeForLanguage } from '../../language/locale.js';
import { useAuth } from '../../auth/useAuth.js';
import { useProjects } from '../../projects/ProjectsContext.jsx';
import { useChat } from '../ChatContext.jsx';
import { readDrafts, saveDraft } from '../drafts.js';
import {
  chatEventNote,
  chatEventText,
  isProjectReferenceOnly,
  projectReferenceBody,
} from '../chatEvents.js';
import { firstUnreadIndex } from '../unreadDivider.js';
import { messageReaders } from '../receipts.js';
import { useRealtimeRefresh } from '../../../hooks/useRealtimeRefresh.js';
import MessageBubble from './MessageBubble.jsx';
import '../chat.css';

const NEAR_BOTTOM_PX = 80;
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

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

function previewText(message) {
  if (!message) return t('הודעה קודמת');
  if (message.deleted_at) return t('ההודעה נמחקה');
  const text = isProjectReferenceOnly(message)
    ? `${t('הפניה לפרויקט')}: ${message.project_label || ''}`
    : message.body;
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
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
  const { language } = useLanguage();
  const locale = localeForLanguage(language);
  const { profile } = useAuth();
  const { projects, workers } = useProjects();
  const {
    getMessages,
    getReadStates,
    sendMessage,
    editMessage,
    deleteMessage,
    markConversationRead,
  } = useChat();
  const [messages, setMessages] = useState([]);
  // Messages shown right away while they are saved; "failed" ones stay with a
  // retry until sent or removed. Background refreshes never drop them.
  const [outbox, setOutbox] = useState([]);
  const [readStates, setReadStates] = useState([]);
  const [messageText, setMessageText] = useState(
    () => readDrafts(profile?.id)[conversationId] || '',
  );
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [unreadMarker, setUnreadMarker] = useState(null);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const messagesContainerRef = useRef(null);
  const unreadDividerRef = useRef(null);
  const textareaRef = useRef(null);
  const draftBeforeEditRef = useRef('');
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
  const messagesById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );
  const displayed = useMemo(() => [...messages, ...outbox], [messages, outbox]);
  // Reply, edit and delete need the message-actions migration; its columns
  // show up on loaded messages once it is applied.
  const actionsAvailable = messages.some((message) => 'edited_at' in message);
  const selectedProject = projectsById.get(selectedProjectId) || null;

  function nameOf(userId) {
    return userId === profile?.id ? t('אני') : profilesById.get(userId)?.full_name || t('משתמש');
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function loadMessages() {
    try {
      const [next, states] = await Promise.all([
        getMessages(conversationId),
        getReadStates(conversationId).catch(() => null),
      ]);
      if (!mountedRef.current) return;
      setMessages(next);
      if (states) setReadStates(states);
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

  // chat_members changes when someone reads, which updates "seen by".
  useRealtimeRefresh({
    enabled: Boolean(conversationId),
    channelName: `infrastructure-tracker-chat-room-${profile?.id || 'guest'}`,
    tables: ['chat_messages', 'chat_members'],
    onRefresh: loadMessages,
    pollIntervalMs: 5000,
  });

  const unreadIndex = useMemo(
    () => firstUnreadIndex(displayed, unreadMarker || 0, profile?.id),
    [displayed, unreadMarker, profile?.id],
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
    const last = displayed.at(-1);
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
  }, [displayed, unreadMarker]);

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
    // An edit in progress is not a draft of a new message.
    if (!editing) updateDraft(event.target.value);
  }

  function markReadAfterSending(createdAt) {
    if (document.visibilityState === 'visible' && document.hasFocus()) {
      void markConversationRead(conversationId, createdAt);
    }
  }

  async function deliver(item) {
    const sent = await sendMessage(conversationId, item.typed, item.project, {
      replyToId: item.reply_to_id,
      quiet: true,
    });
    if (!mountedRef.current) return;
    if (sent) {
      setMessages((items) =>
        items.some((entry) => entry.id === sent.id) ? items : [...items, sent],
      );
      setOutbox((items) => items.filter((entry) => entry.id !== item.id));
      markReadAfterSending(sent.created_at);
    } else {
      setOutbox((items) =>
        items.map((entry) => (entry.id === item.id ? { ...entry, status: 'failed' } : entry)),
      );
    }
  }

  function retry(item) {
    const again = { ...item, status: 'sending' };
    setOutbox((items) => items.map((entry) => (entry.id === item.id ? again : entry)));
    void deliver(again);
  }

  function discard(item) {
    setOutbox((items) => items.filter((entry) => entry.id !== item.id));
  }

  function startReply(message) {
    if (editing) cancelEdit();
    setReplyTo(message);
    textareaRef.current?.focus();
  }

  function startEdit(message) {
    draftBeforeEditRef.current = messageText;
    setReplyTo(null);
    setSelectedProjectId(null);
    setProjectPickerOpen(false);
    setEditing(message);
    setMessageText(isProjectReferenceOnly(message) ? '' : message.body);
    textareaRef.current?.focus();
  }

  function cancelEdit() {
    setEditing(null);
    setMessageText(draftBeforeEditRef.current);
  }

  async function saveEdit() {
    const body = messageText.trim();
    if (!body || savingEdit) return;
    if (body === editing.body) {
      cancelEdit();
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await editMessage(editing.id, body);
      if (updated && mountedRef.current) {
        setMessages((items) =>
          items.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)),
        );
        cancelEdit();
      }
    } finally {
      if (mountedRef.current) setSavingEdit(false);
    }
  }

  async function removeMessage(message) {
    const updated = await deleteMessage(message.id);
    if (!updated || !mountedRef.current) return;
    setMessages((items) =>
      items.map((entry) => (entry.id === updated.id ? { ...entry, ...updated } : entry)),
    );
    if (replyTo?.id === message.id) setReplyTo(null);
    if (editing?.id === message.id) cancelEdit();
  }

  function jumpTo(messageId) {
    const container = messagesContainerRef.current;
    const target = document.getElementById(`chat-message-${messageId}`);
    if (!container || !target) return;
    container.scrollTop +=
      target.getBoundingClientRect().top - container.getBoundingClientRect().top - 40;
    setHighlightId(messageId);
    window.setTimeout(() => {
      if (mountedRef.current) setHighlightId(null);
    }, 1600);
  }

  function handleSendMessage(event) {
    event?.preventDefault();
    if (editing) {
      void saveEdit();
      return;
    }
    const typed = messageText.trim();
    if (!typed && !selectedProject) return;
    const project = selectedProject
      ? { id: selectedProject.id, label: selectedProject.name }
      : null;
    const item = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      conversation_id: conversationId,
      sender_id: profile?.id,
      body: typed || projectReferenceBody(project.label),
      project_id: project?.id || null,
      project_label: project?.label || null,
      reply_to_id: actionsAvailable ? replyTo?.id || null : null,
      created_at: new Date().toISOString(),
      status: 'sending',
      typed,
      project,
    };
    setOutbox((items) => [...items, item]);
    setMessageText('');
    updateDraft('');
    setSelectedProjectId(null);
    setProjectPickerOpen(false);
    setProjectSearch('');
    setReplyTo(null);
    textareaRef.current?.focus();
    void deliver(item);
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

  function renderMessage(message) {
    const mine = message.sender_id === profile?.id;
    const local = Boolean(message.status);
    const original = message.reply_to_id ? messagesById.get(message.reply_to_id) : null;
    let receipts = null;
    if (mine && !local) {
      const readers = messageReaders(message, readStates);
      receipts = {
        readByAll: readers.readByAll,
        readerNames: readers.readerIds.map(nameOf),
        waitingNames: readers.waitingIds.map(nameOf),
      };
    }
    return (
      <MessageBubble
        message={message}
        mine={mine}
        senderName={mine ? profile?.full_name : profilesById.get(message.sender_id)?.full_name}
        senderColor={senderColor(message.sender_id)}
        referencedProject={projectsById.get(message.project_id)}
        quoted={
          message.reply_to_id
            ? {
                id: original?.id || null,
                senderName: original ? nameOf(original.sender_id) : '',
                text: previewText(original),
              }
            : null
        }
        receipts={receipts}
        locale={locale}
        highlighted={highlightId === message.id}
        canReply={actionsAvailable && !local}
        canEdit={
          actionsAvailable &&
          mine &&
          !local &&
          Date.now() - Date.parse(message.created_at) < EDIT_WINDOW_MS
        }
        canDelete={actionsAvailable && mine && !local}
        menuOpen={menuFor === message.id}
        onMenuChange={(open) => setMenuFor(open ? message.id : null)}
        onReply={() => startReply(message)}
        onEdit={() => startEdit(message)}
        onDelete={() => removeMessage(message)}
        onRetry={() => retry(message)}
        onDiscard={() => discard(message)}
        onJumpTo={jumpTo}
      />
    );
  }

  const canSend = editing
    ? Boolean(messageText.trim()) && !savingEdit
    : Boolean(messageText.trim() || selectedProject);

  return (
    <>
      {header}

      <div
        className="chatMessages"
        aria-live="polite"
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
      >
        {displayed.length === 0 && (
          <div className="chatFirstMessage">
            <MessageCircle size={28} />
            <b>{t('זו תחילת השיחה')}</b>
            <span>{t('שלחו הודעה ראשונה למשתתפים.')}</span>
          </div>
        )}
        {displayed.map((message, index) => {
          const createdAt = new Date(message.created_at);
          const showDate =
            !index ||
            createdAt.toDateString() !== new Date(displayed[index - 1].created_at).toDateString();
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
              {message.kind === 'event' ? renderEvent(message, createdAt) : renderMessage(message)}
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
        {replyTo && (
          <div className="chatSelectedProject chatComposerContext">
            <Reply size={17} />
            <span>
              <small>{t('תשובה ל{{value0}}', { value0: nameOf(replyTo.sender_id) })}</small>
              <b dir="auto">{previewText(replyTo)}</b>
            </span>
            <button type="button" onClick={() => setReplyTo(null)} aria-label={t('ביטול תשובה')}>
              <X size={15} />
            </button>
          </div>
        )}
        {editing && (
          <div className="chatSelectedProject chatComposerContext">
            <Pencil size={17} />
            <span>
              <small>{t('עריכת הודעה')}</small>
              <b dir="auto">{previewText(editing)}</b>
            </span>
            <button type="button" onClick={cancelEdit} aria-label={t('ביטול עריכה')}>
              <X size={15} />
            </button>
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
        {allowProjectReference && !editing ? (
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
          placeholder={editing ? t('עריכת ההודעה...') : t('כתבו הודעה...')}
          enterKeyHint={enterSendsMessage() ? 'send' : 'enter'}
          onChange={handleMessageTextChange}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              if (editing) cancelEdit();
              else if (replyTo) setReplyTo(null);
              return;
            }
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
          disabled={!canSend}
          aria-label={editing ? t('שמירת השינוי') : t('שליחת הודעה')}
        >
          <SendHorizontal size={19} />
        </button>
      </form>
    </>
  );
}
