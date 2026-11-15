import { initialState } from './model.js';
// DEV-only UI contract fixture; it has no network or credential access.
export function createConnectionPreview(connected = false) {
  let state = initialState(),
    revision = 0;
  state.settings.mailbox = 'peleg@example.com';
  let connection = connected
    ? {
        enabled: true,
        automation_enabled: false,
        mailbox: 'peleg@example.com',
        folder_name: 'Inbox',
        last_sync_at: new Date().toISOString(),
      }
    : null;
  return {
    load: async () => ({
      state: structuredClone(state),
      revision,
      connection: structuredClone(connection),
      configured: true,
    }),
    save: async (next, expected) => {
      if (expected !== revision) throw Object.assign(new Error('conflict'), { code: 'conflict' });
      state = structuredClone(next);
      revision++;
      return { state: structuredClone(state), revision };
    },
    action: async (action, payload) => {
      if (action === 'automation')
        connection = { ...connection, automation_enabled: payload.enabled };
      if (action === 'disconnect') connection = null;
      if (action === 'connect')
        return {
          url: 'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?client_id=preview-only',
        };
      return { ok: true };
    },
  };
}
