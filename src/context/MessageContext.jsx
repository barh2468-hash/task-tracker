import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Global toast used by every feature's mutations once the user is signed in.
// This provider is only mounted around the authenticated part of the app.
// Each message has a tone: success and info clear themselves, errors stay
// until the user dismisses them so a failed save can't go unnoticed.
const MessageContext = createContext(null);

const AUTO_DISMISS_MS = 4500;

export function MessageProvider({ children }) {
  const [toast, setToast] = useState(null);

  // tone: 'success' (default) | 'info' | 'error'
  const setMessage = useCallback((text, tone) => {
    setToast(text ? { text, tone: tone || 'success' } : null);
  }, []);

  useEffect(() => {
    if (!toast || toast.tone === 'error') return undefined;
    const timeout = window.setTimeout(() => setToast(null), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <MessageContext.Provider
      value={{ message: toast?.text || '', messageTone: toast?.tone || 'info', setMessage }}
    >
      {children}
    </MessageContext.Provider>
  );
}

export function useMessage() {
  const ctx = useContext(MessageContext);
  if (!ctx) throw new Error('useMessage must be used within a MessageProvider');
  return ctx;
}
