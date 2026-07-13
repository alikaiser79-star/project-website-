/* ============================================================
   DAS RADAR (§19) — the panel (Ops view). Live intelligence at a
   glance: each WATCH's health + last cited finding, today's ≤3
   RECOMMENDATIONS, and a manual SWEEP. Read-only — a recommendation is
   surfaced text Ali acts on; nothing here sends, prices, or publishes.
   The sweep also fires on mount (throttled) so the radar stays warm.
   ============================================================ */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Radar, Loader2, Plus } from 'lucide-react';
import { useKaiVersion } from '../../lib/kai/mirror';
import { listWatches, addWatch, recentFindings, type WatchCadence } from '../../lib/kai/watches';
import { sweepNow, openRecommendations, radarLine, radarHealth, type RadarHealth } from '../../lib/kai/radar';

const CADENCES: WatchCadence[] = ['daily', 'weekly', 'monthly'];

export default function RadarPanel({ delay = 0 }: { delay?: number }) {
  useKaiVersion();
  const [sweeping, setSweeping] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [cadence, setCadence] = useState<WatchCadence>('weekly');
  const [health, setHealth] = useState<RadarHealth | null>(null);

  const watches = listWatches();
  const recos = openRecommendations();
  const findings = recentFindings(2);
  const line = radarLine();

  /* warm the radar on first mount — sweepNow throttles itself. */
  useEffect(() => {
    let live = true;
    setSweeping(true);
    sweepNow().catch(() => {}).finally(() => { if (live) setSweeping(false); });
    radarHealth().then((h) => { if (live) setHealth(h); }).catch(() => {});
    return () => { live = false; };
  }, []);

  /* keys missing → tell the operator exactly which one, no curl needed. */
  const missing = health && !health.ready
    ? [!health.anthropic && 'ANTHROPIC_API_KEY', !health.tavily && 'TAVILY_API_KEY'].filter(Boolean).join(' + ')
    : null;

  async function forceSweep() {
    setSweeping(true);
    try { await sweepNow(true); } catch { /* ignore */ }
    setSweeping(false);
  }

  function submitWatch(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !query.trim()) return;
    addWatch({ name: name.trim(), query: query.trim(), cadence, domain: 'custom' });
    setName(''); setQuery(''); setCadence('weekly'); setAdding(false);
  }

  /* last finding per watch, for the health rows. */
  const lastByWatch: Record<string, { summary: string; changed: boolean }> = {};
  for (const f of findings) {
    const id = String(f.meta?.watchId || '');
    if (id && !lastByWatch[id]) lastByWatch[id] = { summary: String(f.meta?.summary || ''), changed: (f.value ?? 0) > 0 };
  }

  return (
    <motion.div
      data-panel="27"
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-lg p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Radar size={14} className="text-amber" />
        <span className="font-mono text-[11px] tracking-[0.25em] text-amber/80 uppercase">Radar</span>
        <button onClick={forceSweep} disabled={sweeping} title="sweep now" className="ml-auto text-steel/60 hover:text-amber disabled:opacity-40">
          {sweeping ? <Loader2 size={12} className="animate-spin" /> : <span className="font-mono text-[9px] tracking-[0.2em] uppercase">sweep</span>}
        </button>
      </div>

      {missing && (
        <div className="font-mono text-[10px] text-amber/70 mb-3 leading-snug">
          Radar idle — set {missing} in Vercel, then redeploy.
        </div>
      )}
      {line && <div className="font-mono text-[10px] text-steel/60 mb-3">{line}</div>}

      {/* recommendations — surfaced, not fired */}
      {recos.length > 0 && (
        <div className="mb-3 flex flex-col gap-1.5">
          {recos.map((r) => (
            <div key={r.id} className="border border-emerald-400/20 rounded px-3 py-2">
              <div className="font-mono text-[12px] text-emerald-200/90">{String(r.meta?.title || '')}</div>
              {r.meta?.why ? <div className="font-mono text-[10px] text-steel/60 mt-0.5">{String(r.meta.why)}</div> : null}
            </div>
          ))}
        </div>
      )}

      {/* watch health */}
      <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
        {watches.length === 0 && <div className="font-mono text-[11px] text-steel/50">No watches yet.</div>}
        {watches.map((w) => {
          const last = lastByWatch[w.id];
          return (
            <div key={w.id} className="border border-white/[0.06] rounded px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[12px] text-bone/90 truncate">{w.name}</span>
                <span className={'font-mono text-[8px] tracking-[0.15em] uppercase shrink-0 ml-2 ' + (last?.changed ? 'text-emerald-300' : 'text-steel/40')}>
                  {w.cadence}{last?.changed ? ' · moved' : ''}
                </span>
              </div>
              {last?.summary && <div className="font-mono text-[10px] text-steel/55 mt-0.5 truncate">{last.summary}</div>}
              {!last && !w.lastRun && <div className="font-mono text-[10px] text-steel/40 mt-0.5">not yet swept</div>}
            </div>
          );
        })}
      </div>

      {/* custom watch (the ⌘K "watch X for Y" surface, inline) */}
      {adding ? (
        <form onSubmit={submitWatch} className="mt-3 flex flex-col gap-1.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="watch name" className="bg-black/30 border border-white/[0.08] rounded px-2.5 py-1.5 text-bone/90 font-mono text-[11px] outline-none focus:border-amber/40" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="what to search for…" className="bg-black/30 border border-white/[0.08] rounded px-2.5 py-1.5 text-bone/90 font-mono text-[11px] outline-none focus:border-amber/40" />
          <div className="flex gap-1.5">
            {CADENCES.map((c) => (
              <button type="button" key={c} onClick={() => setCadence(c)} className={'font-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1 rounded border ' + (cadence === c ? 'border-amber/50 text-amber' : 'border-white/10 text-steel/50')}>{c}</button>
            ))}
            <button type="submit" disabled={!name.trim() || !query.trim()} className="ml-auto px-3 rounded border border-amber/30 text-amber font-mono text-[11px] disabled:opacity-40">add</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-3 flex items-center gap-1 font-mono text-[10px] tracking-[0.15em] uppercase text-steel/50 hover:text-amber transition">
          <Plus size={11} /> watch something
        </button>
      )}
    </motion.div>
  );
}
