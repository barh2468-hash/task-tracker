import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Car, CheckCircle, LogOut, X } from 'lucide-react';
import { t } from '../features/language/LanguageContext.jsx';
import { useAuth } from '../features/auth/useAuth.js';
import { MessageProvider, useMessage } from '../context/MessageContext.jsx';

function FleetLayoutContent() {
  useTranslation();
  const { profile, logout } = useAuth();
  const { message, setMessage } = useMessage();

  return (
    <div className="accountingLayout">
      <header className="accountingHeader">
        <div className="accountingHeaderBrand">
          <img src="/logo.png" alt={t('לוגו')} />
          <div>
            <h1>{t('ניהול רכבים')}</h1>
            <span>{profile?.full_name || ''}</span>
          </div>
        </div>
        <button className="secondary" onClick={logout}>
          <LogOut size={16} /> {t('יציאה')}
        </button>
      </header>

      <nav className="accountingTabs">
        <NavLink to="/app/vehicles" className={({ isActive }) => `accountingTab${isActive ? ' active' : ''}`}>
          <Car size={16} /> {t('רכבי חברה')}
        </NavLink>
      </nav>

      <main className="accountingContent">
        {message && (
          <div className="appToast" role="status" aria-live="polite">
            <span className="appToastIcon">
              <CheckCircle size={18} />
            </span>
            <p>{message}</p>
            <button className="appToastClose" onClick={() => setMessage('')} aria-label={t('סגירת הודעה')}>
              <X size={16} />
            </button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}

export default function FleetLayout() {
  return (
    <MessageProvider>
      <FleetLayoutContent />
    </MessageProvider>
  );
}
