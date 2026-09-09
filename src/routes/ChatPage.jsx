import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ExternalLink,
  FolderKanban,
  MessageCircle,
  Plus,
  Search,
  SendHorizontal,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { t } from '../features/language/LanguageContext.jsx';
import { useAuth } from '../features/auth/useAuth.js';
import { useProjects } from '../features/projects/ProjectsContext.jsx';
import { useChat } from '../features/chat/ChatContext.jsx';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh.js';
import { roleLabel } from '../services/supabase.js';
import { projectDeepLinkPath } from '../utils/navigation.js';

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { projects, workers } = useProjects();
  const {
    conversations,
    chatAvailable,
    chatLoading,
    createConversation,
    deleteConversation,
    getMessages,
    sendMessage,
    markConversationRead,
  } = useChat();
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const messagesEndRef = useRef(null);

  const directory = useMemo(
    () => workers.filter((worker) => worker.id !== profile?.id),
    [profile?.id, workers],
  );
  const profilesById = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    [workers],
  );
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const selectedProject = projectsById.get(selectedProjectId) || null;
  const activeConversation = conversations.find((item) => item.id === activeConversationId) || null;

  function conversationName(conversation) {
    if (!conversation) return t('שיחה');
    if (conversation.title) return conversation.title;
    const names = (conversation.member_ids || [])
      .filter((id) => id !== profile?.id)
      .map((id) => profilesById.get(id)?.full_name)
      .filter(Boolean);
    return names.join(', ') || t('שיחה');
  }

  async function loadActiveMessages() {
    if (!activeConversationId || !chatAvailable) {
      setMessages([]);
      return;
    }
    try {
      setMessages(await getMessages(activeConversationId));
      await markConversationRead(activeConversationId);
    } catch (error) {
      console.warn('Messages load failed:', error instanceof Error ? error.message : error);
    }
  }

  useEffect(() => {
    if (activeConversationId && !conversations.some((item) => item.id === activeConversationId)) {
      setActiveConversationId(null);
    }
  }, [activeConversationId, conversations]);

  useEffect(() => {
    setSelectedProjectId(null);
    setProjectPickerOpen(false);
    setProjectSearch('');
  }, [activeConversationId]);

  useEffect(() => {
    if (!newChatOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setNewChatOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [newChatOpen]);

  useEffect(() => {
    loadActiveMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, chatAvailable]);

  useRealtimeRefresh({
    enabled: Boolean(activeConversationId && chatAvailable),
    channelName: `infrastructure-tracker-chat-${profile?.id || 'guest'}`,
    tables: ['chat_messages'],
    onRefresh: loadActiveMessages,
    pollIntervalMs: 5000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  function openNewChat() {
    setSelectedMemberIds([]);
    setMemberSearch('');
    setGroupTitle('');
    setNewChatOpen(true);
  }

  function toggleMember(memberId) {
    setSelectedMemberIds((items) =>
      items.includes(memberId) ? items.filter((id) => id !== memberId) : [...items, memberId],
    );
  }

  async function handleCreateConversation(event) {
    event.preventDefault();
    if (!selectedMemberIds.length || creating) return;
    setCreating(true);
    try {
      const conversationId = await createConversation(
        selectedMemberIds,
        selectedMemberIds.length > 1 ? groupTitle : '',
      );
      if (conversationId) {
        setActiveConversationId(conversationId);
        setNewChatOpen(false);
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleSendMessage(event) {
    event?.preventDefault();
    const body = messageText.trim();
    if ((!body && !selectedProject) || !activeConversationId || sending) return;
    setSending(true);
    try {
      const projectReference = selectedProject
        ? {
            id: selectedProject.id,
            label: selectedProject.name,
          }
        : null;
      const sent = await sendMessage(activeConversationId, body, projectReference);
      if (sent) {
        setMessages((items) => [...items, sent]);
        setMessageText('');
        setSelectedProjectId(null);
        setProjectPickerOpen(false);
        setProjectSearch('');
        await markConversationRead(activeConversationId);
      }
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteConversation() {
    if (!activeConversation || deleting) return;
    const confirmed = window.confirm(
      `${t('למחוק את השיחה')} "${conversationName(activeConversation)}"?\n${t(
        'השיחה וכל ההודעות יימחקו אצל כל המשתתפים.',
      )}`,
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const deleted = await deleteConversation(activeConversation.id);
      if (deleted) {
        setActiveConversationId(null);
        setMessages([]);
        setMessageText('');
      }
    } finally {
      setDeleting(false);
    }
  }

  const filteredDirectory = directory.filter((worker) =>
    `${worker.full_name || ''} ${t(roleLabel[worker.role] || worker.role || '')}`
      .toLowerCase()
      .includes(memberSearch.trim().toLowerCase()),
  );
  const filteredProjects = projects
    .filter((project) => !project.is_archived)
    .filter((project) =>
      `${project.name || ''} ${project.client_name || ''} ${project.location || ''}`
        .toLowerCase()
        .includes(projectSearch.trim().toLowerCase()),
    );

  if (!chatAvailable) {
    return (
      <section className="card chatUnavailable">
        <MessageCircle size={34} />
        <h2>{t('הצ׳אט הפנימי עדיין לא הופעל')}</h2>
        <p>{t('יש להריץ את עדכון מסד הנתונים של הצ׳אט ב־Supabase.')}</p>
      </section>
    );
  }

  return (
    <section className="chatShell">
      <aside
        className={`chatConversationPane ${activeConversation ? 'hasActiveConversation' : ''}`}
      >
        <div className="chatPaneHeader">
          <div>
            <span className="eyebrow">TEAM CHAT</span>
            <h2>{t('צ׳אט פנימי')}</h2>
          </div>
          <button type="button" onClick={openNewChat} title={t('שיחה חדשה')}>
            <Plus size={18} />
            <span>{t('חדש')}</span>
          </button>
        </div>

        <div className="chatConversationList">
          {chatLoading && conversations.length === 0 && (
            <p className="chatHint">{t('טוען שיחות...')}</p>
          )}
          {!chatLoading && conversations.length === 0 && (
            <div className="chatListEmpty">
              <MessageCircle size={28} />
              <b>{t('עדיין אין שיחות')}</b>
              <span>{t('פתחו שיחה עם עובד אחד או עם קבוצה.')}</span>
            </div>
          )}
          {conversations.map((conversation) => {
            const name = conversationName(conversation);
            const unread = Number(conversation.unread_count || 0);
            return (
              <button
                type="button"
                key={conversation.id}
                className={`chatConversationItem ${conversation.id === activeConversationId ? 'active' : ''}`}
                onClick={() => setActiveConversationId(conversation.id)}
              >
                <span className="chatAvatar">{initials(name)}</span>
                <span className="chatConversationCopy">
                  <span className="chatConversationTopline">
                    <b>{name}</b>
                    <time>
                      {conversation.last_message_at
                        ? new Date(conversation.last_message_at).toLocaleDateString('he-IL', {
                            day: '2-digit',
                            month: '2-digit',
                          })
                        : ''}
                    </time>
                  </span>
                  <span className="chatConversationPreview">
                    <small>{conversation.last_message_body || t('שיחה חדשה')}</small>
                    {unread > 0 && <em>{Math.min(unread, 99)}</em>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className={`chatRoom ${activeConversation ? 'open' : ''}`}>
        {!activeConversation ? (
          <div className="chatRoomEmpty">
            <span>
              <MessageCircle size={40} />
            </span>
            <h2>{t('בחרו שיחה כדי להתחיל')}</h2>
            <p>{t('אפשר לשלוח הודעה לעובד אחד או לפתוח קבוצה עם כמה עובדים.')}</p>
            <button type="button" onClick={openNewChat}>
              <Plus size={18} /> {t('שיחה חדשה')}
            </button>
          </div>
        ) : (
          <>
            <header className="chatRoomHeader">
              <button
                type="button"
                className="chatBackButton"
                onClick={() => setActiveConversationId(null)}
                aria-label={t('חזרה לרשימת השיחות')}
              >
                <span aria-hidden="true">‹</span>
              </button>
              <span className="chatAvatar">{initials(conversationName(activeConversation))}</span>
              <div>
                <h2>{conversationName(activeConversation)}</h2>
                <p>
                  {(activeConversation.member_ids || []).length} {t('משתתפים')}
                </p>
              </div>
              <button
                type="button"
                className="chatDeleteButton"
                onClick={handleDeleteConversation}
                disabled={deleting}
                title={t('מחיקת שיחה')}
                aria-label={t('מחיקת שיחה')}
              >
                <Trash2 size={17} />
                <span>{deleting ? t('מוחק...') : t('מחק')}</span>
              </button>
            </header>

            <div className="chatMessages" aria-live="polite">
              {messages.length === 0 && (
                <div className="chatFirstMessage">
                  <MessageCircle size={28} />
                  <b>{t('זו תחילת השיחה')}</b>
                  <span>{t('שלחו הודעה ראשונה למשתתפים.')}</span>
                </div>
              )}
              {messages.map((message) => {
                const mine = message.sender_id === profile?.id;
                const sender = mine ? profile : profilesById.get(message.sender_id);
                const referencedProject = projectsById.get(message.project_id);
                return (
                  <article key={message.id} className={`chatBubble ${mine ? 'mine' : ''}`}>
                    {!mine && <b>{sender?.full_name || t('משתמש')}</b>}
                    <p>{message.body}</p>
                    {message.project_id && (
                      <button
                        type="button"
                        className="chatProjectReference"
                        onClick={() =>
                          navigate(projectDeepLinkPath(message.project_id))
                        }
                      >
                        <FolderKanban size={20} />
                        <span>
                          <small>{t('הפניה לפרויקט')}</small>
                          <strong>
                            {referencedProject?.name || message.project_label || t('פרויקט')}
                          </strong>
                        </span>
                        <ExternalLink size={15} />
                      </button>
                    )}
                    <time>
                      {new Date(message.created_at).toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </article>
                );
              })}
              <div ref={messagesEndRef} />
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
              <textarea
                id="chat-message"
                rows="1"
                maxLength="4000"
                value={messageText}
                placeholder={t('כתבו הודעה...')}
                onChange={(event) => setMessageText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
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
        )}
      </div>

      {newChatOpen && (
        <div className="chatNewBackdrop" role="presentation">
          <form
            className="chatNewDialog"
            onSubmit={handleCreateConversation}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-chat-title"
          >
            <header>
              <div>
                <h2 id="new-chat-title">{t('שיחה חדשה')}</h2>
                <p>{t('בחרו עובד אחד או כמה עובדים לשיחה קבוצתית.')}</p>
              </div>
              <button
                type="button"
                className="iconOnly"
                onClick={() => setNewChatOpen(false)}
                aria-label={t('סגירה')}
              >
                <X size={18} />
              </button>
            </header>

            <label className="chatMemberSearch">
              <Search size={17} />
              <input
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                placeholder={t('חיפוש עובדים...')}
                aria-label={t('חיפוש עובדים')}
              />
            </label>

            <div className="chatMemberList">
              {filteredDirectory.length === 0 && <p className="chatHint">{t('לא נמצאו עובדים')}</p>}
              {filteredDirectory.map((worker) => {
                const selected = selectedMemberIds.includes(worker.id);
                return (
                  <button
                    type="button"
                    key={worker.id}
                    className={`chatMemberOption ${selected ? 'selected' : ''}`}
                    onClick={() => toggleMember(worker.id)}
                    aria-pressed={selected}
                  >
                    <span className="chatMemberCheck">{selected && <Check size={15} />}</span>
                    <span className="chatAvatar">{initials(worker.full_name)}</span>
                    <span>
                      <b>{worker.full_name}</b>
                      <small>{t(roleLabel[worker.role] || worker.role)}</small>
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedMemberIds.length > 1 && (
              <label>
                {t('שם הקבוצה, אופציונלי')}
                <input
                  maxLength="120"
                  value={groupTitle}
                  onChange={(event) => setGroupTitle(event.target.value)}
                  placeholder={t('לדוגמה: צוות שטח צפון')}
                />
              </label>
            )}

            <footer>
              <span>
                <Users size={16} /> {selectedMemberIds.length} {t('נבחרו')}
              </span>
              <button type="submit" disabled={!selectedMemberIds.length || creating}>
                <MessageCircle size={17} />
                {creating ? t('פותח שיחה...') : t('פתח שיחה')}
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}
