import { registerSW } from 'virtual:pwa-register';
import { toast } from '../hooks/useToasts';

/* Register the auto-updating service worker. On `onNeedRefresh` we toast
   the user with a click-to-reload chip. On `onOfflineReady` we just
   confirm — KAI keeps working without a network. */
export function startSW() {
  const updateSW = registerSW({
    onNeedRefresh() {
      toast.warn('Tap to apply new version.', 'KAI · UPDATE', 12000);
      // The toast itself is click-to-dismiss; clicking it elsewhere will
      // re-show on the next reload too. For now we just expose updateSW.
      (window as any).__kaiUpdate = () => updateSW(true);
    },
    onOfflineReady() {
      toast.ok('KAI is now available offline.', 'PWA', 5000);
    },
  });
}
