/* ============================================================
   INSTALL PROMPT (§13.4) — done tastefully, once. Captures the
   browser's beforeinstallprompt, then (after the operator has actually
   used KAI for a bit) offers a single, quiet invitation to install the
   machine to the home screen. Dismiss once → never again. On iOS, where
   there's no beforeinstallprompt, shows a one-time "Add to Home Screen"
   hint instead. Respects safe-area insets.
   ============================================================ */

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

const SEEN = 'kai.install.seen';

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
}
function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem(SEEN) === '1' || isStandalone()) return; } catch { /* ignore */ }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      /* wait a beat — never interrupt the first moment. */
      setTimeout(() => setShow(true), 20_000);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    /* iOS: no event — offer the manual hint once, later in the session. */
    let iosT: ReturnType<typeof setTimeout> | undefined;
    if (isIOS()) { setIos(true); iosT = setTimeout(() => setShow(true), 25_000); }

    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); if (iosT) clearTimeout(iosT); };
  }, []);

  function dismiss() { try { localStorage.setItem(SEEN, '1'); } catch { /* ignore */ } setShow(false); }

  async function install() {
    if (!deferred) return;
    try { deferred.prompt(); await deferred.userChoice; } catch { /* ignore */ }
    dismiss();
  }

  if (!show) return null;

  return (
    <div className="install-banner" role="dialog" aria-label="Install KAI">
      <div className="install-body">
        <span className="install-title">Install KAI</span>
        <span className="install-sub">
          {ios
            ? <>Tap <Share size={12} className="inline -mt-0.5" /> then “Add to Home Screen” — full‑screen, offline, instant.</>
            : 'Add the machine to your home screen — full‑screen, offline, instant.'}
        </span>
      </div>
      <div className="install-actions">
        {!ios && <button className="install-go" onClick={install}><Download size={13} /> Install</button>}
        <button className="install-x" onClick={dismiss} aria-label="dismiss"><X size={14} /></button>
      </div>
    </div>
  );
}
