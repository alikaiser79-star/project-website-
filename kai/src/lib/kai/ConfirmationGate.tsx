/* ============================================================
   ConfirmationGate — the human-in-the-loop firewall.

   Renders as a sticky banner under the top bar when KAI has
   proposed external actions. Each proposed action needs Ali's
   explicit Approve tap before any external API gets called.
   This is the prompt-injection guardrail in UI form.

   Restyled into the project's GOD MODE chrome (glass card,
   amber accents, mono labels).
   ============================================================ */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldAlert, Check, X, Loader2, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { useKaiVersion } from './mirror';
import {
  listAll, getPending, approveAction, rejectAction, retryAction,
  type PendingAction, type PendingKind,
} from './pending';
import { sfx } from '../sound';
import { toast } from '../../hooks/useToasts';

const KIND_LABEL: Record<PendingKind, string> = {
  email_send:  'send email',
  ig_publish:  'publish to Instagram',
  site_commit: 'commit to site',
  site_deploy: 'deploy site',
};
const KIND_COLOR: Record<PendingKind, string> = {
  email_send:  '#5FE3FF',
  ig_publish:  '#C792EA',
  site_commit: '#FFB300',
  site_deploy: '#FF6B6B',
};

export default function ConfirmationGate() {
  useKaiVersion();
  const pending = getPending();
  const failed = listAll().filter(a => a.status === 'failed');
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (pending.length === 0 && failed.length === 0) return null;

  async function approve(a: PendingAction) {
    setBusy(a.id);
    sfx.whoosh();
    try {
      await approveAction(a.id);
      sfx.confirm();
      toast.ok(`Done — ${a.summary.slice(0, 60)}`, 'KAI · HANDS', 4000);
    } catch (e: any) {
      sfx.error();
      toast.err('Failed: ' + String(e?.message || e).slice(0, 140), 'KAI · HANDS', 6000);
    } finally {
      setBusy(null);
    }
  }

  function reject(a: PendingAction) {
    rejectAction(a.id);
    sfx.click();
    toast.ok('Rejected.', 'KAI · HANDS', 2400);
  }

  function retry(a: PendingAction) {
    retryAction(a.id);
    sfx.click();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="glass rounded-lg overflow-hidden border-amber/40"
      style={{ boxShadow: '0 0 24px rgba(255,179,0,0.10)' }}
    >
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-amber/15 bg-amber/[0.04]">
        <ShieldAlert size={13} className="text-amber drop-shadow-[0_0_6px_rgba(255,179,0,0.5)]" />
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-amber/90">
          Needs your tap
        </span>
        <span className="ml-auto font-mono text-[10px] text-steel/80">
          {pending.length} pending{failed.length ? ` · ${failed.length} failed` : ''}
        </span>
      </header>

      <ul className="divide-y divide-amber/10">
        <AnimatePresence initial={false}>
          {[...pending, ...failed].map((a) => {
            const isExpanded = expanded === a.id;
            const isFailed = a.status === 'failed';
            return (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="px-4 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : a.id)}
                    className="text-steel hover:text-amber p-0.5 shrink-0"
                    title={isExpanded ? 'Hide payload' : 'Show payload'}
                  >
                    {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </button>
                  <span
                    className="px-1.5 py-0.5 rounded border font-mono text-[9.5px] tracking-[0.16em] uppercase shrink-0"
                    style={{
                      borderColor: KIND_COLOR[a.kind] + '66',
                      color: KIND_COLOR[a.kind],
                      background: KIND_COLOR[a.kind] + '14',
                    }}
                  >
                    {KIND_LABEL[a.kind]}
                  </span>
                  <span className="flex-1 font-sans text-bone text-[12.5px] truncate min-w-0">
                    {a.summary}
                  </span>

                  {!isFailed && (
                    <>
                      <button
                        onClick={() => approve(a)}
                        disabled={busy === a.id}
                        className="flex items-center gap-1 px-2 py-1 rounded border border-emerald/50 text-emerald hover:bg-emerald/10 font-mono text-[10px] tracking-[0.16em] uppercase disabled:opacity-60"
                      >
                        {busy === a.id
                          ? <Loader2 size={10} className="animate-spin" />
                          : <Check size={10} />}
                        approve
                      </button>
                      <button
                        onClick={() => reject(a)}
                        disabled={busy === a.id}
                        className="flex items-center gap-1 px-2 py-1 rounded border border-steel/30 text-steel hover:border-danger hover:text-danger font-mono text-[10px] tracking-[0.16em] uppercase disabled:opacity-60"
                      >
                        <X size={10} /> reject
                      </button>
                    </>
                  )}

                  {isFailed && (
                    <>
                      <button
                        onClick={() => retry(a)}
                        className="flex items-center gap-1 px-2 py-1 rounded border border-amber/50 text-amber hover:bg-amber/10 font-mono text-[10px] tracking-[0.16em] uppercase"
                        title="Move back to pending"
                      >
                        <RotateCcw size={10} /> retry
                      </button>
                      <button
                        onClick={() => reject(a)}
                        className="flex items-center gap-1 px-2 py-1 rounded border border-steel/30 text-steel hover:border-danger hover:text-danger font-mono text-[10px] tracking-[0.16em] uppercase"
                      >
                        <X size={10} /> drop
                      </button>
                    </>
                  )}
                </div>

                {isFailed && a.error && (
                  <div className="mt-1.5 ml-7 font-mono text-[10.5px] text-danger/85 leading-relaxed">
                    error: {a.error}
                  </div>
                )}

                {isExpanded && (
                  <pre className="mt-2 ml-7 px-2.5 py-2 bg-ink2/40 border border-amber/10 rounded font-mono text-[10.5px] text-bone/85 leading-relaxed whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
{safeJson(a.payload)}
                  </pre>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </motion.div>
  );
}

function safeJson(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}
