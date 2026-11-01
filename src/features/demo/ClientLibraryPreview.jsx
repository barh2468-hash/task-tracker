import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth.js';
import { t } from '../language/LanguageContext.jsx';
import { listShowcases } from './api.js';
import { DemoPortalView } from './DemoPortal.jsx';

export default function ClientLibraryPreview() {
  useTranslation();
  const { isManager, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!isManager) return;
    let active = true;
    setLoading(true); setError(false);
    listShowcases().then((rows) => { if (active) setProjects(rows); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isManager, revision]);
  if (!isManager) return <Navigate to="/app/projects" replace />;
  return <>
    <div className="caseLibraryPreviewBar"><span>{t('caseStudy.draftPreview')}</span>
      <button type="button" className="secondary" onClick={() => navigate('/app/users')}>{t('caseStudy.backManagement')}</button>
    </div>
    <DemoPortalView projects={projects} loading={loading} error={error} onReload={() => setRevision((value) => value + 1)}
      profile={profile} onLogout={logout} />
  </>;
}
