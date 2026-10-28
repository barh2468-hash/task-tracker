export function assignmentProjectState(search, scrollY, focusId) {
  return { returnToAssignments: { search, scrollY, focusId } };
}

export function assignmentReturnLocation(state) {
  const origin = state?.returnToAssignments;
  if (!origin || typeof origin.search !== 'string') return null;
  // The destination is fixed; route state cannot redirect outside this view.
  return {
    pathname: '/app/assignments',
    search: origin.search,
    state: {
      assignmentListRestore: {
        scrollY: Number.isFinite(origin.scrollY) ? Math.max(0, origin.scrollY) : 0,
        focusId: typeof origin.focusId === 'string' ? origin.focusId : null,
      },
    },
  };
}
