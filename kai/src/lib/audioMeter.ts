/* A small singleton that owns one MediaStream + AnalyserNode and
   broadcasts amplitude/spectrum samples to any subscribed component. */

type Listener = (sample: { level: number; bars: Float32Array }) => void;
const listeners = new Set<Listener>();

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let stream: MediaStream | null = null;
let raf = 0;
let buf: Uint8Array | null = null;
let bars = new Float32Array(32);
let starting = false;

async function start() {
  if (analyser || starting) return;
  starting = true;
  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const src = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.78;
    src.connect(analyser);
    buf = new Uint8Array(analyser.frequencyBinCount);
    pump();
  } catch (e) {
    console.warn('audioMeter: getUserMedia denied', e);
  } finally {
    starting = false;
  }
}

function pump() {
  if (!analyser || !buf) return;
  analyser.getByteFrequencyData(buf as any);
  const step = Math.floor(buf.length / bars.length);
  let total = 0;
  for (let i = 0; i < bars.length; i++) {
    let v = 0;
    for (let j = 0; j < step; j++) v += buf[i * step + j];
    bars[i] = (v / step) / 255;
    total += bars[i];
  }
  const level = Math.min(1, (total / bars.length) * 1.5);
  listeners.forEach(fn => fn({ level, bars }));
  raf = requestAnimationFrame(pump);
}

function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
  if (stream) stream.getTracks().forEach(t => t.stop());
  try { ctx?.close(); } catch {}
  ctx = null; analyser = null; stream = null; buf = null;
  bars = new Float32Array(bars.length);
}

export const audioMeter = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    if (listeners.size === 1) void start();
    return () => {
      listeners.delete(fn);
      if (listeners.size === 0) stop();
    };
  },
  bars,
};
