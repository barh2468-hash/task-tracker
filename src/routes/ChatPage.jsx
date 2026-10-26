import { useEffect, useMemo, useState } from 'react';
import {
  BellOff,
  Check,
  FolderKanban,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { t, useLanguage } from '../features/language/LanguageContext.jsx';
import { localeForLanguage } from '../features/language/locale.js';
import PwaControls from '../features/pwa/components/PwaControls.jsx';
import '../features/chat/chat.css';
import { useAuth } from '../features/auth/useAuth.js';
import { useProjects } from '../features/projects/ProjectsContext.jsx';
import { useChat } from '../features/chat/ChatContext.jsx';
import ChatRoom from '../features/chat/components/ChatRoom.jsx';
import { readDrafts, saveDraft } from '../features/chat/drafts.js';
import { chatEventText } from '../features/chat/chatEvents.js';
import { initials } from '../features/chat/initials.js';
import { roleLabel } from '../services/supabase.js';
import { projectDiscussionPath } from '../utils/navigation.js';

export default function ChatPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useLanguage();
  const locale = localeForLanguage(language);
  const { profile } = useAuth();
  const { workers } = useProjects();
  const {
    conversations,
    chatAvailable,
    chatLoading,
    unreadChatCount,
    projectRooms,
    projectRoomsLoaded,
    projectChatAvailable,
    unreadProjectChatCount,
    createConversation,
    deleteConversation,
  } = useChat();
  const activeConversationId = searchParams.get('conversation');
  // Personal chats and project rooms are kept in separate lists.
  const listView = searchParams.get('view') === 'projects' ? 'projects' : 'personal';
  function updateParams(changes) {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      Object.entries(changes).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      return next;
    });
  }
  function setActiveConversationId(id) {
    updateParams({ conversation: id });
  }
  const [drafts, setDrafts] = useState(() => readDrafts(profile?.id));
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const directory = useMemo(
    () => workers.filter((worker) => worker.id !== profile?.id),
    [profile?.id, workers],
  );
  const profilesById = useMemo(
    () => new Map(workers.map((worker) => [worker.id, worker])),
    [workers],
  );
  const activeConversation = conversations.find((item) => item.id === activeConversationId) || null;

  useEffect(() => {
    setDrafts(readDrafts(profile?.id));
  }, [profile?.id]);

  function conversationName(conversation) {
    if (!conversation) return t('שיחה');
    if (conversation.title) return conversation.title;
    const names = (conversation.member_ids || [])
      .filter((id) => id !== profile?.id)
      .map((id) => profilesById.get(id)?.full_name)
      .filter(Boolean);
    return names.join(', ') || t('שיחה');
  }

  function listDate(value) {
    return value
      ? new Date(value).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
      : '';
  }

  useEffect(() => {
    if (!newChatOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setNewChatOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [newChatOpen]);

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
        updateParams({ conversation: conversationId, view: null });
        setNewChatOpen(false);
      }
    } finally {
      setCreating(false);
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
        setDrafts(saveDraft(profile?.id, activeConversation.id, ''));
        setActiveConversationId(null);
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

  if (!chatAvailable) {
    return (
      <section className="card chatUnavailable">
        <MessageCircle size={34} />
        <h2>{t('הצ׳אט הפנימי עדיין לא הופעל')}</h2>
        <p>{t('יש להריץ את עדכון מסד הנתונים של הצ׳אט ב־Supabase.')}</p>
      </section>
    );
  }

  function renderPersonalList() {
    return (
      <>
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
          // Like WhatsApp: an unsent message shows in place of the last one,
          // except for the chat that is open and already shows it in the box.
          const draft =
            conversation.id !== activeConversationId ? drafts[conversation.id]?.trim() : '';
          return (
            <button
              type="button"
              key={conversation.id}
              className={`chatConversationItem ${conversation.id === activeConversationId ? 'active' : ''} ${unread > 0 ? 'unread' : ''}`}
              aria-current={conversation.id === activeConversationId ? 'true' : undefined}
              onClick={() => setActiveConversationId(conversation.id)}
            >
              <span className="chatAvatar">{initials(name)}</span>
              <span className="chatConversationCopy">
                <span className="chatConversationTopline">
                  <b>{name}</b>
                  <time>{listDate(conversation.last_message_at)}</time>
                </span>
                <span className="chatConversationPreview">
                  <small>
                    {draft ? (
                      <>
                        <span className="chatDraftLabel">{t('טיוטה:')}</span> {draft}
                      </>
                    ) : (
                      conversation.last_message_body || t('שיחה חדשה')
                    )}
                  </small>
                  {unread > 0 && <em>{Math.min(unread, 99)}</em>}
                </span>
              </span>
            </button>
          );
        })}
      </>
    );
  }

  function projectRoomPreview(room) {
    if (room.last_message_kind === 'event') {
      return chatEventText(room.last_event_type, room.last_event_data, t, room.last_message_body);
    }
    const sender =
      room.last_sender_id === profile?.id
        ? t('אני')
        : profilesById.get(room.last_sender_id)?.full_name;
    return sender ? `${sender}: ${room.last_message_body}` : room.last_message_body;
  }

  function renderProjectList() {
    if (!projectChatAvailable) {
      return <p className="chatHint">{t('הדיונים בפרויקטים עדיין לא הופעלו.')}</p>;
    }
    if (!projectRoomsLoaded) return <p className="chatHint">{t('טוען שיחות...')}</p>;
    if (projectRooms.length === 0) {
      return (
        <div className="chatListEmpty">
          <FolderKanban size={28} />
          <b>{t('אין עדכונים חדשים בפרויקטים')}</b>
          <span>{t('כאן יופיעו פרויקטים עם הודעות שלא נקראו או פעילות מהשבועיים האחרונים.')}</span>
        </div>
      );
    }
    return projectRooms.map((room) => {
      const unread = Number(room.unread_count || 0);
      return (
        <button
          type="button"
          key={room.conversation_id}
          className={`chatConversationItem ${unread > 0 && !room.muted ? 'unread' : ''}`}
          onClick={() => navigate(projectDiscussionPath(room.project_id))}
        >
          <span className="chatAvatar" aria-hidden="true">
            <FolderKanban size={19} />
          </span>
          <span className="chatConversationCopy">
            <span className="chatConversationTopline">
              <b dir="auto">{room.project_name}</b>
              <time>{listDate(room.last_message_at)}</time>
            </span>
            <span className="chatConversationPreview">
              <small dir="auto">{projectRoomPreview(room)}</small>
              {room.muted && (
                <BellOff size={13} className="chatMutedIcon" aria-label={t('מושתק')} />
              )}
              {unread > 0 && <em>{Math.min(unread, 99)}</em>}
            </span>
          </span>
        </button>
      );
    });
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

        <div className="chatNotificationControls">
          <p>{t('קבלו התראות על הודעות גם כשהאפליקציה סגורה.')}</p>
          <PwaControls />
        </div>

        <div className="projectSectionTabs chatListTabs" role="tablist" aria-label={t('סוג שיחות')}>
          {[
            ['personal', t('אישי'), unreadChatCount],
            ['projects', t('פרויקטים'), unreadProjectChatCount],
          ].map(([view, label, count]) => (
            <button
              type="button"
              role="tab"
              key={view}
              aria-selected={listView === view}
              className={listView === view ? 'active' : ''}
              onClick={() => updateParams({ view: view === 'projects' ? 'projects' : null })}
            >
              <span>{label}</span>
              {count > 0 && <small>{Math.min(count, 99).toLocaleString(locale)}</small>}
            </button>
          ))}
        </div>

        <div className="chatConversationList">
          {listView === 'projects' ? renderProjectList() : renderPersonalList()}
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
          <ChatRoom
            key={activeConversation.id}
            conversationId={activeConversation.id}
            unreadCount={Number(activeConversation.unread_count || 0)}
            onDraftsChange={setDrafts}
            header={
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
            }
          />
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
