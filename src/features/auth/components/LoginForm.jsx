import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../useAuth.js';

export default function LoginForm() {
  const { login, signup, authMessage, authBusy } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [fullName, setFullName] = useState('');

  return (
    <main className="login loginScreen">
      <section className="card">
        <img src="/logo.png" alt="לוגו" />
        <h1>מערכת איתור תשתיות</h1>
        <p className="muted">כניסה מאובטחת עם מייל וסיסמה לעובדי שטח ומנהלים</p>
        <div className="form" style={{ marginTop: 22, textAlign: 'right' }}>
          <label>
            מייל ארגוני
            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            סיסמה
            <span className="loginPasswordField">
              <input
                type={showLoginPassword ? 'text' : 'password'}
                placeholder="לפחות 6 תווים"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="loginPasswordToggle"
                onClick={() => setShowLoginPassword((visible) => !visible)}
                aria-label={showLoginPassword ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
                title={showLoginPassword ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
              >
                {showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </span>
          </label>
          <label>
            שם מלא להרשמה ראשונית
            <input
              placeholder="שם העובד, אופציונלי"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <button disabled={authBusy} onClick={() => login(email, password)}>
            {authBusy ? 'מתחבר…' : 'כניסה למערכת'}
          </button>
          <button disabled={authBusy} className="secondary" onClick={() => signup(email, password, fullName)}>
            הרשמה ראשונית עם סיסמה
          </button>
          <p className="muted">
            למניעת מגבלת מיילים: מומלץ שהמנהל ייצור עובדים דרך Supabase Authentication עם סיסמה קבועה, ואז
            העובד פשוט נכנס כאן.
          </p>
          {authMessage && <p className="muted">{authMessage}</p>}
        </div>
      </section>
    </main>
  );
}
