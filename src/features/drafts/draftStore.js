const DB_NAME = 'maya-form-drafts';
const STORE_NAME = 'drafts';

export function draftKey(userId, formId) {
  return userId && formId ? JSON.stringify([userId, formId]) : null;
}

function transact(mode, operation) {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error('Draft storage is blocked')); };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      try {
        const transaction = db.transaction(STORE_NAME, mode);
        const result = operation(transaction.objectStore(STORE_NAME));
        // A successful request can still be followed by a transaction abort.
        transaction.oncomplete = () => { db.close(); resolve(result.result); };
        transaction.onabort = () => { db.close(); reject(transaction.error || new Error('Draft transaction aborted')); };
        transaction.onerror = () => { /* onabort reports the final failure */ };
      } catch (error) {
        db.close();
        reject(error);
      }
    };
  });
}

// Serialize reads, writes and deletion across mounted forms. A late autosave
// must never recreate a submitted/discarded draft or race with recovery.
export function createDraftStore(backend) {
  const pending = new Map();
  function run(key, operation) {
    if (!key) return Promise.reject(new Error('A signed-in user is required'));
    const next = (pending.get(key) || Promise.resolve()).catch(() => {}).then(operation);
    pending.set(key, next);
    next.finally(() => { if (pending.get(key) === next) pending.delete(key); }).catch(() => {});
    return next;
  }
  return {
    read: (key) => run(key, () => backend.read(key)),
    write: (key, value) => run(key, () => backend.write(key, { version: 1, value, updatedAt: Date.now() })),
    remove: (key) => run(key, () => backend.remove(key)),
  };
}

export const draftStore = createDraftStore({
  read: (key) => transact('readonly', (store) => store.get(key)),
  write: (key, row) => transact('readwrite', (store) => store.put(row, key)),
  remove: (key) => transact('readwrite', (store) => store.delete(key)),
});
