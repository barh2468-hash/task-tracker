import { supabase } from './supabase.js';

const DB_NAME = 'maya-offline-v1';
const QUEUE_STORE = 'queue';
const CACHE_STORE = 'cache';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function cacheOfflineData(key, value) {
  await withStore(CACHE_STORE, 'readwrite', (store) => store.put({ key, value, updatedAt: Date.now() }));
}

export async function getOfflineData(key) {
  const row = await withStore(CACHE_STORE, 'readonly', (store) => store.get(key));
  return row?.value ?? null;
}

export async function enqueueOfflineAction(type, payload) {
  const action = { id: crypto.randomUUID(), type, payload, createdAt: new Date().toISOString(), attempts: 0 };
  await withStore(QUEUE_STORE, 'readwrite', (store) => store.put(action));
  window.dispatchEvent(new CustomEvent('maya-offline-queue-changed'));
  return action;
}

export async function getOfflineQueue() {
  return (await withStore(QUEUE_STORE, 'readonly', (store) => store.getAll()))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function removeAction(id) {
  await withStore(QUEUE_STORE, 'readwrite', (store) => store.delete(id));
}

async function requireSuccess(result) {
  if (result?.error) throw result.error;
  return result;
}

async function executeAction(action) {
  const p = action.payload;
  if (action.type === 'project_status') {
    await requireSuccess(await supabase.from('projects').update({ status: p.newStatus, progress: p.progress }).eq('id', p.projectId));
    await requireSuccess(await supabase.from('status_history').insert(p.history));
  } else if (action.type === 'project_task_add') {
    const taskRow = { ...p.task };
    delete taskRow.pending_sync;
    delete taskRow.profiles;
    await requireSuccess(await supabase.from('project_tasks').insert(taskRow));
    await requireSuccess(await supabase.from('status_history').insert(p.history));
  } else if (action.type === 'project_task_toggle') {
    await requireSuccess(await supabase.from('project_tasks').update({ is_done: p.isDone }).eq('id', p.taskId));
    await requireSuccess(await supabase.from('status_history').insert(p.history));
  } else if (action.type === 'project_photo') {
    const path = `${p.projectId}/${Date.now()}-${p.fileName.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    await requireSuccess(await supabase.storage.from('project-photos').upload(path, p.file, { upsert: false }));
    await requireSuccess(await supabase.from('project_photos').insert({ project_id: p.projectId, uploaded_by: p.userId, file_path: path, category: p.category }));
    await requireSuccess(await supabase.from('status_history').insert({ ...p.history, note: `${p.category}: ${p.fileName}` }));
  } else if (action.type === 'work_start') {
    await requireSuccess(await supabase.from('work_sessions').insert(p.session));
    await requireSuccess(await supabase.from('status_history').insert(p.history));
  } else if (action.type === 'work_end') {
    await requireSuccess(await supabase.from('work_sessions').update(p.changes).eq('id', p.sessionId).is('ended_at', null));
    await requireSuccess(await supabase.from('status_history').insert(p.history));
  } else if (action.type === 'attendance_start') {
    const attendanceRow = { ...p.session };
    delete attendanceRow.pending_sync;
    await requireSuccess(await supabase.from('attendance_sessions').insert(attendanceRow));
  } else if (action.type === 'attendance_end') {
    await requireSuccess(await supabase.from('attendance_sessions').update(p.changes).eq('id', p.sessionId).is('ended_at', null));
  } else {
    throw new Error(`Unknown offline action: ${action.type}`);
  }
}

export async function flushOfflineQueue() {
  if (!navigator.onLine) return { synced: 0, remaining: (await getOfflineQueue()).length };
  const actions = await getOfflineQueue();
  let synced = 0;
  for (const action of actions) {
    try {
      await executeAction(action);
      await removeAction(action.id);
      synced += 1;
    } catch (error) {
      // Keep authorization/data errors visible and retry on the next connection.
      console.warn('Offline sync paused:', error instanceof Error ? error.message : error);
      break;
    }
  }
  const remaining = (await getOfflineQueue()).length;
  window.dispatchEvent(new CustomEvent('maya-offline-queue-changed'));
  if (synced) window.dispatchEvent(new CustomEvent('maya-data-synced'));
  return { synced, remaining };
}
