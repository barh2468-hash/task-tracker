import { supabase } from '../supabase.js';

export function uploadFile(bucket, path, file, options) {
  return supabase.storage.from(bucket).upload(path, file, options);
}

export function removeFiles(bucket, paths) {
  return supabase.storage.from(bucket).remove(paths);
}

export function createSignedUrl(bucket, path, expiresInSeconds = 3600) {
  return supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
}

export function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-');
}
