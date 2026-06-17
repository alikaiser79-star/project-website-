/* Web Speech API wrapper — recognition + synthesis.
   Proper state machine, all four lifecycle callbacks wired,
   continuous-listen auto-restart, interim transcripts surfaced. */

export type VoiceState =
  | { kind: 'unsupported' }
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'listening'; interim: string }
  | { kind: 'error'; code: string; message: string };

export type ResultListener = (ev: { final: boolean; text: string }) => void;
export type StateListener = (state: VoiceState) => void;

const SR: any =
  (typeof window !== 'undefined' && (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  )) || null;

export class Voice {
  state: VoiceState = SR ? { kind: 'idle' } : { kind: 'unsupported' };
  private rec: any = null;
  /* User intent — when true, the wrapper will keep recognition alive
     and restart it after every onend. */
  private wantOn = false;
  private resultListeners = new Set<ResultListener>();
  private stateListeners  = new Set<StateListener>();
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private preferredVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const pick = () => {
        const voices = speechSynthesis.getVoices();
        const want = voices.find(v => /Daniel|Google UK English Male|Microsoft Ryan|en-GB/.test((v.name || '') + (v.lang || '')))
          || voices.find(v => /en[-_](GB|US)/i.test(v.lang || ''))
          || voices[0];
        this.preferredVoice = want || null;
      };
      pick();
      speechSynthesis.onvoiceschanged = pick;
    }
  }

  supported(): boolean { return !!SR; }
  getState(): VoiceState { return this.state; }

  onResult(fn: ResultListener): () => void {
    this.resultListeners.add(fn);
    return () => { this.resultListeners.delete(fn); };
  }
  onState(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    /* Emit current state synchronously so the subscriber paints
       immediately without waiting for the next transition. */
    try { fn(this.state); } catch {}
    return () => { this.stateListeners.delete(fn); };
  }

  private setState(s: VoiceState) {
    this.state = s;
    this.stateListeners.forEach(fn => { try { fn(s); } catch {} });
  }

  /* Public: ask the wrapper to start (and keep) listening. */
  start() {
    if (!SR) { this.setState({ kind: 'unsupported' }); return; }
    this.wantOn = true;
    if (this.rec) return;            // already wired
    this.attemptStart();
  }

  /* Public: ask the wrapper to stop listening permanently
     (until start() is called again). */
  stop() {
    this.wantOn = false;
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null; }
    if (this.rec) {
      try { this.rec.onend = null; } catch {}     /* prevent auto-restart firing */
      try { this.rec.stop(); } catch {}
      try { this.rec.abort && this.rec.abort(); } catch {}
      this.rec = null;
    }
    this.setState({ kind: 'idle' });
  }

  private attemptStart() {
    if (!this.wantOn || this.rec) return;
    if (!SR) { this.setState({ kind: 'unsupported' }); return; }

    this.setState({ kind: 'starting' });

    let r: any;
    try {
      r = new SR();
    } catch (e: any) {
      this.setState({ kind: 'error', code: 'construct-failed', message: String(e?.message || e) });
      this.scheduleRestart(1500);
      return;
    }

    try {
      r.continuous = true;
      r.interimResults = true;
      r.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
      /* maxAlternatives is harmless if unsupported. */
      try { r.maxAlternatives = 1; } catch {}
    } catch { /* some implementations whitelist properties */ }

    r.onstart = () => {
      /* This is the only authoritative "really listening" signal. */
      this.setState({ kind: 'listening', interim: '' });
    };

    r.onerror = (ev: any) => {
      const code = String(ev?.error || 'unknown');
      const msg  = String(ev?.message || '');
      /* Surface immediately — onend will follow and either restart or idle. */
      this.setState({ kind: 'error', code, message: msg });
    };

    r.onend = () => {
      /* Chrome stops the recognition after a pause. Keep continuous
         mode alive by spawning a fresh instance — restarting the
         same `r` object is unreliable across browsers. */
      this.rec = null;
      if (this.wantOn) this.scheduleRestart(250);
      else             this.setState({ kind: 'idle' });
    };

    r.onresult = (ev: any) => {
      /* Mute our own results while KAI is speaking so we don't
         transcribe our own voice back. */
      if (this.isSpeaking()) return;
      let interim = '';
      let finalText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const t = (res[0] && res[0].transcript) || '';
        if (res.isFinal) finalText += t;
        else             interim   += t;
      }
      const trimmedInterim = interim.trim();
      const trimmedFinal   = finalText.trim();

      if (trimmedInterim) {
        this.setState({ kind: 'listening', interim: trimmedInterim });
        this.resultListeners.forEach(fn => { try { fn({ final: false, text: trimmedInterim }); } catch {} });
      }
      if (trimmedFinal) {
        if (this.state.kind === 'listening') {
          this.setState({ kind: 'listening', interim: '' });
        }
        this.resultListeners.forEach(fn => { try { fn({ final: true, text: trimmedFinal }); } catch {} });
      }
    };

    try {
      r.start();
      this.rec = r;
    } catch (e: any) {
      /* InvalidStateError can fire if a previous SR is still winding
         down. Drop ref + try again shortly. */
      this.rec = null;
      this.setState({ kind: 'error', code: 'start-failed', message: String(e?.message || e || '') });
      this.scheduleRestart(800);
    }
  }

  private scheduleRestart(delay: number) {
    if (this.restartTimer) clearTimeout(this.restartTimer);
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

  cancel() {
    try { speechSynthesis.cancel(); } catch {}
  }

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

export const voice = new Voice();
