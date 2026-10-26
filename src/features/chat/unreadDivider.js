// Index of the first unread message, counting `unreadCount` messages from
// other people back from the end of the loaded history. Your own messages and
// project activity events never count as unread, so they are skipped.
export function firstUnreadIndex(messages, unreadCount, userId) {
  if (!unreadCount) return -1;
  let remaining = unreadCount;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].sender_id === userId || messages[index].kind === 'event') continue;
    remaining -= 1;
    if (remaining === 0) return index;
  }
  return messages.length ? 0 : -1;
}
