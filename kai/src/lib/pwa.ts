import { registerSW } from 'virtual:pwa-register';
import { toast } from '../hooks/useToasts';

/* Register the auto-updating service worker.

   With skipWaiting + clientsClaim set in vite.config, a new SW takes
   control as soon as it finishes installing — no tab close needed.
   We then reload the page ONCE so the live bundle matches the
   newly-active SW's cache. Without this, the page keeps running on
   the previous bundle until the next navigation.

   Single-shot guard prevents an install loop in the rare case where
   the SW reactivates without a fresh install. */
export function startSW() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  let didReload = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (didReload) return;
    didReload = true;
    /* Give the new SW a tick to finish wiring up its caches before
       we ask the page to reload through it. */
    setTimeout(() => location.reload(), 50);
  });

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      /* skipWaiting handles activation; controllerchange handles the
         reload. Just inform the user something just shipped. */
      toast.ok('New build · reloading…', 'KAI · UPDATE', 4000);
    },
    onOfflineReady() {
      toast.ok('KAI is now available offline.', 'PWA', 5000);
    },
  });

  /* Foreground update check. The browser only auto-checks for a new
     SW on navigation and ~daily, so a long-lived standalone PWA
     (iOS especially) can sit on a stale bundle for hours. Every time
     the app is brought back to the foreground, ask the SW to check
     for an update; if one exists it installs, skipWaiting fires, and
     the controllerchange handler above reloads into the fresh build.
     This is what stops "deployed but the pixels didn't change". */
  const checkForUpdate = () => {
    if (document.visibilityState === 'visible') {
      try { updateSW(false); } catch { /* ignore */ }
    }
  };
  document.addEventListener('visibilitychange', checkForUpdate);
  window.addEventListener('focus', checkForUpdate);
}
