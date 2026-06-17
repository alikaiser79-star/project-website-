/* Web Speech API wrapper — recognition + synthesis.

   Bug-fix pass:
   - Aborted / immediate-failure restarts now use exponential
     back-off (250 → 500 → 1000 → 2000 → 5000 ms cap) instead of
     a tight 250 ms loop.
   - Errors are debounced — the wrapper doesn't publish 'error'
     to subscribers until the back-off window has elapsed without
     a successful onstart. A successful onstart cancels the
     pending error and steady-listening shows.
   - Back-off resets after a session lives ≥ 5 s of `listening`.
   - Recognizer is constructed once per attempt; existing rec is
     reused if `start()` is called while one is already active.

   `wantOn` is the user intent; everything internal flows from it. */

export type VoiceState =
  | { kind: 'unsupported' }
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'listening'; interim: string }
  | { kind: 'error'; code: string; message: string };

export type ResultListener = (ev: { final: boolean; text: string }) => void;
export type StateListener  = (state: VoiceState) => void;

const SR: any =
  (typeof window !== 'undefined' && (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  )) || null;

const BACKOFF_BASE = 250;
const BACKOFF_MAX  = 5000;
const SESSION_STABLE_MS = 5000;     /* lifetime that resets back-off */
const QUICK_FAIL_MS     = 1500;     /* < this from onstart → back off */
const ERROR_PUBLISH_FLOOR = 2000;   /* never publish error until at least this delay */

export class Voice {
  /* Internal — what actually happened. */
  private internalState: VoiceState =
    SR ? { kind: 'idle' } : { kind: 'unsupported' };
  /* Public — what subscribers see (debounced). */
  private publishedState: VoiceState = this.internalState;

  private rec: any = null;
  private wantOn = false;

  private resultListeners = new Set<ResultListener>();
  private stateListeners  = new Set<StateListener>();

  private restartTimer:       ReturnType<typeof setTimeout> | null = null;
  private errorPublishTimer:  ReturnType<typeof setTimeout> | null = null;
  private backoffResetTimer:  ReturnType<typeof setTimeout> | null = null;

  private sessionStartAt = 0;       /* 0 when no onstart fired yet */
  private lastErrorAt    = 0;
  private currentBackoff = BACKOFF_BASE;

