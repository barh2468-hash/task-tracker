import { createContext, useEffect, useRef, useState } from 'react';
import { envReady } from '../../services/supabase.js';
import { translateAuthError } from '../../utils/authErrors.js';
import * as authFeatureApi from './api.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(envReady);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const sessionUserIdRef = useRef(null);

  // Session bootstrap: initial getSession() + onAuthStateChange subscription,
  // with a 15s timeout fallback in case the Supabase connection hangs.
  useEffect(() => {
    if (!envReady) return;
    let active = true;
    const authTimeout = window.setTimeout(() => {
      if (!active) return;
      setAuthLoading(false);
      setProfileLoading(false);
      setAuthMessage('החיבור מתעכב. בדוק את החיבור לאינטרנט ונסה לרענן את העמוד.');
    }, 15000);

    authFeatureApi.getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        sessionUserIdRef.current = data.session?.user?.id ?? null;
        setProfileLoading(Boolean(data.session?.user));
        setSession(data.session);
      })
      .catch((error) => {
        if (!active) return;
        setAuthMessage(error instanceof Error ? error.message : 'החיבור למערכת נכשל. נסה שוב.');
      })
      .finally(() => {
        if (!active) return;
        window.clearTimeout(authTimeout);
        setAuthLoading(false);
      });

    const { data: sub } = authFeatureApi.onAuthStateChange((event, s) => {
      if (!active) return;
      window.clearTimeout(authTimeout);
      const nextUserId = s?.user?.id ?? null;
      const userChanged = nextUserId !== sessionUserIdRef.current;
      sessionUserIdRef.current = nextUserId;
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && userChanged) {
        setProfileLoading(Boolean(s?.user));
      } else if (event === 'SIGNED_OUT') {
        setProfileLoading(false);
      }
      setSession(s);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      window.clearTimeout(authTimeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  // Resolve/auto-provision the profile whenever the logged-in user changes.
  useEffect(() => {
    if (!session?.user) {
      setProfileLoading(false);
      return;
    }
    let active = true;
    const dataTimeout = window.setTimeout(() => {
      if (!active) return;
      setProfileLoading(false);
      setAuthMessage('טעינת הנתונים מתעכבת. בדוק את החיבור ונסה לרענן את העמוד.');
    }, 15000);
    setProfileLoading(true);

    (async () => {
      try {
        const user = session.user;
        const { profile: prof, error } = await authFeatureApi.getOrCreateProfile(user);
        if (!active) return;
        if (!prof) {
          setProfile(null);
          setAuthMessage(error?.message || 'לא נמצא פרופיל למשתמש המחובר. בדוק את טבלת profiles ואת הרשאות RLS.');
          return;
        }
        setProfile(prof);
        setAuthMessage('');
      } catch (error) {
        if (active) setAuthMessage(error instanceof Error ? error.message : 'טעינת הנתונים נכשלה.');
      } finally {
        if (active) {
          window.clearTimeout(dataTimeout);
          setProfileLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      window.clearTimeout(dataTimeout);
    };
    // Intentionally keyed on the user id only, not the whole session object,
    // so a token refresh doesn't re-trigger profile resolution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function login(email, password) {
    setAuthMessage('');
    if (!email || !password) {
      setAuthMessage('יש למלא מייל וסיסמה.');
      return;
    }
    if (authBusy) return;
    setAuthBusy(true);
    try {
      const { error } = await authFeatureApi.signIn(email, password);
      setAuthMessage(error ? translateAuthError(error.message) : 'התחברת בהצלחה.');
    } catch (error) {
      setAuthMessage(error?.name === 'AbortError' ? 'החיבור ארך זמן רב מדי. בדוק אינטרנט ונסה שוב.' : 'לא ניתן להתחבר כרגע. בדוק אינטרנט ונסה שוב.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function signup(email, password, fullName) {
    setAuthMessage('');
    if (!email || !password) {
      setAuthMessage('יש למלא מייל וסיסמה.');
      return;
    }
    if (password.length < 6) {
      setAuthMessage('הסיסמה חייבת להכיל לפחות 6 תווים.');
      return;
    }
    if (authBusy) return;
    setAuthBusy(true);
    try {
      const { error } = await authFeatureApi.signUp(email, password, fullName || email.split('@')[0]);
      setAuthMessage(
        error
          ? translateAuthError(error.message)
          : 'המשתמש נוצר. אם נדרש אישור מייל ב-Supabase, אשר את המשתמש דרך Authentication > Users.',
      );
    } catch {
      setAuthMessage('לא ניתן להתחבר כרגע. בדוק אינטרנט ונסה שוב.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    await authFeatureApi.signOut();
    setSession(null);
    setProfile(null);
  }

  const isManager = profile?.role === 'manager';
  const isDrafter = profile?.role === 'drafter';

  const value = {
    session,
    profile,
    authLoading,
    profileLoading,
    authBusy,
    authMessage,
    setAuthMessage,
    isManager,
    isDrafter,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
