import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../useAuth.js';

export default function LoginForm() {
  useTranslation();
  const { login, signup, authMessage, authBusy } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [fullName, setFullName] = useState('');

  return (
    <main className="login loginScreen">
      <section className="card">
        <img src="/logo.png" alt={t('לוגו')} />
        <h1>{t('מערכת איתור תשתיות')}</h1>
        <p className="muted">{t('כניסה מאובטחת עם מייל וסיסמה לעובדי שטח ומנהלים')}</p>
        <div className="form" style={{ marginTop: 22, textAlign: 'right' }}>
          <label>
            {t('מייל ארגוני')}

            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            {t('סיסמה')}

            <span className="loginPasswordField">
              <input
                type={showLoginPassword ? 'text' : 'password'}
                placeholder={t('לפחות 6 תווים')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />

              <button
                type="button"
                className="loginPasswordToggle"
                onClick={() => setShowLoginPassword((visible) => !visible)}
                aria-label={showLoginPassword ? t('הסתרת הסיסמה') : t('הצגת הסיסמה')}
                title={showLoginPassword ? t('הסתרת הסיסמה') : t('הצגת הסיסמה')}
              >
                {showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </span>
          </label>
          <label>
            {t('שם מלא להרשמה ראשונית')}

            <input
              placeholder={t('שם העובד, אופציונלי')}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <button disabled={authBusy} onClick={() => login(email, password)}>
            {authBusy ? t('מתחבר…') : t('כניסה למערכת')}
          </button>
          <button
            disabled={authBusy}
            className="secondary"
            onClick={() => signup(email, password, fullName)}
          >
            {t('הרשמה ראשונית עם סיסמה')}
          </button>
          <p className="muted">
            {t(
              'למניעת מגבלת מיילים: מומלץ שהמנהל ייצור עובדים דרך Supabase Authentication עם סיסמה קבועה, ואז\n            העובד פשוט נכנס כאן.',
            )}
          </p>
          {authMessage && <p className="muted">{authMessage}</p>}
        </div>
      </section>
    </main>
  );
}