  private preferredVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const pick = () => {
        const voices = speechSynthesis.getVoices();
        const want = voices.find(v =>
          /Daniel|Google UK English Male|Microsoft Ryan|en-GB/.test((v.name || '') + (v.lang || ''))
        ) || voices.find(v => /en[-_](GB|US)/i.test(v.lang || ''))
          || voices[0];
        this.preferredVoice = want || null;
      };
      pick();
      speechSynthesis.onvoiceschanged = pick;
    }
  }

  supported(): boolean { return !!SR; }
  getState(): VoiceState { return this.publishedState; }

  onResult(fn: ResultListener): () => void {
    this.resultListeners.add(fn);
    return () => { this.resultListeners.delete(fn); };
  }
  onState(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    try { fn(this.publishedState); } catch {}
    return () => { this.stateListeners.delete(fn); };
  }

  /* ── State management with publish debounce ──────────────── */

  private setInternal(s: VoiceState) {
    this.internalState = s;

    if (s.kind === 'listening') {
      /* Authoritative live signal — publish immediately and clear
         any pending error notification. */
      this.cancelErrorPublish();
      this.publish(s);
      if (this.backoffResetTimer) clearTimeout(this.backoffResetTimer);
      this.backoffResetTimer = setTimeout(() => {
        this.currentBackoff = BACKOFF_BASE;
      }, SESSION_STABLE_MS);
      return;
    }

    if (s.kind === 'idle' || s.kind === 'unsupported') {
      this.cancelErrorPublish();
      this.publish(s);
      return;
    }

    if (s.kind === 'starting') {
      /* Publish only if we're not already showing 'listening' to the user.
         A starting flash mid-session would just be noise — the back-off
         restart is invisible to the user when SR is healthy. */
      if (this.publishedState.kind !== 'listening' || !this.errorPublishTimer) {
        this.publish(s);
      }
      return;
    }

    if (s.kind === 'error') {
      /* Don't publish immediately. Schedule debounced publish; if a
         successful onstart fires before it expires, cancelErrorPublish()
         clears it and the user never sees the flicker. */
      if (!this.errorPublishTimer) {
        const delay = Math.max(ERROR_PUBLISH_FLOOR, this.currentBackoff * 2);
        this.errorPublishTimer = setTimeout(() => {
          this.errorPublishTimer = null;
          if (this.internalState.kind === 'error' && this.wantOn) {
            this.publish(this.internalState);
          }
        }, delay);
      }
      return;
    }
  }

  private cancelErrorPublish() {
    if (this.errorPublishTimer) {
      clearTimeout(this.errorPublishTimer);
      this.errorPublishTimer = null;
    }
  }

  private publish(s: VoiceState) {
    /* Deep-ish dedupe so interim updates still flow but we don't
       re-broadcast identical state. */
    if (statesEqual(this.publishedState, s)) return;
    this.publishedState = s;
    this.stateListeners.forEach(fn => { try { fn(s); } catch {} });
  }

  /* ── Public lifecycle ─────────────────────────────────────── */

  start() {
    if (!SR) { this.setInternal({ kind: 'unsupported' }); return; }
    this.wantOn = true;
    /* Explicit start by user → reset back-off so the first attempt
       is fast. */
    this.currentBackoff = BACKOFF_BASE;
    if (this.rec) return;
    this.attemptStart();
  }

  stop() {
    this.wantOn = false;
    if (this.restartTimer)      { clearTimeout(this.restartTimer);      this.restartTimer = null; }
    if (this.errorPublishTimer) { clearTimeout(this.errorPublishTimer); this.errorPublishTimer = null; }
    if (this.backoffResetTimer) { clearTimeout(this.backoffResetTimer); this.backoffResetTimer = null; }
    if (this.rec) {
      try { this.rec.onstart = null; } catch {}
      try { this.rec.onerror = null; } catch {}
      try { this.rec.onend = null; } catch {}
      try { this.rec.onresult = null; } catch {}
      try { this.rec.stop(); } catch {}
      try { this.rec.abort && this.rec.abort(); } catch {}
      this.rec = null;
    }
    this.sessionStartAt = 0;
    this.lastErrorAt = 0;
    this.setInternal({ kind: 'idle' });
  }

  /* ── Recognition attempt ──────────────────────────────────── */

  private attemptStart() {
    if (!this.wantOn || this.rec) return;
    if (!SR) { this.setInternal({ kind: 'unsupported' }); return; }

    this.setInternal({ kind: 'starting' });
    this.sessionStartAt = 0;

    let r: any;
    try {
      r = new SR();
    } catch (e: any) {
      this.lastErrorAt = Date.now();
      this.setInternal({ kind: 'error', code: 'construct-failed', message: String(e?.message || e) });
      this.bumpBackoff();
      this.scheduleRestart();
      return;
    }

    try {
      r.continuous = true;
      r.interimResults = true;
      r.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
      try { r.maxAlternatives = 1; } catch {}
    } catch { /* tolerated */ }

    r.onstart = () => {
      this.sessionStartAt = Date.now();
      this.setInternal({ kind: 'listening', interim: '' });
    };

    r.onerror = (ev: any) => {
      const code = String(ev?.error || 'unknown');
      const msg  = String(ev?.message || '');
      this.lastErrorAt = Date.now();
      this.setInternal({ kind: 'error', code, message: msg });
    };

    r.onend = () => {
      this.rec = null;
      const lifeMs   = this.sessionStartAt === 0 ? 0 : Date.now() - this.sessionStartAt;
      const hadError = Date.now() - this.lastErrorAt < 250;
      /* An aborted right after start (sessionStartAt === 0 OR life
         < QUICK_FAIL_MS) counts as a failed start; back off. */
      if (this.wantOn) {
        if (lifeMs < QUICK_FAIL_MS || hadError) this.bumpBackoff();
        this.scheduleRestart();
      } else {
        this.setInternal({ kind: 'idle' });
      }
    };

    r.onresult = (ev: any) => {
      if (this.isSpeaking()) return;
      let interim = '', final = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const t   = (res[0] && res[0].transcript) || '';
        if (res.isFinal) final   += t;
        else             interim += t;
      }
      const ti = interim.trim();
      const tf = final.trim();
      if (ti) {
        this.setInternal({ kind: 'listening', interim: ti });
        this.resultListeners.forEach(fn => { try { fn({ final: false, text: ti }); } catch {} });
      }
      if (tf) {
        this.setInternal({ kind: 'listening', interim: '' });
        this.resultListeners.forEach(fn => { try { fn({ final: true, text: tf }); } catch {} });
      }
    };

    try {
      r.start();
      this.rec = r;
    } catch (e: any) {
      this.rec = null;
      this.lastErrorAt = Date.now();
      this.setInternal({ kind: 'error', code: 'start-failed', message: String(e?.message || e || '') });
      this.bumpBackoff();
      this.scheduleRestart();
    }
  }

  private bumpBackoff() {
    this.currentBackoff = Math.min(BACKOFF_MAX, Math.max(this.currentBackoff * 2, 500));
  }

  private scheduleRestart() {
    if (!this.wantOn) return;
    if (this.restartTimer) return;
    const delay = this.currentBackoff;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.wantOn) this.attemptStart();
    }, delay);
  }

  private isSpeaking(): boolean {
    return typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && !!(speechSynthesis.speaking || speechSynthesis.pending);
  }

  /* ── Synthesis ─────────────────────────────────────────────── */

  speak(text: string, opts: { rate?: number; pitch?: number; voiceName?: string } = {}, onEnd?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { onEnd?.(); return; }
    speechSynthesis.cancel();
    const u = this.buildUtterance(text, opts);
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    speechSynthesis.speak(u);
  }

  enqueue(text: string, opts: { rate?: number; pitch?: number; voiceName?: string } = {}) {
    if (!text || !text.trim()) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const u = this.buildUtterance(text, opts);
    speechSynthesis.speak(u);
  }

  cancel() { try { speechSynthesis.cancel(); } catch {} }

  private buildUtterance(text: string, opts: { rate?: number; pitch?: number; voiceName?: string }) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate   = opts.rate  ?? 1.0;
    u.pitch  = opts.pitch ?? 0.85;
    u.volume = 0.9;
    let chosen = this.preferredVoice;
    if (opts.voiceName) {
      const match = speechSynthesis.getVoices().find(v => v.name === opts.voiceName);
      if (match) chosen = match;
    }
    if (chosen) u.voice = chosen;
    return u;
  }
}

function statesEqual(a: VoiceState, b: VoiceState): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'listening' && b.kind === 'listening') return a.interim === b.interim;
  if (a.kind === 'error' && b.kind === 'error') return a.code === b.code && a.message === b.message;
  return true;
}

export const voice = new Voice();
