/* Howler-driven UI sound design. We synthesise short tones at module load
   so the app has no external audio assets. */
import { Howl } from 'howler';

function toneDataURL(freq: number, durSec: number, type: 'sine'|'square'|'triangle'|'sawtooth' = 'sine', gain = 0.18): string {
  const sr = 22050;
  const n = Math.floor(sr * durSec);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    switch (type) {
      case 'sine':     s = Math.sin(2 * Math.PI * freq * t); break;
      case 'square':   s = Math.sign(Math.sin(2 * Math.PI * freq * t)); break;
      case 'triangle': s = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * freq * t)); break;
      case 'sawtooth': s = 2 * (t * freq - Math.floor(0.5 + t * freq)); break;
    }
    const env = Math.exp(-t * 9);
    buf[i] = s * env * gain;
  }
  // Build a minimal WAV file
  const wav = new ArrayBuffer(44 + n * 2);
  const view = new DataView(wav);
  const write = (off: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + n*2, true); write(8, 'WAVE');
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sr, true); view.setUint32(28, sr * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, n * 2, true);
  let off = 44;
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, buf[i])); view.setInt16(off, s * 0x7FFF, true); off += 2; }
  const b64 = btoa(String.fromCharCode(...new Uint8Array(wav)));
  return 'data:audio/wav;base64,' + b64;
}

const makeHowl = (url: string, volume = 0.5) => new Howl({ src: [url], format: ['wav'], volume });

const lib = {
  hover:    makeHowl(toneDataURL(880, 0.05, 'sine',     0.10), 0.18),
  click:    makeHowl(toneDataURL(660, 0.07, 'triangle', 0.16), 0.30),
  confirm:  makeHowl(toneDataURL(990, 0.12, 'sine',     0.18), 0.40),
  whoosh:   makeHowl(toneDataURL(220, 0.18, 'sawtooth', 0.13), 0.30),
  speak:    makeHowl(toneDataURL(1320,0.06, 'sine',     0.10), 0.25),
  boot:     makeHowl(toneDataURL(110, 0.55, 'sawtooth', 0.12), 0.55),
  error:    makeHowl(toneDataURL(220, 0.25, 'sawtooth', 0.20), 0.40),
};

let enabled = true;
export function setSoundEnabled(b: boolean) { enabled = b; }

export const sfx = {
  hover()   { if (enabled) lib.hover.play(); },
  click()   { if (enabled) lib.click.play(); },
  confirm() { if (enabled) lib.confirm.play(); },
  whoosh()  { if (enabled) lib.whoosh.play(); },
  speak()   { if (enabled) lib.speak.play(); },
  boot()    { if (enabled) lib.boot.play(); },
  error()   { if (enabled) lib.error.play(); },
};
