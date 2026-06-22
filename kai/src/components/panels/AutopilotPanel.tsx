/* ============================================================
   AutopilotPanel — the morning loop.

   One button. Tap, KAI reads every connector and Spine surface,
   drafts every move worth making, queues them in
   ConfirmationGate, and writes a one-paragraph summary of what
   it did and why.

   You then do one approval pass over coffee. Five minutes, day
   set up.

   Defaults to manual run. Auto-run on first visit per day is
   off-by-default — see toggle on the panel (persisted in the
   autopilot state).
   ============================================================ */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plane, Loader2, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import Panel from '../Panel';
import { useKaiVersion } from '../../lib/kai/mirror';
import {
  runAutopilot, getAutopilotState, dismissLastRun,
  type AutopilotPhase, type AutopilotRun,
} from '../../lib/kai/autopilot';
import { sfx } from '../../lib/sound';
import { operator } from '../../kaiConfig';
import { emitAction } from '../../lib/actions';

const PHASE_LABEL: Record<AutopilotPhase, string> = {
  idle:         'idle',
  reading:      'reading connectors',
  drafting:     'drafting proposals',
  summarising:  'summarising',
  done:         'done',
  error:        'error',
};

export default function AutopilotPanel({ delay = 0 }: { delay?: number }) {
  useKaiVersion();
  const state = getAutopilotState();
  const last = state.lastRun;

  const [busy, setBusy]         = useState(false);
  const [phase, setPhase]       = useState<AutopilotPhase>(last?.phase || 'idle');
  const [phaseHint, setPhaseHint] = useState<string>('');
  const [expanded, setExpanded] = useState(false);

  /* If a previous run errored or finished, reflect that as the
     baseline phase. busy === false means we're not actively
     running; the phase is informational. */
  useEffect(() => {
    if (last && !busy) setPhase(last.phase);
  }, [last?.startedAt, busy]);

  async function go() {
    if (busy) return;
    setBusy(true);
    setPhase('reading');
    setPhaseHint('');
    sfx.whoosh();
    try {
      const run = await runAutopilot((p, detail) => {
        setPhase(p);
        if (detail) setPhaseHint(detail);
      });
      if (run.phase === 'done') sfx.confirm();
      else                       sfx.error();
    } finally {
      setBusy(false);
    }
  }

  const tag =
    busy                       ? PHASE_LABEL[phase] :
    !last                      ? 'never run' :
    last.phase === 'done'      ? `${last.proposals_created} drafted` :
    last.phase === 'error'     ? 'last run errored' :
                                 PHASE_LABEL[last.phase];

  return (
    <Panel num="17" title="The Autopilot" tag={tag} delay={delay}>
      <div className="space-y-3">

        <p className="font-mono text-[10.5px] text-steel/80 leading-relaxed">
          Reads every connector and the Spine. Drafts every move worth your tap.
          Sends nothing — everything stacks in the gate for one approval pass.
        </p>

        {/* Big button */}
        <button
          onClick={go}
          disabled={busy}
          className={
            'w-full flex items-center justify-center gap-2 px-3 py-3 rounded border ' +
            'border-amber/50 text-amber hover:bg-amber/10 hover:shadow-glow-amber transition ' +
            'disabled:opacity-60 disabled:cursor-not-allowed text-[12px] tracking-[0.16em] uppercase'
          }
        >
          {busy
            ? <><Loader2 size={13} className="animate-spin" /> {PHASE_LABEL[phase]}{phaseHint ? ' · ' + phaseHint : ''}</>
            : <><Plane size={13} /> Run the morning loop</>}
        </button>

        {/* Last-run card */}
        {last && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={
              'rounded border bg-ink2/30 ' +
              (last.phase === 'error' ? 'border-danger/30' : 'border-amber/15')
            }
          >
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left"
            >
              {expanded
                ? <ChevronDown size={11} className="text-steel shrink-0" />
                : <ChevronRight size={11} className="text-steel shrink-0" />}
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-steel/90">last run</span>
              <span className="font-mono text-[10px] text-steel/70 tabular-nums">{rel(last.startedAt)}</span>
              <span className="ml-auto font-mono text-[10px] tabular-nums text-bone/85">
                {last.phase === 'error'
                  ? <span className="text-danger">errored</span>
                  : <>{last.proposals_created} drafted · {last.toolCalls.length} reads</>}
              </span>
            </button>

            {expanded && (
              <div className="px-3 pb-3 pt-1 space-y-2.5">
                {last.error ? (
                  <div className="flex items-start gap-2 text-danger text-[11.5px]">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span className="flex-1">{last.error}</span>
                  </div>
                ) : (
                  <p className="font-sans text-bone/90 text-[12.5px] leading-relaxed">
                    {last.summary || 'No summary returned.'}
                  </p>
                )}

                {last.toolCalls.length > 0 && (
                  <div>
                    <div className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-steel/70 mb-1">
                      tool trace
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {dedupeCounts(last.toolCalls.map(t => t.name)).map(([name, n]) => (
                        <span
                          key={name}
                          className={
                            'px-1.5 py-0.5 rounded border font-mono text-[9.5px] tracking-[0.06em] ' +
                            (name.startsWith('propose_')
                              ? 'border-emerald/40 text-emerald/95 bg-emerald/[0.06]'
                              : 'border-amber/20 text-steel')
                          }
                          title={name}
                        >
                          {name}{n > 1 ? ` ×${n}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {last.phase === 'done' && last.proposals_created > 0 && (
                  <button
                    onClick={() => emitAction({ type: 'ping-panel', panel: 'gate' })}
                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded border border-amber/40 text-amber hover:bg-amber/10 text-[10px] tracking-[0.16em] uppercase"
                  >
                    <Wrench size={11} /> Approve in the gate ↑
                  </button>
                )}

                <button
                  onClick={() => { sfx.click(); dismissLastRun(); }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1 text-[10px] tracking-[0.16em] uppercase text-steel/65 hover:text-bone/85 transition"
                >
                  <RefreshCw size={10} /> clear history
                </button>
              </div>
            )}
          </motion.div>
        )}

      </div>
    </Panel>
  );
}

function dedupeCounts(names: string[]): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const n of names) map.set(n, (map.get(n) || 0) + 1);
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function rel(ms: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000)           return 'just now';
  if (diff < 60 * 60_000)      return Math.max(1, Math.round(diff / 60_000)) + 'm ago';
  if (diff < 24 * 60 * 60_000) return Math.round(diff / (60 * 60_000)) + 'h ago';
  try { return new Date(ms).toLocaleDateString(operator.locale, { day: 'numeric', month: 'short' }); }
  catch { return ''; }
}
