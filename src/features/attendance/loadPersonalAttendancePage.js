const RECOVERY_KEY = 'maya-personal-attendance-import-recovery';
const stalePageError = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk .+ failed|Unable to preload CSS/i;

export async function loadPersonalAttendancePage(
  importPage = () => import('../../routes/PersonalAttendancePage.jsx'),
  runtime = globalThis,
) {
  try {
    const page = await importPage();
    try { runtime.window?.sessionStorage.removeItem(RECOVERY_KEY); } catch { /* Storage can be unavailable. */ }
    return page;
  } catch (error) {
    // An installed app can stay open across releases and request an old lazy
    // chunk. Reload its shell once, keeping the current URL and auth session.
    if (runtime.navigator?.onLine !== false && stalePageError.test(error?.message || '')) {
      try {
        const { sessionStorage, location } = runtime.window;
        const attempt = `${location.href}\n${error.message}`;
        if (sessionStorage.getItem(RECOVERY_KEY) !== attempt) {
          // Persist before reload so a failed refresh cannot create a loop.
          sessionStorage.setItem(RECOVERY_KEY, attempt);
          location.reload();
        }
      } catch { /* Show the route fallback if reload or storage is unavailable. */ }
    }
    throw error;
  }
}
