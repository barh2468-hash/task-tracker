import { createContext, useContext, useEffect, useState } from 'react';

// Global toast used by every feature's mutations once the user is signed in
// (mirrors the single `message` state that lived in the old page.tsx, which
// only auto-cleared while a session existed). This provider is only mounted
// around the authenticated part of the app, so it can always auto-clear.
const MessageContext = createContext(null);

export function MessageProvider({ children }) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(''), 4500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  return <MessageContext.Provider value={{ message, setMessage }}>{children}</MessageContext.Provider>;
}

export function useMessage() {
  const ctx = useContext(MessageContext);
  if (!ctx) throw new Error('useMessage must be used within a MessageProvider');
  return ctx;
}
