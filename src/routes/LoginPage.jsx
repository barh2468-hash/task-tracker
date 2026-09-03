import { useTranslation } from 'react-i18next';
import { t } from '../features/language/LanguageContext.jsx';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import LoginForm from '../features/auth/components/LoginForm.jsx';

export default function LoginPage() {
  useTranslation();
  const { session, authLoading, profileLoading } = useAuth();

  if (authLoading || profileLoading) return <LoadingScreen />;
  if (session) return <Navigate to="/app" replace />;
  return <LoginForm />;
}

export function LoadingScreen() {
  return (
    <main className="appLoading" role="status" aria-live="polite">
      <section className="appLoadingCard">
        <div className="appLoadingLogo">
          <img src="/logo.png" alt="" />
          <span className="appLoadingSpinner" aria-hidden="true" />
        </div>
        <h1>{t('טוענים את המערכת')}</h1>
        <p>{t('מסנכרנים פרויקטים, עובדים והתראות מ־Supabase…')}</p>
        <div className="appLoadingProgress" aria-hidden="true">
          <span />
        </div>
      </section>
    </main>
  );
}
