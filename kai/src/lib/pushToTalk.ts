/* ============================================================
   §22.1 EARS — push-to-talk. CONSENT-BOUND by doctrine: the mic only ever
   opens between an explicit press and release. Single utterance, NO
   continuous mode, NO auto-restart, NO ambient listening. Distinct from the
   old always-on Voice class (which the doctrine retires).

   Web Speech API where supported (Android Chrome / desktop). iOS Safari's
   SpeechRecognition is unreliable — callers detect isPTTSupported() and
   fall back to keyboard dictation into the same ⌘K intent pipeline.
   ============================================================ */

function SR(): any { try { return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; } catch { return null; } }

export function isPTTSupported(): boolean { return !!SR(); }

/* ── WHY IT FAILED ────────────────────────────────────────────
   "voice error" is not a diagnosis. Every failure below names the actual
   cause, what to do about it, and carries the RAW code so it can be
   reported verbatim instead of described. */

export interface PTTEnv {
  hasApi: boolean;
  secureContext: boolean;
  standalone: boolean;        // installed as a PWA
  isIOS: boolean;
  protocol: string;
  host: string;
}

export function pttEnvironment(): PTTEnv {
  let standalone = false, isIOS = false, protocol = '', host = '';
  try {
    standalone = (window.navigator as any).standalone === true
      || (window.matchMedia?.('(display-mode: standalone)')?.matches ?? false);
    isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
    protocol = location.protocol; host = location.hostname;
  } catch { /* SSR / locked down */ }
  return {
    hasApi: !!SR(),
    secureContext: (() => { try { return window.isSecureContext !== false; } catch { return true; } })(),
    standalone, isIOS, protocol, host,
  };
}

export interface PTTProblem { code: string; title: string; detail: string; fatal: boolean }

/* Checked BEFORE trying to start, so the button can explain itself rather
   than failing and shrugging. */
export function pttBlocker(): PTTProblem | null {
  const e = pttEnvironment();
  if (!e.secureContext) {
    return {
      code: 'insecure-context', fatal: true,
      title: 'The microphone needs a secure connection',
      detail: `This page is on ${e.protocol}//${e.host}. Browsers only allow microphone access over HTTPS (or localhost). Open the app on its https:// address.`,
    };
  }
  if (!e.hasApi) {
    return {
      code: 'no-speech-api', fatal: true,
      title: 'This browser has no speech recognition',
      detail: e.isIOS
        ? 'iOS Safari does not expose the Web Speech API' + (e.standalone ? ', and an installed PWA has even less access than the browser tab' : '') + '. Tap to open the command bar and use the keyboard\'s own dictation button instead — it feeds the same pipeline.'
        : 'Chrome on Android or a desktop Chromium browser supports it. Use the command bar and dictate with the keyboard instead.',
    };
  }
  return null;
}

/* The full SpeechRecognition error set, each named. */
const ERRORS: Record<string, { title: string; detail: string; fatal: boolean }> = {
  'not-allowed': {
    title: 'Microphone permission was refused',
    detail: 'The browser blocked the mic. On iOS: Settings → Safari → Microphone, or the "aA" menu → Website Settings. On Android Chrome: the padlock in the address bar → Permissions → Microphone. A PWA inherits the permission from the browser, so grant it there first.',
    fatal: false,
  },
  'service-not-allowed': {
    title: 'The speech service is not permitted',
    detail: 'The browser or the OS refused the recognition service — usually a system-level microphone block, or a policy on a managed device. Check the OS microphone privacy settings, not just the browser.',
    fatal: false,
  },
  'audio-capture': {
    title: 'No microphone was available',
    detail: 'The device reported no usable mic. Another app may be holding it — close anything recording or on a call, then try again.',
    fatal: false,
  },
  'network': {
    title: 'Speech recognition needs the network',
    detail: 'Recognition runs server-side in most browsers, so it fails offline or behind a restrictive network. Check the connection.',
    fatal: false,
  },
  'no-speech': {
    title: 'Nothing was heard',
    detail: 'The mic opened and picked up silence. Hold the button, speak, then release.',
    fatal: false,
  },
  'aborted': {
    title: 'Capture was cut short',
    detail: 'The recognition was stopped before it finished — usually releasing the button too quickly, or another capture starting.',
    fatal: false,
  },
  'language-not-supported': {
    title: 'That language is not supported',
    detail: `The browser cannot recognise "${(() => { try { return navigator.language; } catch { return 'your locale'; } })()}". It will fall back if you set the device language to one it supports.`,
    fatal: false,
  },
  'bad-grammar': { title: 'The recogniser rejected its grammar', detail: 'An internal recogniser error. Try again.', fatal: false },
};

export function explainPTT(code: string): PTTProblem {
  const known = ERRORS[code];
  if (known) return { code, ...known };
  return {
    code: code || 'unknown',
    title: 'Voice capture failed',
    detail: `The browser reported "${code || 'no error code'}". This is the raw code — report it verbatim rather than describing it.`,
    fatal: false,
  };
}

export interface PTTHandlers {
  onInterim?: (text: string) => void;   // live partial transcript while held
  onFinal?: (text: string) => void;     // the finished utterance on release
  onError?: (err: string) => void;
  onEnd?: () => void;
}

let rec: any = null;

/* Begin a single-utterance capture. Returns false if unsupported/failed. */
export function startPTT(h: PTTHandlers): boolean {
  const blocked = pttBlocker();
  if (blocked) { h.onError?.(blocked.code); return false; }
  const Ctor = SR();
  if (!Ctor) { h.onError?.('no-speech-api'); return false; }
  try { rec?.abort?.(); } catch { /* ignore */ }

  const r = new Ctor();
  r.continuous = false;        // ONE utterance — never ambient
  r.interimResults = true;
  try { r.lang = (navigator.language || 'en-US'); } catch { /* default */ }

  let finalText = '';
  r.onresult = (ev: any) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const res = ev.results[i];
      if (res.isFinal) finalText += res[0].transcript;
      else interim += res[0].transcript;
    }
    h.onInterim?.((finalText + ' ' + interim).trim());
  };
  r.onerror = (ev: any) => { h.onError?.(String(ev?.error || 'error')); };
  r.onend = () => { rec = null; h.onFinal?.(finalText.trim()); h.onEnd?.(); };

  try { r.start(); rec = r; return true; }
  catch (e: any) {
    rec = null;
    /* start() throws synchronously when the mic is already open or the
       context forbids it — that message is the most specific thing
       available, so it is passed through untouched. */
    h.onError?.(String(e?.name || e?.message || e || 'start-failed'));
    return false;
  }
}

/* Release — stop the capture; onFinal fires with the full utterance. */
export function stopPTT(): void { try { rec?.stop(); } catch { /* ignore */ } }

/* Hard cancel — discard, no final. */
export function abortPTT(): void { try { rec?.abort(); } catch { /* ignore */ } rec = null; }
