// "Seen by" for a message: the other members whose read position has reached
// it. `members` are { user_id, last_read_at } rows of the conversation.
export function messageReaders(message, members) {
  const sentAt = Date.parse(message?.created_at);
  const others = (members || []).filter((member) => member.user_id !== message?.sender_id);
  const readers = others.filter(
    (member) => member.last_read_at && Date.parse(member.last_read_at) >= sentAt,
  );
  return {
    readerIds: readers.map((member) => member.user_id),
    waitingIds: others
      .filter((member) => !readers.includes(member))
      .map((member) => member.user_id),
    // ✓✓ once everyone else has read it; ✓ while anyone has not.
    readByAll: others.length > 0 && readers.length === others.length,
  };
}
