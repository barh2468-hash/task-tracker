import { supabase } from '../supabase.js';
import { createSignedUrlCache } from './signedUrlCache.js';

const signedUrls = createSignedUrlCache({
  sign: (...args) => supabase.storage.from(args[0]).createSignedUrl(...args.slice(1)),
});
let signedUrlOwner;
const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
  const owner = session?.user?.id ?? null;
  if (owner !== signedUrlOwner) signedUrls.clear();
  signedUrlOwner = owner;
});
if (import.meta.hot) import.meta.hot.dispose(() => {
  authListener.subscription.unsubscribe();
  signedUrls.clear();
});

export async function uploadFile(bucket, path, file, options) {
  signedUrls.invalidate(bucket, [path]);
  const result = await supabase.storage.from(bucket).upload(path, file, options);
  signedUrls.invalidate(bucket, [path]);
  return result;
}

export async function removeFiles(bucket, paths) {
  signedUrls.invalidate(bucket, paths);
  const result = await supabase.storage.from(bucket).remove(paths);
  signedUrls.invalidate(bucket, paths);
  return result;
}

export function createSignedUrl(bucket, path, expiresInSeconds = 3600, options) {
  return signedUrls.get(bucket, path, expiresInSeconds, options);
}

export function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-');
}
