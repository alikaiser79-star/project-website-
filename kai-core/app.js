/* ============================================================
   KAI CORE — Application
   ============================================================ */

(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const pad = (n, w = 2) => String(n).padStart(w, '0');

const STORE_KEY = 'kai.core.state.v1';

/* ─────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────── */
function nowStamp() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const defaultState = {
  name: 'commander',
  theme: 'green',          // green | terra | gold
  voice: false,
  sound: true,
  sessions: 0,
  events: 0,
  uptimeBase: 0,
  log: [],
  net: { up: 240, down: 920, ping: 18, peers: 32 },
  sys: { cpu: 22, mem: 41, gpu: 17 },
  local: { weather: 'CLEAR', temp: 22, humidity: 48, battery: 100 },
  missions: [
    { t: 'Daily harvest sync',   m: '07:00 · tower-grid-a', s: 'ok'  },
    { t: 'Sensor calibration',   m: 'pending · zone 4',     s: 'warn'},
    { t: 'Cold-chain audit',     m: 'queued · 14:30',       s: 'ok'  },
    { t: 'Backup encryption',    m: 'auto · nightly',       s: 'ok'  },
  ],
  comms: [
    { f: 'mira@field',     b: 'tower-3 nitrogen low',     s: 'warn', t: '2m' },
    { f: 'logistics',      b: 'truck-04 in transit',      s: 'ok',   t: '6m' },
    { f: 'analytics',      b: 'weekly summary ready',     s: 'ok',   t: '11m' },
  ],
  notes: [],
  timers: [],
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return { ...defaultState, ...parsed };
  } catch { return { ...defaultState }; }
}

function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
}

const state = loadState();
state.sessions = (state.sessions || 0) + 1;
state.uptimeBase = Date.now();
saveState();

