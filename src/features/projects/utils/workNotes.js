// Read the current note from its session, rather than reconstructing audit text.
export function projectWorkNotes(sessions = []) {
  return sessions.filter((session) => typeof session.end_note === 'string' && session.end_note.trim())
    .sort((left, right) => new Date(right.started_at) - new Date(left.started_at));
}
