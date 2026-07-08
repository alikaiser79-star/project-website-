/* ============================================================
   MISSION PANEL — the war room (Ops view). Launch missions from
   presets or free text; watch the live step feed; read artifacts;
   pause / kill. Every external side effect the agent finds becomes a
   proposal at the Gate — nothing here sends, publishes, or deploys.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Rocket, Square, Pause, Loader2 } from 'lucide-react';
import { PRESETS, launchMission, runMission, setMissionStatus, activeMissions, type Mission } from '../../lib/kai/agent';

const KIND_COLOR: Record<string, string> = {
  think: 'text-steel/70', tool: 'text-amber/80', propose: 'text-emerald-300',
  result: 'text-bone', error: 'text-danger', note: 'text-steel/60',
};

export default function MissionPanel({ delay = 0 }: { delay?: number }) {
  const [goal, setGoal] = useState('');
  const [mission, setMission] = useState<Mission | null>(() => activeMissions()[0] || null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mission?.steps.length]);

  function launch(text: string, preset?: string) {
    const t = text.trim();
    if (!t) return;
    const m = launchMission(t, preset);
    setMission(m);
    setGoal('');
    runMission(m, (u) => setMission({ ...u })).catch(() => {});
  }

  const running = mission?.status === 'running';

  return (
    <motion.div
      data-panel="24"
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-lg p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Rocket size={14} className="text-amber" />
        <span className="font-mono text-[11px] tracking-[0.25em] text-amber/80 uppercase">Missions</span>
        {mission && (
          <span className={'font-mono text-[9px] tracking-[0.2em] uppercase ml-auto ' + (running ? 'text-emerald-300' : mission.status === 'failed' ? 'text-danger' : 'text-steel/60')}>
            {running && <Loader2 size={9} className="inline animate-spin mr-1" />}{mission.status}
          </span>
        )}
      </div>

      {/* presets */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => launch(p.template, p.id)}
            disabled={running}
            title={p.hint}
            className="font-mono text-[10px] tracking-[0.1em] px-2.5 py-1.5 rounded border border-amber/25 text-amber/85 hover:border-amber/50 hover:text-amber disabled:opacity-40 transition"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* free-text launch */}
      <form className="flex gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); launch(goal); }}>
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="give KAI a mission…"
          disabled={running}
          className="flex-1 bg-black/30 border border-white/[0.08] rounded px-3 py-2 text-bone/90 font-mono text-[12px] outline-none focus:border-amber/40"
        />
        <button type="submit" disabled={running || !goal.trim()} className="px-3 rounded border border-amber/30 text-amber disabled:opacity-40">→</button>
      </form>

      {/* live feed */}
      {mission && (
        <>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[9px] tracking-[0.2em] text-steel/50 uppercase">Step feed · {mission.steps.length}/12</span>
            {running && (
              <span className="flex gap-1.5">
                <button onClick={() => setMissionStatus(mission.id, 'paused')} title="pause" className="text-steel/60 hover:text-amber"><Pause size={12} /></button>
                <button onClick={() => setMissionStatus(mission.id, 'failed')} title="kill" className="text-steel/60 hover:text-danger"><Square size={12} /></button>
              </span>
            )}
          </div>
          <div ref={feedRef} className="max-h-44 overflow-y-auto flex flex-col gap-1.5 mb-2">
            {mission.steps.length === 0 && <div className="font-mono text-[11px] text-steel/50">working…</div>}
            {mission.steps.map((s, i) => (
              <div key={i} className={'font-mono text-[11px] leading-snug ' + (KIND_COLOR[s.kind] || 'text-steel/70')}>
                <span className="text-steel/40">{s.tool ? `${s.tool} · ` : `${s.kind} · `}</span>{String(s.text || '').slice(0, 240)}
              </div>
            ))}
          </div>

          {/* proposals → Gate */}
          {mission.proposals.length > 0 && (
            <div className="mb-2 text-[10px] font-mono text-emerald-300/90">
              {mission.proposals.length} proposal{mission.proposals.length === 1 ? '' : 's'} queued for the Gate — approve to execute.
            </div>
          )}

          {/* artifacts */}
          {mission.artifacts.map((a, i) => (
            <details key={i} className="mb-1.5">
              <summary className="font-mono text-[10px] tracking-[0.15em] text-amber/70 uppercase cursor-pointer">Artifact · {a.title}</summary>
              <pre className="mt-1.5 max-h-52 overflow-auto text-[11px] text-bone/85 whitespace-pre-wrap bg-black/30 rounded p-2.5">{a.body}</pre>
            </details>
          ))}
        </>
      )}
    </motion.div>
  );
}
