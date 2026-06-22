/* ============================================================
   The Mirror — hook, panel, resolver bootstrap.

   useMirror() — reactive selector over commitments + score.
   startMirror() — call once at App boot; resolves on mount,
     every 6h, and on tab visibility change.
   MirrorPanel — dashboard card. Styled to match the rest of
     the panels (uses <Panel num title tag>).

   Tone: blunt. The score header is kept/resolved over 30 days.
   "Broken" lives in the panel so the user can't pretend it
   didn't happen.
   ============================================================ */

import { useCallback, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import Panel from '../../components/Panel';
import { subscribe, getVersion } from './store';
import {
  getCommitments, addCommitment, removeCommitment, resolveCommitments,
  mirrorScore,
  type Commitment, type CommitmentInput,
} from './commitments';

const DAY = 86_400_000;

/* Re-render any component when KAI stores change. Server-snapshot
   uses the same getter so SSR doesn't tear. */
export function useKaiVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

export function useMirror() {
  useKaiVersion();
  const commitments = getCommitments();
  const score = mirrorScore();
  const add    = useCallback((i: CommitmentInput) => addCommitment(i), []);
  const remove = useCallback((id: string) => removeCommitment(id), []);
  return { commitments, score, add, remove, resolveNow: () => resolveCommitments() };
}

/* Call once at App boot. Resolves the Mirror AND the Ledger
   on the same cadence — both feed off the Spine and a single
   pass keeps state consistent. */
export function startMirror(): () => void {
  /* Imported lazily to keep the import graph acyclic. */
  import('./ledger').then(m => m.resolvePromises()).catch(() => {});
  resolveCommitments();
  const iv = setInterval(() => {
    resolveCommitments();
    import('./ledger').then(m => m.resolvePromises()).catch(() => {});
  }, 6 * 60 * 60 * 1000);
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      resolveCommitments();
      import('./ledger').then(m => m.resolvePromises()).catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(iv);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

function daysLeft(c: Commitment): number {
  return Math.ceil((c.deadline - Date.now()) / DAY);
}

function scoreColor(pct: number | null): string {
  if (pct === null) return 'text-steel';
  if (pct >= 80) return 'text-emerald';
  if (pct >= 60) return 'text-amber';
  return 'text-danger';
}

export function MirrorPanel({ delay = 0 }: { delay?: number }) {
  const { commitments, score, remove } = useMirror();

  const open = commitments
    .filter((c) => c.status === 'open')
    .sort((a, b) => a.deadline - b.deadline);
  const broken = commitments
    .filter((c) => c.status === 'broken')
    .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0));
  const kept = commitments.filter((c) => c.status === 'kept');

  const tag = score.score === null
    ? `${open.length} open`
    : `${score.score}% · ${score.kept}/${score.total}`;

  const empty = commitments.length === 0;

  return (
    <Panel num="09" title="The Mirror" tag={tag} delay={delay}>
      <div className="space-y-3">

        {/* Hero strip — score + window note */}
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel mb-1">kept · 30d</div>
          <div className={'font-sans tabular-nums leading-none text-[34px] sm:text-[40px] ' + scoreColor(score.score)}>
            {score.score === null ? '—' : `${score.score}%`}
          </div>
          <div className="font-mono text-[10px] text-steel/70 mt-1 tracking-[0.06em]">
            {score.total > 0
              ? `${score.kept} kept · ${score.broken} broken of ${score.total} resolved`
              : 'No commitments resolved yet.'}
          </div>
        </div>

        {empty ? (
          <div className="px-4 py-6 border border-amber/15 rounded text-center">
            <p className="text-bone/85 text-[12.5px]">No commitments yet.</p>
            <p className="text-steel text-[10.5px] mt-1 max-w-[320px] mx-auto leading-relaxed">
              Tell KAI what you'll do — voice or ⌘K. <span className="text-amber/80">"I'll raise Makadi to 1,900 by Friday."</span>
            </p>
          </div>
        ) : (
          <>
            {/* Open list */}
            {open.length > 0 && (
              <div>
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel mb-1.5">open</div>
                <ul className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {open.map((c) => {
                      const d = daysLeft(c);
                      const overdue = d < 0;
                      const close   = d >= 0 && d <= 2;
                      const dotCls = overdue ? 'bg-danger' : close ? 'bg-amber' : 'bg-cyan/85';
                      const dotGlow = overdue ? '#FF6B6B' : close ? '#FFB300' : '#5FE3FF';
                      return (
                        <motion.li
                          key={c.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="group flex items-center gap-2 px-2.5 py-2 border border-amber/15 rounded hover:border-amber/35 transition"
                        >
                          <span
                            className={'w-1.5 h-1.5 rounded-full shrink-0 ' + dotCls}
                            style={{ boxShadow: `0 0 6px ${dotGlow}` }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-sans text-bone text-[12.5px] truncate">{c.text}</div>
                            <div className="font-mono text-[10px] text-steel/85 tracking-[0.04em]">
                              {c.metric.domain} · {c.metric.event} {c.metric.op} {c.metric.target.toLocaleString()}
                            </div>
                          </div>
                          <span className={
                            'font-mono text-[11px] tabular-nums shrink-0 ' +
                            (overdue ? 'text-danger' : close ? 'text-amber' : 'text-bone/75')
                          }>
                            {overdue ? 'overdue' : `${d}d`}
                          </span>
                          <button
                            onClick={() => remove(c.id)}
                            className="opacity-0 group-hover:opacity-100 text-steel/55 hover:text-danger/90 transition p-1"
                            title="Drop this commitment"
                          >
                            <X size={11} />
                          </button>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </div>
            )}

            {/* Broken — surfaces honesty */}
            {broken.length > 0 && (
              <div>
                <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel mb-1.5">broken</div>
                <ul className="space-y-1.5">
                  {broken.slice(0, 4).map((c) => (
                    <li
                      key={c.id}
                      className="group flex items-center gap-2 px-2.5 py-1.5 border border-danger/20 rounded bg-danger/[0.04]"
                    >
                      <X size={10} className="text-danger/85 shrink-0" />
                      <span className="flex-1 font-sans text-bone/80 text-[12px] truncate">{c.text}</span>
                      <button
                        onClick={() => remove(c.id)}
                        className="opacity-0 group-hover:opacity-100 text-steel/55 hover:text-danger transition p-1"
                        title="Dismiss"
                      >
                        <X size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Kept tally — quiet */}
            {kept.length > 0 && (
              <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-emerald/85">
                <Check size={11} /> {kept.length} kept all-time
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
