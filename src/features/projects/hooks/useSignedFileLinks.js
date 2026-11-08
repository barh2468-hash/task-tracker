import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { createSignedUrl } from '../../../services/api/storage.js';

export function useSignedFileLinks(bucket, files, downloads = false) {
  const { session } = useAuth();
  const owner = session?.user?.id;
  // Parents often filter these arrays during rendering. Only actual file
  // changes should start work, not new object identities or language changes.
  const key = JSON.stringify(files.map((file) => [file.id, file.file_path, file.file_name]));
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({});
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    let timer;
    let refreshAt = Infinity;
    const rows = JSON.parse(key);
    setState({ key, owner, links: {}, loading: rows.length > 0, error: false });
    void Promise.all(rows.map(async ([id, path, name]) => {
      const [view, download] = await Promise.all([
        createSignedUrl(bucket, path),
        downloads ? createSignedUrl(bucket, path, 3600, { download: name }) : null,
      ]);
      if (!active) return;
      const expiry = Math.min(view?.expiresAt ?? Infinity, download?.expiresAt ?? Infinity);
      if (expiry < refreshAt) {
        refreshAt = expiry;
        window.clearTimeout(timer);
        timer = window.setTimeout(retry, Math.max(1000, expiry - Date.now()));
      }
      const failed = !view?.data?.signedUrl || (downloads && !download?.data?.signedUrl);
      // Publish each completed file; one slow/failing file cannot hide the rest.
      setState((current) => ({ ...current, error: current.error || failed,
        links: { ...current.links, [id]: { view: view?.data?.signedUrl, download: download?.data?.signedUrl } } }));
    })).catch(() => {
      if (active) setState((current) => ({ ...current, error: true }));
    }).finally(() => {
      if (active) setState((current) => ({ ...current, loading: false }));
    });
    // Use the original signing deadline, including for a reused cached URL.
    // Focus also renews URLs after sleep and recovers temporary connection loss.
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener('online', retry);
      window.removeEventListener('focus', retry);
    };
  }, [key, bucket, downloads, owner, attempt, retry]);

  const current = state.key === key && state.owner === owner;
  return { links: current ? state.links || {} : {}, loading: current ? state.loading : files.length > 0,
    error: current && state.error, retry };
}
