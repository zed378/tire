/**
 * Service worker registration (PLAN/06 §5).
 *
 * The worker itself is hand-written in `public/sw.js`. It is privileged code
 * that can serve a stale application to every user, so it is only ever updated
 * through the deploy pipeline — never from anywhere else.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return; // a caching worker in dev hides your own changes

  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    // A failed registration means no offline support, not a broken application.
    // The upload queue screen says so plainly rather than pretending otherwise.
  }
}

/**
 * Clears every cache on logout.
 *
 * Rule 2 of PLAN/06 §5: a shared device in a vehicle pool is a real scenario.
 * D-17 found the legacy tab state surviving a logout and a fresh login, which
 * meant the session boundary was not being honoured at all.
 */
export async function clearServiceWorkerCaches(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  registration?.active?.postMessage({ type: "CLEAR_CACHES" });
}
