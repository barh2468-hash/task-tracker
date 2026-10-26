import { ExternalLink, FolderKanban, MapPin, Navigation, Phone, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../language/LanguageContext.jsx';
import StatusPill from '../../../components/StatusPill.jsx';
import { projectDeepLinkPath } from '../../../utils/navigation.js';
import { navigationLink, phoneLink } from '../../../utils/format.js';

// A project linked in a message: what it is and where, plus one-tap
// navigation and a call to the site contact. `project` is the reader's own
// copy of the project, missing when they are not assigned to it; then only
// the saved label is shown and opening it explains the missing access.
export default function ProjectReferenceCard({ projectId, label, project }) {
  const navigate = useNavigate();
  const name = project?.name || label || t('פרויקט');
  const directions = navigationLink(project?.location);
  const call = phoneLink(project?.contact_phone);
  const owner = project?.profiles?.full_name;

  return (
    <div className="chatProjectCard">
      <button
        type="button"
        className="chatProjectCardMain"
        onClick={() => navigate(projectDeepLinkPath(projectId))}
        aria-label={t('פתיחת פרויקט {{name}}', { name })}
      >
        <span className="chatProjectCardIcon" aria-hidden="true">
          <FolderKanban size={18} />
        </span>
        <span className="chatProjectCardCopy">
          <span className="chatProjectCardTopline">
            <small>{t('הפניה לפרויקט')}</small>
            {project?.status && <StatusPill status={project.status} />}
            {project?.is_archived && <span className="archiveBadge">{t('בארכיון')}</span>}
          </span>
          <strong dir="auto">{name}</strong>
          {project?.location && (
            <span className="chatProjectCardMeta">
              <MapPin size={12} aria-hidden="true" />
              <bdi>{project.location}</bdi>
            </span>
          )}
          {owner && (
            <span className="chatProjectCardMeta">
              <UserRound size={12} aria-hidden="true" />
              <bdi>{owner}</bdi>
            </span>
          )}
        </span>
        <ExternalLink size={15} className="chatProjectCardOpen" aria-hidden="true" />
      </button>
      {(directions || call) && (
        <div className="chatProjectCardActions">
          {directions && (
            <a href={directions} target="_blank" rel="noopener noreferrer">
              <Navigation size={14} aria-hidden="true" /> {t('ניווט')}
            </a>
          )}
          {call && (
            <a href={call}>
              <Phone size={14} aria-hidden="true" /> {t('חיוג לאיש קשר')}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
