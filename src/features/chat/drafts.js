// Unsent text is kept per user and conversation, so switching chats never
// carries a half-written message into the wrong conversation.
function draftStorageKey(userId) {
  return `maya-chat-drafts-${userId || 'guest'}`;
}

export function readDrafts(userId) {
  try {
    return JSON.parse(localStorage.getItem(draftStorageKey(userId)) || '{}') || {};
  } catch {
    return {};
  }
}

// Returns the updated drafts map, even when storage itself is unavailable.
export function saveDraft(userId, conversationId, text) {
  const drafts = readDrafts(userId);
  if (!conversationId) return drafts;
  if (text.trim()) drafts[conversationId] = text;
  else delete drafts[conversationId];
  try {
    localStorage.setItem(draftStorageKey(userId), JSON.stringify(drafts));
  } catch {
    // Storage can be unavailable (private mode, quota); drafts are a convenience.
  }
  return drafts;
}
