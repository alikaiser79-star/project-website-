/* Web Speech API wrapper — recognition + synthesis */

type Listener = (ev: { final: boolean; text: string }) => void;

const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export class Voice {
  private rec: any = null;
  private listening = false;
  private listener?: Listener;
  private preferredVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if ('speechSynthesis' in window) {
      const pick = () => {
        const voices = speechSynthesis.getVoices();
        const want = voices.find(v => /Daniel|Google UK English Male|Microsoft Ryan|en-GB/.test(v.name + v.lang))
          || voices.find(v => /en[-_](GB|US)/i.test(v.lang))
          || voices[0];
        this.preferredVoice = want || null;
      };
      pick();
      speechSynthesis.onvoiceschanged = pick;
    }
  }

  supported() { return !!SR; }

  onResult(fn: Listener) { this.listener = fn; }

  start() {
    if (!SR || this.listening) return;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';
    r.onresult = (ev: any) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        this.listener?.({ final: res.isFinal, text: res[0].transcript.trim() });
      }
    };
    r.onend = () => { if (this.listening) { try { r.start(); } catch {} } };
    try { r.start(); this.rec = r; this.listening = true; } catch {}
  }

  stop() {
    this.listening = false;
    try { this.rec?.stop(); } catch {}
    this.rec = null;
  }

  speak(text: string, opts: { rate?: number; pitch?: number; voiceName?: string } = {}, onEnd?: () => void) {
    if (!('speechSynthesis' in window)) { onEnd?.(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = opts.rate ?? 1.0;
    u.pitch = opts.pitch ?? 0.85;
    u.volume = 0.9;
    let chosen = this.preferredVoice;
    if (opts.voiceName) {
      const match = speechSynthesis.getVoices().find(v => v.name === opts.voiceName);
      if (match) chosen = match;
    }
    if (chosen) u.voice = chosen;
    u.onend = () => onEnd?.();
    speechSynthesis.speak(u);
  }

  cancel() { try { speechSynthesis.cancel(); } catch {} }
}

export const voice = new Voice();
