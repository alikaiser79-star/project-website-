/* ============================================================
   SystemPulse — bottom-left live telemetry. The verification rule
   made permanent UI: clock, deployed build SHA, a true FPS meter
   (rAF frame counter), network state, and battery where the browser
   exposes it. Hidden on the Command view (the core owns that canvas).
   pointer-events: none — it never eats a tap.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { getSyncStatus, onSyncStatus, type SyncStatus } from '../lib/kai/sync';

declare const __BUILD_ID__: string;

interface Props { hidden?: boolean; }

export default function SystemPulse({ hidden = false }: Props) {
  const [clock, setClock] = useState('');
  const [fps, setFps] = useState(0);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [batt, setBatt] = useState<{ level: number; charging: boolean } | null>(null);
  const [sync, setSync] = useState<SyncStatus>(() => getSyncStatus());
  const raf = useRef(0);

  /* sync state — subscribe to the Spine-sync engine */
  useEffect(() => onSyncStatus(() => setSync(getSyncStatus())), []);

  /* clock — 1 Hz */
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  /* true FPS — count rAF frames per second */
  useEffect(() => {
    if (hidden) return;
    let frames = 0, last = performance.now();
    const loop = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) { setFps(Math.round((frames * 1000) / (now - last))); frames = 0; last = now; }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [hidden]);

  /* network */
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* battery (where supported) */
  useEffect(() => {
    let b: any;
    const nav = navigator as any;
    if (typeof nav.getBattery !== 'function') return;
    let alive = true;
    nav.getBattery().then((battery: any) => {
      if (!alive) return;
      b = battery;
      const upd = () => setBatt({ level: Math.round(battery.level * 100), charging: battery.charging });
      upd();
      battery.addEventListener('levelchange', upd);
      battery.addEventListener('chargingchange', upd);
      b._upd = upd;
    }).catch(() => {});
    return () => {
      alive = false;
      if (b && b._upd) { b.removeEventListener('levelchange', b._upd); b.removeEventListener('chargingchange', b._upd); }
    };
  }, []);

  if (hidden) return null;

  /* Long-press (500ms) opens Rewind (§7.8) — dispatched globally so the
     Command view's scrubber can pick it up. */
  let lp: ReturnType<typeof setTimeout> | undefined;
  const down = () => { lp = setTimeout(() => window.dispatchEvent(new Event('kai:rewind')), 500); };
  const up = () => { if (lp) clearTimeout(lp); };

  const sep = <span className="sp-sep">·</span>;
  return (
    <div className="system-pulse" onPointerDown={down} onPointerUp={up} onPointerLeave={up} title="long-press to rewind">
      <span className="sp-clock">{clock}</span>{sep}
      <span className="sp-sha" title="deployed build SHA">{__BUILD_ID__}</span>{sep}
      <span className={fps >= 50 ? 'sp-fps ok' : fps >= 30 ? 'sp-fps mid' : 'sp-fps low'}>{fps} FPS</span>{sep}
      <span className={online ? 'sp-net ok' : 'sp-net low'}>{online ? 'ONLINE' : 'OFFLINE'}</span>
      {batt && <>{sep}<span className="sp-batt">{batt.charging ? '⚡' : ''}{batt.level}%</span></>}
      {sync !== 'off' && <>{sep}<span
        className={'sp-sync ' + (sync === 'synced' ? 'ok' : sync === 'failing' ? 'bad' : 'wait')}
        title={sync === 'synced' ? 'Spine synced' : sync === 'failing' ? 'Spine sync failing' : sync === 'syncing' ? 'Spine syncing…' : 'Spine sync pending'}
      >⬤</span></>}
    </div>
  );
}
