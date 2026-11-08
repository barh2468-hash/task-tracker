import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useAuth } from '../useAuth.js';
import './profile-recovery.css';

export default function ProfileRecovery() {
  useTranslation();
  const { retryProfile, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try { await logout(); } catch { /* Keep the recovery screen available. */ }
    finally { setBusy(false); }
  }
  return <main className="appLoading">
    <section className="appLoadingCard" role="alert" aria-labelledby="profile-recovery-title">
      <h1 id="profile-recovery-title">{t('recovery.profileTitle')}</h1>
      <p>{t('recovery.profileHelp')}</p>
      <div className="profileRecoveryActions">
        <button type="button" onClick={retryProfile} disabled={busy}>{t('recovery.retry')}</button>
        <button type="button" className="ghost" onClick={signOut} disabled={busy}>{t('recovery.signOut')}</button>
      </div>
    </section>
  </main>;
}
