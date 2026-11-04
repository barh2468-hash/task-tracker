import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Car, LogOut, CalendarClock, FileSpreadsheet, Fuel, MapPin, Mountain, Route, X } from 'lucide-react';
import { t } from '../features/language/LanguageContext.jsx';
import { useAuth } from '../features/auth/useAuth.js';
import { MessageProvider, useMessage } from '../context/MessageContext.jsx';

function AccountingLayoutContent() {
  useTranslation();
  const { profile, logout, isAccountingMain } = useAuth();
  const { message, setMessage } = useMessage();

  return (
    <div className="accountingLayout">
      <header className="accountingHeader">
        <div className="accountingHeaderBrand">
          <img src="/logo.png" alt={t('לוגו')} />
          <div>
            <h1>{t('הנהלת חשבונות')}</h1>
            <span>{profile?.full_name || ''}</span>
          </div>
        </div>
        <button className="secondary" onClick={logout}>
          <LogOut size={16} /> {t('יציאה')}
        </button>
      </header>

      <nav className="accountingTabs">
        {isAccountingMain && (
          <NavLink to="/app/accounting/year-end" className={({ isActive }) => `accountingTab${isActive ? ' active' : ''}`}>
            <FileSpreadsheet size={16} /> {t('טבלת סוף שנה')}
          </NavLink>
        )}
        {isAccountingMain && (
          <NavLink to="/app/accounting/payments" className={({ isActive }) => `accountingTab${isActive ? ' active' : ''}`}>
            <CalendarClock size={16} /> {t('מעקב תשלומים')}
          </NavLink>
        )}
        <NavLink to="/app/accounting/fuel" className={({ isActive }) => `accountingTab${isActive ? ' active' : ''}`}>
          <Fuel size={16} /> {t('דלק — יבוא לסאפ')}
        </NavLink>
        <NavLink to="/app/accounting/tolls" className={({ isActive }) => `accountingTab${isActive ? ' active' : ''}`}>
          <Route size={16} /> {t('כביש 6 — יבוא לסאפ')}
        </NavLink>
        <NavLink to="/app/accounting/ituran" className={({ isActive }) => `accountingTab${isActive ? ' active' : ''}`}>
          <MapPin size={16} /> {t('איתוראן — יבוא לסאפ')}
        </NavLink>
        <NavLink to="/app/accounting/carmel" className={({ isActive }) => `accountingTab${isActive ? ' active' : ''}`}>
          <Mountain size={16} /> {t('מנהרות הכרמל — יבוא לסאפ')}
        </NavLink>
        <NavLink to="/app/my-vehicle" className={({ isActive }) => `accountingTab${isActive ? ' active' : ''}`}>
          <Car size={16} /> {t('הרכב שלי')}
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

export default function AccountingLayout() {
  return (
    <MessageProvider>
      <AccountingLayoutContent />
    </MessageProvider>
  );
}
