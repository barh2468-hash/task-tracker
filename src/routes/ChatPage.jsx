import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BellOff,
  Check,
  EyeOff,
  FolderKanban,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { t, useLanguage } from '../features/language/LanguageContext.jsx';
import { localeForLanguage } from '../features/language/locale.js';
import '../features/projects/project-workspace.css';
import '../features/chat/chat.css';
import { useAuth } from '../features/auth/useAuth.js';
import { useProjects } from '../features/projects/ProjectsContext.jsx';
import { useChat } from '../features/chat/ChatContext.jsx';
import ChatRoom from '../features/chat/components/ChatRoom.jsx';
import DeleteChatDialog from '../features/chat/components/DeleteChatDialog.jsx';
import { useMessage } from '../context/MessageContext.jsx';
import { readDrafts, saveDraft } from '../features/chat/drafts.js';
import { chatEventText } from '../features/chat/chatEvents.js';
import { initials } from '../features/chat/initials.js';
import { roleLabel } from '../services/supabase.js';
import { getStatusClass } from '../components/StatusPill.jsx';
import { projectDiscussionPath } from '../utils/navigation.js';

export default function ChatPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useLanguage();
  const locale = localeForLanguage(language);
  const { profile, isManager } = useAuth();
  const { setMessage } = useMessage();
  const { workers, projects } = useProjects();
  const {
    conversations,
    chatAvailable,
    chatLoading,
    unreadChatCount,
    projectRooms,
    projectRoomsLoaded,
    projectRoomsByProjectId,
    projectChatAvailable,
    unreadProjectChatCount,
    createConversation,
    deleteConversation,
    hideConversation,
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
  const [listQuery, setListQuery] = useState('');
  const searchText = listQuery.trim().toLowerCase();
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  // Hiding needs the same migration as project rooms; until it is applied the
  // option stays out of the menu instead of failing.
  const canHideChats = projectChatAvailable;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  useEffect(() => {
    setChatMenuOpen(false);
    setDeleteDialogOpen(false);
  }, [activeConversationId]);

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

  // Everyone can hide a chat from their own list; it comes back with the next
  // message. Deleting for everyone is for managers only (enforced in the DB).
  async function handleHideConversation() {
    setChatMenuOpen(false);
    if (!activeConversation) return;
    if (await hideConversation(activeConversation.id)) {
      setActiveConversationId(null);
      setMessage(t('השיחה הוסתרה. היא תחזור לרשימה כשתגיע הודעה חדשה.'), 'info');
    }
  }

  async function handleDeleteConversation() {
    if (!activeConversation || deleting) return;
    setDeleting(true);
    try {
      const deleted = await deleteConversation(activeConversation.id);
      if (deleted) {
        setDrafts(saveDraft(profile?.id, activeConversation.id, ''));
        setDeleteDialogOpen(false);
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

  function matchesSearch(...values) {
    return !searchText || values.filter(Boolean).join(' ').toLowerCase().includes(searchText);
  }

  function renderPersonalList() {
    // Groups match by their title or any member's name, direct chats by the
    // other person's name.
    const visibleConversations = conversations.filter((conversation) =>
      matchesSearch(
        conversationName(conversation),
        ...(conversation.member_ids || [])
          .filter((id) => id !== profile?.id)
          .map((id) => profilesById.get(id)?.full_name),
      ),
    );
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
        {conversations.length > 0 && visibleConversations.length === 0 && (
          <p className="chatHint">{t('לא נמצאו שיחות')}</p>
        )}
        {visibleConversations.map((conversation) => {
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

  // Project rooms look like rows of the project list: status-colored edge and
  // an arrow, since they open the project's discussion tab.
  function renderProjectRow(projectId, name, status, room, fallbackPreview) {
    const unread = Number(room?.unread_count || 0);
    return (
      <button
        type="button"
        key={projectId}
        className={`chatConversationItem chatProjectRow status-${getStatusClass(status)} ${unread > 0 && !room?.muted ? 'unread' : ''}`}
        onClick={() => navigate(projectDiscussionPath(projectId))}
      >
        <span className="chatAvatar" aria-hidden="true">
          <FolderKanban size={18} />
        </span>
        <span className="chatConversationCopy">
          <span className="chatConversationTopline">
            <b dir="auto">{name}</b>
            <time>{listDate(room?.last_message_at)}</time>
          </span>
          <span className="chatConversationPreview">
            <small dir="auto">{room ? projectRoomPreview(room) : fallbackPreview}</small>
            {room?.muted && <BellOff size={13} className="chatMutedIcon" aria-label={t('מושתק')} />}
            {unread > 0 && <em>{Math.min(unread, 99)}</em>}
          </span>
        </span>
        <span className="projectListOpenIcon" aria-hidden="true">
          <ArrowLeft size={16} />
        </span>
      </button>
    );
  }

  function renderProjectList() {
    if (!projectChatAvailable) {
      return <p className="chatHint">{t('הדיונים בפרויקטים עדיין לא הופעלו.')}</p>;
    }
    if (!projectRoomsLoaded) return <p className="chatHint">{t('טוען שיחות...')}</p>;

    // Searching covers every project the user can see, not only the inbox,
    // so a quiet project's room is still one search away.
    if (searchText) {
      const matches = projects
        .filter((project) => matchesSearch(project.name, project.location, project.client_name))
        .map((project) => ({ project, room: projectRoomsByProjectId.get(project.id) }))
        .sort(
          (a, b) =>
            Number(Boolean(a.project.is_archived)) - Number(Boolean(b.project.is_archived)) ||
            String(b.room?.last_message_at || '').localeCompare(
              String(a.room?.last_message_at || ''),
            ) ||
            String(a.project.name || '').localeCompare(String(b.project.name || ''), locale),
        )
        .slice(0, 50);
      if (matches.length === 0) return <p className="chatHint">{t('לא נמצאו פרויקטים')}</p>;
      return matches.map(({ project, room }) =>
        renderProjectRow(
          project.id,
          project.name,
          project.status,
          room,
          project.is_archived
            ? t('בארכיון')
            : project.location || project.client_name || t('אין הודעות עדיין'),
        ),
      );
    }

    if (projectRooms.length === 0) {
      return (
        <div className="chatListEmpty">
          <FolderKanban size={28} />
          <b>{t('אין עדכונים חדשים בפרויקטים')}</b>
          <span>{t('כאן יופיעו פרויקטים עם הודעות שלא נקראו או פעילות מהשבועיים האחרונים.')}</span>
        </div>
      );
    }
    return projectRooms.map((room) =>
      renderProjectRow(room.project_id, room.project_name, room.project_status, room),
    );
  }

  return (
    <section className="chatShell">
      <aside
        className={`chatConversationPane ${activeConversation ? 'hasActiveConversation' : ''}`}
      >
        <div className="chatPaneHeader">
          <div className="projectListHeading">
            <h2>{t('צ׳אט פנימי')}</h2>
          </div>
          <button
            type="button"
            className="projectCreateLink"
            onClick={openNewChat}
            title={t('שיחה חדשה')}
          >
            <Plus size={17} />
            <span>{t('שיחה חדשה')}</span>
          </button>
        </div>

        <div className="projectViewLinks chatListTabs" role="tablist" aria-label={t('סוג שיחות')}>
          {[
            ['personal', t('אישי'), unreadChatCount],
            ['projects', t('פרויקטים'), unreadProjectChatCount],
          ].map(([view, label, count]) => (
            <button
              type="button"
              role="tab"
              key={view}
              aria-selected={listView === view}
              className={`projectViewLink${listView === view ? ' active' : ''}`}
              onClick={() => updateParams({ view: view === 'projects' ? 'projects' : null })}
            >
              <span>{label}</span>
              {count > 0 && (
                <span className="projectViewCount">
                  {Math.min(count, 99).toLocaleString(locale)}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="projectListSearch chatListSearch">
          <Search size={17} aria-hidden="true" />
          <input
            value={listQuery}
            onChange={(event) => setListQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setListQuery('');
            }}
            placeholder={
              listView === 'projects' ? t('חיפוש פרויקט...') : t('חיפוש שיחה או עובד...')
            }
            aria-label={t('חיפוש שיחות')}
          />
          {listQuery && (
            <button type="button" onClick={() => setListQuery('')} aria-label={t('ניקוי חיפוש')}>
              <X size={15} />
            </button>
          )}
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
                {(canHideChats || isManager) && (
                  <div
                    className="projectMoreActions chatRoomActions"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget))
                        setChatMenuOpen(false);
                    }}
                  >
                    <button
                      type="button"
                      className="ghost smallBtn projectMoreActionsButton"
                      aria-label={t('פעולות נוספות')}
                      title={t('פעולות נוספות')}
                      aria-haspopup="menu"
                      aria-expanded={chatMenuOpen}
                      onClick={() => setChatMenuOpen((open) => !open)}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {chatMenuOpen && (
                      <div className="projectMoreActionsMenu" role="menu">
                        {canHideChats && (
                          <button type="button" role="menuitem" onClick={handleHideConversation}>
                            <EyeOff size={16} /> {t('הסתרת שיחה')}
                          </button>
                        )}
                        {isManager && (
                          <button
                            type="button"
                            role="menuitem"
                            className="danger"
                            onClick={() => {
                              setChatMenuOpen(false);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 size={16} /> {t('מחיקה לכולם')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </header>
            }
          />
        )}
      </div>

      {deleteDialogOpen && activeConversation && (
        <DeleteChatDialog
          name={conversationName(activeConversation)}
          memberCount={(activeConversation.member_ids || []).length}
          deleting={deleting}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleDeleteConversation}
        />
      )}

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
