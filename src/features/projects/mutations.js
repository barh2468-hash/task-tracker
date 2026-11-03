// A persisted mutation may refresh broad lists in the background. This keeps
// slow reads or a failed inbox refresh from holding a successful save open.
export async function finishProjectMutation(
  promise,
  { notify, refresh, applyOptimistic, background = false },
) {
  const result = await promise;
  if (result?.message) notify(result);
  if (result?.ok === false) return result;
  if (result?.offline || background) applyOptimistic?.(result);
  if (!result?.offline) {
    const refreshPromise = Promise.resolve().then(refresh);
    if (background)
      void refreshPromise.catch(() => console.warn('Background project refresh failed'));
    else await refreshPromise;
  }
  return result;
}
