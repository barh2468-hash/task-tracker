import { useTranslation } from 'react-i18next';
import { t } from '../../language/LanguageContext.jsx';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../useAuth.js';

export default function LoginForm({ passwordReset = false }) {
  useTranslation();
  const { login, authMessage, authBusy } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  return (
    <main className="login loginScreen">
      <section className="card">
        <img src="/logo.png" alt={t('לוגו')} />
        <h1>{t('מערכת איתור תשתיות')}</h1>
        <p className="muted">{t('clientLogin.subtitle')}</p>
        <form
          className="form"
          style={{ marginTop: 22 }}
          onSubmit={(event) => {
            event.preventDefault();
            login(email, password);
          }}
        >
          {passwordReset && (
            <p className="authMessage success" role="status">
              {t('הסיסמה עודכנה בהצלחה. כעת ניתן להתחבר באמצעות הסיסמה החדשה.')}
            </p>
          )}
          <label>
            {t('clientLogin.identifier')}

            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              dir="ltr"
              required
              placeholder={t('clientLogin.placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            {t('סיסמה')}

            <span className="loginPasswordField">
              <input
                type={showLoginPassword ? 'text' : 'password'}
                placeholder={t('סיסמה')}
                required
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
          <button type="submit" className="loginSubmit" disabled={authBusy}>
            {authBusy ? t('מתחבר…') : t('כניסה למערכת')}
          </button>
          <Link className="authTextLink" to="/forgot-password">
            {t('שכחתי סיסמה')}
          </Link>
          <p className="muted">{t('clientLogin.recoveryHelp')}</p>
          {authMessage && (
            <p className="muted" role="status">
              {t(authMessage)}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
