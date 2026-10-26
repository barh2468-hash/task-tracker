import { useEffect, useState } from 'react';
import { Bell, BellOff, FolderKanban, LoaderCircle } from 'lucide-react';
import { t } from '../../language/LanguageContext.jsx';
import { useChat } from '../ChatContext.jsx';
import ChatRoom from './ChatRoom.jsx';
import '../chat.css';

// The project's own chat room, shown in the project's "discussion" tab.
export default function ProjectChatPanel({ project }) {
  const {
    openProjectConversation,
    setConversationMuted,
    projectRoomsByProjectId,
    projectRoomsLoaded,
  } = useChat();
  const [room, setRoom] = useState(null);
  const [failed, setFailed] = useState(false);
  const [togglingMute, setTogglingMute] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRoom(null);
    setFailed(false);
    openProjectConversation(project.id)
      .then((next) => {
        if (!cancelled) setRoom(next);
      })
      .catch((error) => {
        console.warn('Project chat open failed:', error instanceof Error ? error.message : error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function toggleMute() {
    if (!room || togglingMute) return;
    setTogglingMute(true);
    try {
      const muted = !room.muted;
      if (await setConversationMuted(room.conversation_id, muted)) {
        setRoom((current) => ({ ...current, muted }));
      }
    } finally {
      setTogglingMute(false);
    }
  }

  if (failed) {
    return <p className="chatHint">{t('לא ניתן לפתוח את הדיון בפרויקט כרגע.')}</p>;
  }
  if (!room?.conversation_id) {
    return (
      <p className="chatHint" role="status">
        <LoaderCircle size={16} className="spinIcon" /> {t('טוען את הדיון...')}
      </p>
    );
  }

  // Rooms without recent activity are not in the inbox, so nothing is unread.
  const inboxRoom = projectRoomsByProjectId.get(project.id);
  const unreadCount = projectRoomsLoaded ? Number(inboxRoom?.unread_count || 0) : null;

  return (
    <div className="chatRoom open projectChatRoom">
      <ChatRoom
        key={room.conversation_id}
        conversationId={room.conversation_id}
        unreadCount={unreadCount}
        allowProjectReference={false}
        header={
          <header className="chatRoomHeader">
            <span className="chatAvatar" aria-hidden="true">
              <FolderKanban size={19} />
            </span>
            <div>
              <h2>{t('דיון בפרויקט')}</h2>
              <p>
                {Number(room.member_count || 0)} {t('משתתפים')} ·{' '}
                {t('עדכוני הפרויקט מופיעים כאן אוטומטית')}
              </p>
            </div>
            <button
              type="button"
              className={`chatMuteButton ${room.muted ? 'muted' : ''}`}
              onClick={toggleMute}
              disabled={togglingMute}
              aria-pressed={room.muted}
              title={room.muted ? t('ביטול השתקה') : t('השתקת התראות לפרויקט')}
            >
              {room.muted ? <BellOff size={16} /> : <Bell size={16} />}
              <span>{room.muted ? t('מושתק') : t('התראות פעילות')}</span>
            </button>
          </header>
        }
      />
    </div>
  );
}
