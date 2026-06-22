/* ============================================================
   WatchtowerPanel — the interrupt surface.
   ============================================================ */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, Bell, BellOff, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import Panel from '../Panel';
import { useKaiVersion } from '../../lib/kai/mirror';
import {
  TRIGGERS, getWatchtower, setTriggerEnabled,
  requestNotificationsPermission, notificationsPermission,
  clearAlerts, type TriggerKind,
} from '../../lib/kai/watchtower';
import { sfx } from '../../lib/sound';

export default function WatchtowerPanel({ delay = 0 }: { delay?: number }) {
  useKaiVersion();
  const w = getWatchtower();
  const perm = notificationsPermission();

  const [busy, setBusy] = useState(false);

  async function askPerm() {
    if (busy) return;
    setBusy(true);
    try { await requestNotificationsPermission(); }
    finally { setBusy(false); }
  }

  const tag = w.alerts.length === 0 ? 'quiet' : `${w.alerts.length} alert${w.alerts.length === 1 ? '' : 's'}`;

  return (
    <Panel num="18" title="The Watchtower" tag={tag} delay={delay}>
      <div className="space-y-3">
        {/* Notifications opt-in */}
        <div className={'flex items-center gap-2 px-3 py-2 rounded border ' +
          (perm === 'granted' ? 'border-emerald/40 bg-emerald/[0.05] text-emerald'
           : perm === 'denied' ? 'border-danger/30 bg-danger/[0.05] text-danger'
           : 'border-amber/30 bg-amber/[0.04] text-amber')}>
          {perm === 'granted' ? <Bell size={11} /> : <BellOff size={11} />}
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase">
            {perm === 'granted' ? 'push on' : perm === 'denied' ? 'push blocked' : 'push off'}
          </span>
          {perm !== 'granted' && (
            <button
              onClick={askPerm}
              disabled={busy || perm === 'denied'}
              className="ml-auto text-[10px] tracking-[0.16em] uppercase underline hover:opacity-80 disabled:opacity-50"
            >
              {perm === 'denied' ? 'unblock in browser' : 'enable'}
            </button>
          )}
        </div>

        {/* Recent alerts */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Eye size={11} className="text-amber/75" />
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel">recent</span>
            {w.alerts.length > 0 && (
              <button onClick={() => { sfx.click(); clearAlerts(); }} className="ml-auto text-steel hover:text-danger p-1" title="Clear">
                <Trash2 size={11} />
              </button>
            )}
          </div>
          {w.alerts.length === 0 ? (
            <div className="px-3 py-3 border border-amber/15 rounded text-center text-bone/85 text-[12px]">
              All clear. Nothing flagged in the last cycle.
            </div>
          ) : (
            <ul className="space-y-1.5">
              <AnimatePresence initial={false}>
                {w.alerts.map((a, i) => (
                  <motion.li
                    key={`${a.kind}-${a.ts}-${i}`}
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-2.5 py-1.5 border border-amber/15 rounded"
                  >
                    <div className="flex items-baseline gap-2">
                      <AlertTriangle size={10} className="text-amber/85 shrink-0" />
                      <span className="font-sans text-bone text-[12.5px] truncate flex-1 min-w-0">{a.title}</span>
                      <span className="font-mono text-[9.5px] text-steel/65 shrink-0">{rel(a.ts)}</span>
                    </div>
                    <div className="font-sans text-[11.5px] text-bone/85 leading-snug mt-0.5">{a.body}</div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {/* Triggers config */}
        <div>
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-steel mb-1.5">triggers</div>
          <ul className="space-y-1">
            {TRIGGERS.map(t => (
              <li key={t.kind} className="flex items-center gap-2 px-2.5 py-1.5 border border-amber/10 rounded">
                <button
                  onClick={() => { sfx.click(); setTriggerEnabled(t.kind, !w.enabled[t.kind]); }}
                  className={'shrink-0 ' + (w.enabled[t.kind] ? 'text-emerald' : 'text-steel/45')}
                  title={w.enabled[t.kind] ? 'Disable' : 'Enable'}
                >
                  <CheckCircle2 size={11} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-sans text-bone/95 text-[11.5px] truncate">{t.label}</div>
                  <div className="font-mono text-[9.5px] text-steel/70 truncate">{t.hint}</div>
                </div>
                {w.lastFired[t.kind] && (
                  <span className="font-mono text-[9px] text-steel/55 shrink-0">{rel(w.lastFired[t.kind]!)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function rel(ms: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000)           return Math.max(1, Math.round(diff / 1000)) + 's';
  if (diff < 60 * 60_000)      return Math.round(diff / 60_000) + 'm';
  if (diff < 24 * 60 * 60_000) return Math.round(diff / (60 * 60_000)) + 'h';
  return Math.round(diff / (24 * 60 * 60_000)) + 'd';
}
