import { useTranslation } from 'react-i18next';
import { t } from '../language/LanguageContext.jsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { flushOfflineQueue, getOfflineQueue } from '../../services/offlineStore.js';
import { useMessage } from '../../context/MessageContext.jsx';

export default function OfflineSync() {
  useTranslation();
  const { setMessage } = useMessage();
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => setPending((await getOfflineQueue()).length), []);
  const sync = useCallback(async () => {
    if (!navigator.onLine || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await flushOfflineQueue();
      setPending(result.remaining);
      if (result.synced)
        setMessage(t('{{value0}} פעולות מהשטח סונכרנו בהצלחה.', { value0: result.synced }));
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [setMessage]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      sync();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('maya-offline-queue-changed', refreshCount);
    refreshCount();
    sync();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('maya-offline-queue-changed', refreshCount);
    };
  }, [refreshCount, sync]);

  if (online && !pending) return null;
  return (
    <div className="offlineBanner" role="status">
      <CloudOff size={18} />
      <span>
        {online
          ? t('{{value0}} פעולות ממתינות לסנכרון', { value0: pending })
          : t('מצב אופליין · {{value0}} פעולות נשמרו במכשיר', { value0: pending })}
      </span>
      {online && pending > 0 && (
        <button type="button" className="ghost tinyBtn" disabled={syncing} onClick={sync}>
          <RefreshCw size={15} />
          {t('סנכרון')}
        </button>
      )}
    </div>
  );
}