/* ─────────────────────────────────────────────────────────
   AUDIO (WebAudio — synthesized beeps, no assets)
───────────────────────────────────────────────────────── */
const Audio = (() => {
  let ctx = null;
  const get = () => ctx || (ctx = new (window.AudioContext || window.webkitAudioContext)());

  function tone(freq, dur = 0.08, type = 'sine', gain = 0.04, when = 0) {
    if (!state.sound) return;
    try {
      const c = get();
      const t0 = c.currentTime + when;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(c.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    } catch {}
  }
  return {
    hover:  () => tone(880, 0.04, 'sine',     0.02),
    click:  () => tone(660, 0.06, 'triangle', 0.05),
    open:   () => { tone(520, 0.05, 'square', 0.03); tone(880, 0.05, 'square', 0.025, 0.05); },
    close:  () => { tone(880, 0.04, 'square', 0.03); tone(520, 0.05, 'square', 0.025, 0.04); },
    ok:     () => { tone(660, 0.06, 'sine', 0.05); tone(990, 0.10, 'sine', 0.04, 0.06); },
    error:  () => { tone(220, 0.16, 'sawtooth', 0.05); tone(165, 0.20, 'sawtooth', 0.04, 0.06); },
    boot:   () => { tone(110, 0.25, 'sawtooth', 0.04); tone(220, 0.20, 'sine', 0.03, 0.10); tone(440, 0.30, 'sine', 0.03, 0.18); },
    speak:  () => tone(1320, 0.08, 'sine', 0.04),
  };
})();

/* ─────────────────────────────────────────────────────────
   BOOT SEQUENCE
───────────────────────────────────────────────────────── */
const bootLines = [
  ['[ok]', 'POST · core memory · 8.0 GiB nominal'],
  ['[ok]', 'mounting /dev/cortex on /core … done'],
  ['[ok]', 'kai-kernel 6.18 · build feynman-b1nowe'],
  ['[ok]', 'starting network mesh … 4 peers online'],
  ['[..]', 'loading hydroponic telemetry uplink'],
  ['[ok]', 'sensors: temp · humidity · ph · ec · light'],
  ['[ok]', 'speech synthesis engine: ready'],
  ['[..]', 'calibrating biosphere model · seasonal drift'],
  ['[ok]', 'identity verified · welcome, ' + state.name],
  ['[ok]', 'autonomous interface online'],
];

function runBoot() {
  const log = $('#boot-log');
  const bar = $('#boot-bar-fill');
  const pct = $('#boot-percent');

  let idx = 0;
  let progress = 0;
  Audio.boot();

  function step() {
    if (idx >= bootLines.length) {
      pct.textContent = '100%';
      bar.style.width = '100%';
      setTimeout(finish, 320);
      return;
    }
    const [tag, msg] = bootLines[idx++];
    const cls = tag === '[ok]' ? 'ok' : (tag === '[..]' ? 'warn' : 'err');
    log.insertAdjacentHTML('beforeend',
      `<div><span class="${cls}">${tag}</span>  ${msg}<span class="cur"></span></div>`);
    // remove caret from previous line
    const prev = log.children[log.children.length - 2];
    if (prev) prev.querySelector('.cur')?.remove();
    log.scrollTop = log.scrollHeight;
    progress = Math.min(100, Math.round((idx / bootLines.length) * 100));
    bar.style.width = progress + '%';
    pct.textContent = progress + '%';
    setTimeout(step, rand(160, 340));
  }

  function finish() {
    $('#boot').classList.add('fade-out');
    $('#hud').classList.remove('hidden');
    initHud();
    setTimeout(() => $('#boot').remove(), 700);
  }

  step();
}

/* ─────────────────────────────────────────────────────────
   THREE.JS ORB
───────────────────────────────────────────────────────── */
function initOrb() {
  const canvas = $('#orb');
  if (!window.THREE) return;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);

  // Core sphere — wireframe icosahedron, glowing
  const coreGeo = new THREE.IcosahedronGeometry(1.0, 2);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x7AE6A8,
    wireframe: true,
    transparent: true,
    opacity: 0.55,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  scene.add(core);

  // Inner glow sphere (solid, dim)
  const innerGeo = new THREE.SphereGeometry(0.78, 32, 32);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0x1F4A2E, transparent: true, opacity: 0.55,
  });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  scene.add(inner);

  // Outer ring — torus
  const ringGeo = new THREE.TorusGeometry(1.35, 0.005, 8, 200);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x7AE6A8, transparent: true, opacity: 0.6 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2.5;
  scene.add(ring);

  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(1.55, 0.003, 8, 200),
    new THREE.MeshBasicMaterial({ color: 0xE59060, transparent: true, opacity: 0.45 })
  );
  ring2.rotation.x = Math.PI / 1.6;
  ring2.rotation.z = Math.PI / 3;
  scene.add(ring2);

  // Particle field around orb
  const particleCount = 420;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const r = 1.7 + Math.random() * 0.9;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0x7AE6A8, size: 0.018, transparent: true, opacity: 0.75,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // Resize
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // Mouse parallax
  let mx = 0, my = 0;
  let tmx = 0, tmy = 0;
  window.addEventListener('mousemove', (e) => {
    tmx = (e.clientX / window.innerWidth  - 0.5) * 2;
    tmy = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  let speakLevel = 0;
  let listenLevel = 0;
  const orb = {
    setSpeaking(on) { speakLevel = on ? 1 : 0; },
    setListening(on){ listenLevel = on ? 1 : 0; },
    setTheme(theme) {
      const map = { green: 0x7AE6A8, terra: 0xE59060, gold: 0xD9B650 };
      const c = map[theme] || map.green;
      core.material.color.setHex(c);
      ring.material.color.setHex(c);
      pMat.color.setHex(c);
    }
  };

  // Animate
  let t = 0;
  function tick() {
    t += 0.01;
    mx += (tmx - mx) * 0.06;
    my += (tmy - my) * 0.06;

    const pulse = 1 + 0.04 * Math.sin(t * 1.4) + 0.06 * speakLevel * Math.sin(t * 8);
    core.scale.setScalar(pulse);
    inner.scale.setScalar(1 + 0.02 * Math.sin(t * 1.1));

    core.rotation.y += 0.0035;
    core.rotation.x += 0.0017;
    particles.rotation.y -= 0.0008;
    particles.rotation.x += 0.0003;
    ring.rotation.z += 0.004;
    ring2.rotation.z -= 0.003;

    camera.position.x = mx * 0.35;
    camera.position.y = -my * 0.35;
    camera.lookAt(0, 0, 0);

    const tint = listenLevel ? 1 : 0;
    inner.material.opacity = 0.45 + 0.25 * Math.abs(Math.sin(t * 1.4)) + 0.2 * speakLevel;
    inner.material.color.setHSL(tint ? 0.06 : 0.36, 0.5, 0.22 + 0.05 * Math.sin(t));

    $('#orb-coord-x').textContent = 'x: ' + camera.position.x.toFixed(2);
    $('#orb-coord-y').textContent = 'y: ' + camera.position.y.toFixed(2);
    $('#orb-coord-z').textContent = 'z: ' + camera.position.z.toFixed(2);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  return orb;
}

/* ─────────────────────────────────────────────────────────
   PANEL DATA — counters, sparkline, lists, time
───────────────────────────────────────────────────────── */
let orb = null;

function animateCounter(el, to, opts = {}) {
  const from = parseFloat(el.textContent) || 0;
  const dur = opts.dur ?? 700;
  const decimals = opts.decimals ?? 0;
  const t0 = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);
  function step(now) {
    const k = Math.min(1, (now - t0) / dur);
    const v = from + (to - from) * ease(k);
    el.textContent = v.toFixed(decimals);
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function setBar(name, pct) {
  const el = document.querySelector(`[data-bar="${name}"]`);
  if (el) el.style.width = Math.max(0, Math.min(100, pct)) + '%';
}

function setCounter(name, val, opts) {
  const el = document.querySelector(`[data-counter="${name}"]`);
  if (el) animateCounter(el, val, opts);
}

/* ── Sparkline ── */
const spark = { points: Array.from({ length: 40 }, () => 30 + rand(-8, 8)) };
function drawSparkline() {
  const svg = $('#spark-net');
  if (!svg) return;
  const w = 200, h = 40;
  const pts = spark.points;
  const max = Math.max(...pts) + 4;
  const min = Math.min(...pts) - 4;
  const range = Math.max(1, max - min);
  const x = i => (i / (pts.length - 1)) * w;
  const y = v => h - ((v - min) / range) * h;
  let d = `M ${x(0)} ${y(pts[0])}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${x(i)} ${y(pts[i])}`;
  const area = d + ` L ${w} ${h} L 0 ${h} Z`;
  svg.innerHTML =
    `<path class="area" d="${area}"/>` +
    `<path d="${d}"/>`;
}

/* ── Mission / comms / log render ── */
function renderMissions() {
  const ul = $('#mission-list'); if (!ul) return;
  ul.innerHTML = '';
  state.missions.forEach(m => {
    ul.insertAdjacentHTML('beforeend',
      `<li>
        <span class="m-dot ${m.s === 'warn' ? 'warn' : m.s === 'crit' ? 'crit' : ''}"></span>
        <span><span class="m-title">${m.t}</span><br><span class="m-meta">${m.m}</span></span>
        <span class="m-meta">${m.s.toUpperCase()}</span>
      </li>`);
  });
  $('#mission-count').textContent = state.missions.length;
}

function renderComms() {
  const ul = $('#comms-list'); if (!ul) return;
  ul.innerHTML = '';
  state.comms.forEach(c => {
    ul.insertAdjacentHTML('beforeend',
      `<li>
        <span class="c-dot ${c.s}"></span>
        <span><span class="c-from">${c.f}</span><br><span class="c-meta">${c.b}</span></span>
        <span class="c-meta">${c.t}</span>
      </li>`);
  });
  const newCount = state.comms.filter(c => c.s !== 'ok').length;
  $('#comms-tag').textContent = newCount + ' new';
}

function pushLog(msg, level = 'ok') {
  const ul = $('#log-list');
  if (!ul) return;
  const now = new Date();
  const t = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const li = document.createElement('li');
  li.className = level;
  li.innerHTML = `<span class="t">${t}</span><span>${msg}</span>`;
  ul.prepend(li);
  while (ul.children.length > 80) ul.lastChild.remove();
  state.log.unshift({ t, msg, level });
  if (state.log.length > 80) state.log.length = 80;
  state.events++;
  $('#ses-events').textContent = state.events + ' events';
  saveState();
}

function renderInitialLog() {
  $('#log-list').innerHTML = '';
  state.log.slice(0, 20).reverse().forEach(({ t, msg, level }) => {
    const li = document.createElement('li');
    li.className = level || 'ok';
    li.innerHTML = `<span class="t">${t}</span><span>${msg}</span>`;
    $('#log-list').prepend(li);
  });
}

/* ── Time tick ── */
function tickClock() {
  const d = new Date();
  $('#ts-date').textContent =
    d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  $('#ts-time').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  $('#ts-tz').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const up = Math.floor((Date.now() - state.uptimeBase) / 1000);
  $('#ses-up').textContent = `${pad(Math.floor(up/3600))}:${pad(Math.floor(up/60)%60)}:${pad(up%60)}`;
}

/* ── Telemetry tick — pseudo-realistic drift ── */
function tickTelemetry() {
  state.sys.cpu = clamp(state.sys.cpu + rand(-4, 4), 6, 92);
  state.sys.mem = clamp(state.sys.mem + rand(-2, 2), 18, 88);
  state.sys.gpu = clamp(state.sys.gpu + rand(-3, 5), 4, 90);

  state.net.up   = clamp(state.net.up   + rand(-30, 30), 40, 1200);
  state.net.down = clamp(state.net.down + rand(-50, 50), 80, 2400);
  state.net.ping = clamp(state.net.ping + rand(-3, 3), 4, 80);
  state.net.peers = clamp(state.net.peers + irand(-1, 1), 8, 64);

  state.local.temp = clamp(state.local.temp + rand(-0.4, 0.4), 14, 32);
  state.local.humidity = clamp(state.local.humidity + rand(-1.5, 1.5), 28, 78);

  if (Math.random() < 0.04) state.local.battery = clamp(state.local.battery + rand(-1, 0.5), 6, 100);

  setCounter('cpu', state.sys.cpu); setBar('cpu', state.sys.cpu);
  setCounter('mem', state.sys.mem); setBar('mem', state.sys.mem);
  setCounter('gpu', state.sys.gpu); setBar('gpu', state.sys.gpu);

  setCounter('up',   state.net.up);
  setCounter('down', state.net.down);
  setCounter('ping', state.net.ping);
  setCounter('peers', state.net.peers);

  setCounter('temp', state.local.temp, { decimals: 1 });
  setCounter('humidity', state.local.humidity);
  setCounter('battery', state.local.battery);

  spark.points.shift();
  spark.points.push(state.net.down / 30);
  drawSparkline();

  // Network signal label
  $('#net-tag').textContent = state.net.ping < 20 ? 'fast' : state.net.ping < 50 ? 'stable' : 'lagging';

  saveState();
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

/* ── Battery API if available ── */
async function bindBattery() {
  if (!navigator.getBattery) return;
  try {
    const b = await navigator.getBattery();
    const sync = () => {
      state.local.battery = Math.round(b.level * 100);
      setCounter('battery', state.local.battery);
    };
    b.addEventListener('levelchange', sync);
    sync();
  } catch {}
}

/* ── Online status ── */
function bindNetwork() {
  const chip = $('#link-chip');
  const sync = () => {
    if (navigator.onLine) { chip.textContent = '● ONLINE';  chip.className = 'chip status-ok'; }
    else                  { chip.textContent = '● OFFLINE'; chip.className = 'chip status-off'; }
  };
  window.addEventListener('online',  () => { sync(); pushLog('network: link restored', 'ok'); });
  window.addEventListener('offline', () => { sync(); pushLog('network: link lost',     'err'); });
  sync();
}

/* ─────────────────────────────────────────────────────────
   TOAST NOTIFICATIONS
───────────────────────────────────────────────────────── */
function toast(body, opts = {}) {
  const stack = $('#toasts'); if (!stack) return;
  const level = opts.level || 'ok';
  const title = opts.title || (level === 'warn' ? 'NOTICE' : level === 'err' ? 'ALERT' : 'EVENT');
  const ic = level === 'warn' ? '!' : level === 'err' ? '×' : '◊';
  const el = document.createElement('div');
  el.className = 'toast ' + (level === 'ok' ? '' : level);
  el.innerHTML = `<span class="t-ic">${ic}</span>
    <span><span class="t-title">${title}</span><span class="t-body">${body}</span></span>`;
  stack.appendChild(el);
  if (level === 'warn') Audio.click(); else if (level === 'err') Audio.error(); else Audio.ok();
  const ttl = opts.ttl ?? 4200;
  const timer = setTimeout(() => dismiss(), ttl);
  function dismiss() {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }
  el.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
}

/* ─────────────────────────────────────────────────────────
   NOTES — quick capture, persisted
───────────────────────────────────────────────────────── */
function addNote(text) {
  if (!text || !text.trim()) return;
  const note = { t: text.trim(), at: nowStamp(), d: new Date().toISOString() };
  state.notes.unshift(note);
  if (state.notes.length > 50) state.notes.length = 50;
  saveState();
  pushLog('note saved: ' + text.trim().slice(0, 40), 'ok');
  toast('“' + text.trim() + '”', { title: 'NOTE SAVED · ' + note.at });
}
function listNotes() {
  if (!state.notes.length) { toast('No notes captured yet.', { title: 'NOTES' }); return; }
  state.notes.slice(0, 5).forEach((n, i) => {
    setTimeout(() => toast(n.t, { title: 'NOTE · ' + n.at, ttl: 6000 }), i * 220);
  });
}
function clearNotes() {
  state.notes = []; saveState();
  toast('Notes cleared.', { title: 'NOTES', level: 'warn' });
}

/* ─────────────────────────────────────────────────────────
   TIMERS — set, remind, fire toast + speech
───────────────────────────────────────────────────────── */
function parseDurationMs(s) {
  if (!s) return null;
  s = s.toLowerCase().trim();
  // formats: "5 minutes", "30s", "1h30m", "10 mins"
  let total = 0; let matched = false;
  s.replace(/(\d+)\s*(h(?:ours?|rs?)?|m(?:in(?:ute)?s?)?|s(?:ec(?:ond)?s?)?)/g,
    (_, n, u) => {
      matched = true;
      n = parseInt(n);
      if (u.startsWith('h')) total += n * 3600_000;
      else if (u.startsWith('m')) total += n * 60_000;
      else total += n * 1000;
    });
  if (!matched) {
    const num = parseInt(s);
    if (!isNaN(num)) total = num * 60_000; // bare number → minutes
  }
  return total > 0 ? total : null;
}
function setTimer(durMs, label) {
  const fireAt = Date.now() + durMs;
  const id = 'tmr-' + Math.random().toString(36).slice(2, 7);
  state.timers.push({ id, fireAt, label: label || 'timer' });
  saveState();
  const human = humanDur(durMs);
  toast(`“${label || 'timer'}” in ${human}.`, { title: 'TIMER SET' });
  pushLog(`timer ${id} · ${human}`, 'ok');
  scheduleTimer(id, fireAt, label);
}
function humanDur(ms) {
  const s = Math.round(ms/1000);
  if (s < 60) return s + 's';
  const m = Math.round(s/60);
  if (m < 60) return m + ' min';
  return Math.floor(m/60) + 'h ' + (m%60) + 'm';
}
function scheduleTimer(id, fireAt, label) {
  const delay = Math.max(0, fireAt - Date.now());
  setTimeout(() => {
    const idx = state.timers.findIndex(t => t.id === id);
    if (idx < 0) return; // canceled
    state.timers.splice(idx, 1); saveState();
    toast(`Timer “${label}” elapsed.`, { title: 'TIMER · DING', level: 'warn', ttl: 8000 });
    pushLog('timer fired: ' + label, 'warn');
    Audio.boot();
    speak(`Time's up. ${label}.`);
  }, delay);
}
function resumeTimers() {
  state.timers.slice().forEach(t => {
    if (t.fireAt <= Date.now()) {
      pushLog('timer missed (during reload): ' + t.label, 'warn');
      state.timers = state.timers.filter(x => x.id !== t.id);
    } else {
      scheduleTimer(t.id, t.fireAt, t.label);
    }
  });
  saveState();
}

/* ─────────────────────────────────────────────────────────
   SAFE MATH EVAL
───────────────────────────────────────────────────────── */
function safeEval(expr) {
  const clean = expr.replace(/[^0-9+\-*/().%\s]/g, '');
  if (!clean.trim()) return null;
  try {
    const v = Function('"use strict"; return (' + clean + ')')();
    return Number.isFinite(v) ? v : null;
  } catch { return null; }
}

/* ─────────────────────────────────────────────────────────
   CHEATSHEET + MATRIX RAIN
───────────────────────────────────────────────────────── */
function openCheat() {
  $('#cheat').classList.remove('hidden');
  Audio.open();
}
function closeCheat() {
  $('#cheat').classList.add('hidden');
  Audio.close();
}

let matrixCtrl = null;
function startMatrix() {
  if (matrixCtrl) return;
  const cv = $('#matrix');
  cv.classList.remove('hidden');
  requestAnimationFrame(() => cv.classList.add('on'));
  const ctx = cv.getContext('2d');
  let w = cv.width = innerWidth;
  let h = cv.height = innerHeight;
  const cols = Math.floor(w / 14);
  const drops = Array(cols).fill(0).map(() => Math.random() * h / 14);
  const chars = 'カキクケコサシスセソタチツテトナニヌネノ◊KAIVON01';
  function frame() {
    ctx.fillStyle = 'rgba(7,16,11,0.08)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = '14px DM Mono, monospace';
    for (let i = 0; i < cols; i++) {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillStyle = Math.random() < 0.04 ? '#F0E7CF' : 'rgba(122,230,168,0.85)';
      ctx.fillText(ch, i * 14, drops[i] * 14);
      if (drops[i] * 14 > h && Math.random() > 0.975) drops[i] = 0;
      drops[i] += 1;
    }
    matrixCtrl.raf = requestAnimationFrame(frame);
  }
  function resize() {
    w = cv.width = innerWidth;
    h = cv.height = innerHeight;
  }
  window.addEventListener('resize', resize);
  matrixCtrl = { raf: requestAnimationFrame(frame), resize, cv };
  toast('Type “matrix” again or press Esc to exit.', { title: 'EASTER EGG', ttl: 5000 });
}
function stopMatrix() {
  if (!matrixCtrl) return;
  cancelAnimationFrame(matrixCtrl.raf);
  window.removeEventListener('resize', matrixCtrl.resize);
  matrixCtrl.cv.classList.remove('on');
  setTimeout(() => matrixCtrl?.cv?.classList.add('hidden'), 600);
  matrixCtrl = null;
}

/* ─────────────────────────────────────────────────────────
   COMMAND BAR
───────────────────────────────────────────────────────── */
const commands = [
  { id: 'help',         ic: '?', name: 'Help',                   sub: 'list available commands',           kb: '?',     run: cmdHelp },
  { id: 'clear-log',    ic: '⌫', name: 'Clear activity log',      sub: 'erase recent events',              kb: '',      run: () => { state.log = []; renderInitialLog(); pushLog('log cleared', 'ok'); } },
  { id: 'reset',        ic: '↺', name: 'Reset KAI Core',          sub: 'wipe local state and reboot',      kb: '',      run: cmdReset },
  { id: 'rename',       ic: 'A', name: 'Rename operator',         sub: 'change your display name',         kb: '',      run: cmdRename },
  { id: 'theme-green',  ic: '◉', name: 'Theme · forest green',    sub: 'default core accent',              kb: '',      run: () => setTheme('green') },
  { id: 'theme-terra',  ic: '◉', name: 'Theme · terracotta',      sub: 'warm harvest accent',              kb: '',      run: () => setTheme('terra') },
  { id: 'theme-gold',   ic: '◉', name: 'Theme · gold',            sub: 'premium accent',                   kb: '',      run: () => setTheme('gold') },
  { id: 'voice-toggle', ic: 'V', name: 'Toggle voice',                sub: 'speech recognition + synthesis',  kb: 'V',     run: () => toggleVoice() },
  { id: 'sound-toggle', ic: '♪', name: 'Toggle sound design',     sub: 'ui chimes and beeps',              kb: 'M',     run: () => { state.sound = !state.sound; saveState(); pushLog('sound: ' + (state.sound ? 'on' : 'off'), 'ok'); } },
  { id: 'identify',     ic: '◊', name: 'Identify',                sub: 'who am i, what is this',           kb: '',      run: cmdIdentify },
  { id: 'status',       ic: 'i', name: 'System status',           sub: 'speak current vitals',             kb: '',      run: cmdStatus },
  { id: 'time',         ic: '⌚', name: 'What time is it?',         sub: 'announce local time',              kb: 'T',     run: cmdTime },
  { id: 'weather',      ic: '☀', name: 'Weather snapshot',         sub: 'current local conditions',         kb: '',      run: cmdWeather },
  { id: 'add-mission',  ic: '+', name: 'Add mission',              sub: 'create new mission entry',         kb: '',      run: cmdAddMission },
  { id: 'snapshot',     ic: '⎘', name: 'Snapshot state',           sub: 'log full snapshot to console',     kb: '',      run: cmdSnapshot },
  { id: 'doc',          ic: '?', name: 'About KAI Core',           sub: 'what is this interface',           kb: '',      run: cmdAbout },
  { id: 'note',         ic: '✎', name: 'Quick note',                sub: 'capture a thought, persisted',     kb: 'N',     run: cmdNote },
  { id: 'notes',        ic: '≡', name: 'Recent notes',              sub: 'review the last few notes',        kb: '',      run: listNotes },
  { id: 'notes-clear',  ic: '⌫', name: 'Clear notes',               sub: 'wipe all captured notes',          kb: '',      run: clearNotes },
  { id: 'timer',        ic: '⏱', name: 'Set timer',                 sub: 'remind me in N minutes',           kb: '',      run: cmdTimer },
  { id: 'cheat',        ic: '?', name: 'Keyboard cheatsheet',       sub: 'see all shortcuts',                kb: '?',     run: openCheat },
  { id: 'matrix',       ic: '◊', name: 'Matrix rain',               sub: 'toggle the easter egg',            kb: '',      run: () => matrixCtrl ? stopMatrix() : startMatrix() },
  { id: 'calc',         ic: '=', name: 'Calculator',                sub: 'evaluate an expression',           kb: '',      run: cmdCalc },
];

let cmdOpen = false;
let cmdFiltered = commands.slice();
let cmdIdx = 0;

function openCmd() {
  if (cmdOpen) return;
  cmdOpen = true;
  Audio.open();
  $('#cmd').classList.remove('hidden');
  $('#cmd-input').value = '';
  cmdFiltered = commands.slice();
  cmdIdx = 0;
  renderCmd();
  setTimeout(() => $('#cmd-input').focus(), 30);
}

function closeCmd() {
  if (!cmdOpen) return;
  cmdOpen = false;
  Audio.close();
  $('#cmd').classList.add('hidden');
}

function renderCmd() {
  const list = $('#cmd-list');
  list.innerHTML = '';
  cmdFiltered.forEach((c, i) => {
    list.insertAdjacentHTML('beforeend',
      `<div class="cmd-row ${i === cmdIdx ? 'active' : ''}" data-idx="${i}">
        <span class="ic">${c.ic}</span>
        <span class="nm">${c.name}<small>${c.sub}</small></span>
        <span class="kb">${c.kb}</span>
      </div>`);
  });
  $$('.cmd-row', list).forEach(row => {
    row.addEventListener('mouseenter', () => { cmdIdx = parseInt(row.dataset.idx); renderCmd(); });
    row.addEventListener('click', () => { runCmd(cmdFiltered[parseInt(row.dataset.idx)]); });
  });
}

function filterCmd(q) {
  q = q.trim().toLowerCase();
  cmdFiltered = !q ? commands.slice()
    : commands.filter(c => (c.name + ' ' + c.sub + ' ' + c.id).toLowerCase().includes(q));
  cmdIdx = 0;
  renderCmd();
}

function runCmd(c) {
  if (!c) return;
  closeCmd();
  pushLog('cmd: ' + c.name.toLowerCase(), 'ok');
  Audio.ok();
  try { c.run(); } catch (e) { console.error(e); pushLog('cmd failed: ' + c.id, 'err'); }
}

/* Command implementations */
function cmdHelp() {
  const names = commands.map(c => c.name).join(', ');
  speak('I support: ' + commands.map(c => c.name).slice(0, 6).join(', ') + ', and more.');
  pushLog('available: ' + names, 'ok');
}
function cmdReset() {
  if (!confirm('Wipe KAI Core local state and reload?')) return;
  localStorage.removeItem(STORE_KEY);
  location.reload();
}
function cmdRename() {
  const next = prompt('Operator name:', state.name);
  if (next && next.trim()) {
    state.name = next.trim();
    $('#hud-name').textContent = state.name;
    saveState();
    speak('Acknowledged, ' + state.name + '.');
    pushLog('operator renamed to ' + state.name, 'ok');
  }
}
function cmdIdentify() {
  speak('I am KAI Core, an autonomous interface for von Kaiser systems. You are ' + state.name + '.');
}
function cmdStatus() {
  const s = state.sys;
  speak(`Vitals nominal. CPU ${Math.round(s.cpu)}, memory ${Math.round(s.mem)}, GPU ${Math.round(s.gpu)} percent.`);
}
function cmdTime() {
  const d = new Date();
  speak('It is ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) + '.');
}
function cmdWeather() {
  speak(`Conditions ${state.local.weather.toLowerCase()}, ${Math.round(state.local.temp)} degrees, humidity ${Math.round(state.local.humidity)} percent.`);
}
function cmdAddMission() {
  const t = prompt('Mission title:'); if (!t) return;
  state.missions.unshift({ t, m: 'manual · ' + new Date().toLocaleTimeString(), s: 'ok' });
  if (state.missions.length > 12) state.missions.pop();
  renderMissions(); saveState();
  speak('Mission added: ' + t);
}
function cmdSnapshot() {
  console.log('KAI CORE SNAPSHOT', JSON.parse(JSON.stringify(state)));
  speak('Snapshot logged to console.');
}
function cmdAbout() {
  speak('This is the KAI Core interface — a personal command shell built on the Von Kaiser design system. Press command K to invoke me, or use voice.');
}
function cmdNote() {
  const t = prompt('Quick note:');
  if (t) addNote(t);
}
function cmdTimer() {
  const raw = prompt('Timer — e.g. "5 minutes", "30s", or "1h30m":');
  if (!raw) return;
  const ms = parseDurationMs(raw);
  if (!ms) { toast('Could not parse duration.', { level: 'err' }); return; }
  const label = prompt('Label (optional):') || 'timer';
  setTimer(ms, label);
}
function cmdCalc() {
  const e = prompt('Expression (e.g. 12*8+4):');
  if (!e) return;
  const v = safeEval(e);
  if (v === null) { toast('Not a valid expression.', { level: 'err' }); return; }
  toast(e + ' = ' + v, { title: 'CALC' });
  speak(e + ' equals ' + v);
}

function setTheme(t) {
  state.theme = t;
  document.documentElement.style.setProperty('--green', t === 'terra' ? '#E59060' : t === 'gold' ? '#D9B650' : '#7AE6A8');
  document.documentElement.style.setProperty('--green-mid', t === 'terra' ? '#C4714A' : t === 'gold' ? '#B8973A' : '#4FBE7E');
  if (orb) orb.setTheme(t);
  saveState();
  pushLog('theme: ' + t, 'ok');
}

/* ─────────────────────────────────────────────────────────
   VOICE — speech recognition + speech synthesis
───────────────────────────────────────────────────────── */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
let listening = false;

function speak(text) {
  pushLog('kai: ' + text.toLowerCase(), 'ok');
  showSpeechCap(text);
  if (!('speechSynthesis' in window) || !state.voice) return;
  Audio.speak();
  if (orb) orb.setSpeaking(true);
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02; u.pitch = 0.95; u.volume = 0.9;
    // Prefer an english voice if available
    const voices = speechSynthesis.getVoices();
    const v = voices.find(v => /en[-_](GB|US)/i.test(v.lang)) || voices[0];
    if (v) u.voice = v;
    u.onend = () => { if (orb) orb.setSpeaking(false); hideSpeechCap(); };
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {}
}

let capTimer = null;
function showSpeechCap(text) {
  const el = $('#speech-cap'); if (!el) return;
  clearTimeout(capTimer);
  el.textContent = '“ ' + text + ' ”';
  el.classList.add('show');
}
function hideSpeechCap() {
  capTimer = setTimeout(() => $('#speech-cap')?.classList.remove('show'), 800);
}

function toggleVoice() {
  state.voice = !state.voice;
  saveState();
  const chip = $('#voice-toggle');
  if (state.voice) {
    chip.classList.add('on');
    pushLog('voice: enabled', 'ok');
    speak('Voice online. Say a command after the chime.');
    startListening();
  } else {
    chip.classList.remove('on');
    pushLog('voice: disabled', 'warn');
    stopListening();
    try { speechSynthesis.cancel(); } catch {}
  }
}

function startListening() {
  if (!SR) { pushLog('voice: recognition unsupported', 'err'); return; }
  if (recognizer) try { recognizer.stop(); } catch {}
  recognizer = new SR();
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.lang = navigator.language || 'en-US';

  recognizer.onstart = () => { listening = true; orb?.setListening(true); };
  recognizer.onend   = () => { listening = false; orb?.setListening(false); if (state.voice) setTimeout(startListening, 600); };
  recognizer.onerror = (e) => { pushLog('voice err: ' + e.error, 'warn'); };
  recognizer.onresult = (ev) => {
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      const txt = r[0].transcript.trim();
      if (r.isFinal) {
        pushLog('heard: "' + txt + '"', 'ok');
        handleVoice(txt);
      } else {
        showSpeechCap('… ' + txt);
      }
    }
  };
  try { recognizer.start(); } catch {}
}

function stopListening() {
  if (!recognizer) return;
  try { recognizer.stop(); } catch {}
  recognizer = null;
  listening = false;
  orb?.setListening(false);
}

function handleVoice(txt) {
  const t = txt.toLowerCase();
  // Wake word optional — if it starts with "kai", strip it.
  const stripped = t.replace(/^(kai[,\s]*|hey kai[,\s]*|core[,\s]*)/, '').trim();

  // Intent: "take a note: ..." / "remember that ..." / "note ..."
  const noteM = stripped.match(/^(?:take a note(?:[,:]| that| -)?\s*|note that\s*|remember(?: that)?\s*|note(?:[,:]| -)?\s*)(.+)$/i);
  if (noteM && noteM[1]) { addNote(noteM[1]); speak('Noted.'); return; }

  // Intent: "set a timer for 5 minutes [labeled X]"
  const timerM = stripped.match(/(?:set (?:a )?timer|remind me)(?: for| in)?\s+(.+?)(?:\s+(?:for|to|about|called|labeled)\s+(.+))?$/i);
  if (timerM) {
    const ms = parseDurationMs(timerM[1]);
    if (ms) { setTimer(ms, timerM[2] || 'timer'); speak('Timer set.'); return; }
  }

  // Intent: math — "what is 12 times 8 plus 4"
  const mathM = stripped.match(/^(?:what(?:'s| is)?|calculate|compute)\s+(.+)$/i);
  if (mathM) {
    const expr = mathM[1]
      .replace(/plus/g, '+').replace(/minus/g, '-')
      .replace(/times|multiplied by|x/g, '*')
      .replace(/divided by|over/g, '/');
    const v = safeEval(expr);
    if (v !== null) { speak(`${mathM[1]} equals ${v}.`); toast(`${mathM[1]} = ${v}`, { title: 'CALC' }); return; }
  }

  const matchers = [
    [/\b(time|clock|hour)\b/, cmdTime],
    [/\b(status|vitals|how (are|is)|how('s| is) the system)\b/, cmdStatus],
    [/\b(weather|temp|temperature|humidity)\b/, cmdWeather],
    [/\b(who are you|identify|introduce yourself|what are you)\b/, cmdIdentify],
    [/\b(help|commands|what can you do)\b/, cmdHelp],
    [/\b(theme).*\b(terra|terracotta|orange)\b/, () => setTheme('terra')],
    [/\b(theme).*\b(gold|amber)\b/, () => setTheme('gold')],
    [/\b(theme).*\b(green|forest|default)\b/, () => setTheme('green')],
    [/\b(clear|wipe).*\b(log|activity)\b/, () => { state.log=[]; renderInitialLog(); pushLog('log cleared','ok'); speak('Log cleared.'); }],
    [/\b(open|show).*\b(commands?|menu|palette)\b/, openCmd],
    [/\b(snapshot)\b/, cmdSnapshot],
    [/\b(reset|reboot)\b/, () => speak('Reset requires confirmation. Use command K to confirm.')],
    [/\b(stop|quiet|shut up|silence)\b/, () => { try{speechSynthesis.cancel();}catch{} speak('Standing by.'); }],
    [/\b(thank|thanks)\b/, () => speak('At your service.')],
    [/\b(matrix|rain|neo)\b/, () => { matrixCtrl ? stopMatrix() : startMatrix(); }],
    [/\b(cheatsheet|shortcuts|keys)\b/, openCheat],
    [/\b(notes?|read my notes)\b/, listNotes],
  ];
  for (const [re, fn] of matchers) {
    if (re.test(stripped)) { fn(); return; }
  }
  speak("I didn't catch a command in that. Try saying status, time, or help.");
}

/* ─────────────────────────────────────────────────────────
   CURSOR + HOVER GLOWS
───────────────────────────────────────────────────────── */
function bindCursor() {
  const c  = $('#cursor');
  const tr = $('#cursor-trail');
  let x = window.innerWidth/2, y = window.innerHeight/2;
  let tx = x, ty = y;
  window.addEventListener('mousemove', (e) => {
    tx = e.clientX; ty = e.clientY;
    c.style.left = tx + 'px';
    c.style.top  = ty + 'px';
  });
  function trail() {
    x += (tx - x) * 0.18; y += (ty - y) * 0.18;
    tr.style.left = x + 'px';
    tr.style.top  = y + 'px';
    requestAnimationFrame(trail);
  }
  trail();
  window.addEventListener('mousedown', () => c.classList.add('active'));
  window.addEventListener('mouseup',   () => c.classList.remove('active'));

  // hover beeps on interactive elements
  const hoverSel = 'button, .chip, .panel, .cmd-row, kbd, input';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(hoverSel)) Audio.hover();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('button, .chip, .cmd-row')) Audio.click();
  });
}

/* ─────────────────────────────────────────────────────────
   HUD INIT
───────────────────────────────────────────────────────── */
function initHud() {
  $('#hud-name').textContent = state.name;
  $('#ses-id').textContent = 'kai-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  $('#voice-toggle').classList.toggle('on', !!state.voice);

  orb = initOrb();
  setTheme(state.theme || 'green');

  renderMissions();
  renderComms();
  renderInitialLog();
  pushLog('kai core online · session #' + state.sessions, 'ok');

  bindNetwork();
  bindBattery();
  bindCursor();

  tickClock();
  tickTelemetry();
  setInterval(tickClock, 1000);
  setInterval(tickTelemetry, 2000);

  // Periodically push a small log entry
  setInterval(() => {
    const sample = [
      ['telemetry packet received',  'ok'],
      ['mesh peer handshake',        'ok'],
      ['sensor zone-3 nominal',      'ok'],
      ['cold-chain temp logged',     'ok'],
      ['frame buffer flushed',       'ok'],
      ['cache pruned',               'warn'],
      ['queue drained',              'ok'],
    ];
    if (Math.random() < 0.5) {
      const [m, lv] = sample[irand(0, sample.length - 1)];
      pushLog(m, lv);
    }
  }, 6500);

  // Bind global key handlers
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      cmdOpen ? closeCmd() : openCmd();
      return;
    }
    if (e.key === 'Escape') {
      if (cmdOpen)               { closeCmd(); return; }
      if (!$('#cheat').classList.contains('hidden'))   { closeCheat(); return; }
      if (matrixCtrl)            { stopMatrix(); return; }
    }
    if (cmdOpen) {
      if (e.key === 'ArrowDown') { cmdIdx = Math.min(cmdFiltered.length - 1, cmdIdx + 1); renderCmd(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { cmdIdx = Math.max(0, cmdIdx - 1); renderCmd(); e.preventDefault(); }
      else if (e.key === 'Enter') { runCmd(cmdFiltered[cmdIdx]); e.preventDefault(); }
      return;
    }
    // Single-key shortcuts outside command bar / inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (k === 'v') toggleVoice();
    else if (k === 't') cmdTime();
    else if (k === 'm') { state.sound = !state.sound; saveState(); pushLog('sound ' + (state.sound ? 'on' : 'off'), 'ok'); }
    else if (k === '?') openCheat();
    else if (k === 'n') cmdNote();
  });

  // Cheatsheet close handlers
  $('#cheat-close').addEventListener('click', closeCheat);
  $('#cheat').addEventListener('click', (e) => { if (e.target.id === 'cheat') closeCheat(); });

  // Page visibility — dim orb when tab is away
  document.addEventListener('visibilitychange', () => {
    $('#hud').classList.toggle('away', document.hidden);
    if (document.hidden) pushLog('session: backgrounded', 'warn');
    else                 pushLog('session: foregrounded', 'ok');
  });

  // Resume any pending timers from previous session
  resumeTimers();

  // Welcome toast
  setTimeout(() => toast('KAI Core online. Press ⌘K for commands, ? for shortcuts.', { title: 'WELCOME' }), 800);

  $('#cmd-input').addEventListener('input', (e) => {
    const v = e.target.value.trim().toLowerCase();
    if (v === 'matrix' || v === 'neo') { closeCmd(); matrixCtrl ? stopMatrix() : startMatrix(); return; }
    filterCmd(e.target.value);
  });
  $('#open-cmd').addEventListener('click', openCmd);
  $('#voice-toggle').addEventListener('click', toggleVoice);
  $('#cmd').addEventListener('click', (e) => { if (e.target.id === 'cmd') closeCmd(); });

  // Preload speech voices (Chrome populates async)
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};

  // Greet
  setTimeout(() => {
    const hour = new Date().getHours();
    const g = hour < 5 ? 'You\'re up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    showSpeechCap(g + ', ' + state.name + '.');
    setTimeout(hideSpeechCap, 2400);
  }, 600);

  if (state.voice) startListening();
}

/* ─────────────────────────────────────────────────────────
   GO
───────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  // Make boot click-skippable
  $('#boot').addEventListener('click', () => {
    $('#boot').classList.add('fade-out');
    setTimeout(() => $('#boot').remove(), 500);
  });
  runBoot();
});
})();
