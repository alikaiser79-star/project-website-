/* ============================================================
   THE LEDGER OF WINS (§9.5) — proof the doctrine works (or honestly
   where it didn't). Every money milestone, what the freed cash was
   deployed into, and what that deployment has returned since — all
   from Spine events. The compounding, made visible.
   ============================================================ */

import { useSyncExternalStore } from 'react';
import { Trophy } from 'lucide-react';
import { subscribe, getVersion } from '../../lib/kai/store';
import { ledgerOfWins } from '../../lib/kai/warchest';
import { operator } from '../../kaiConfig';

export default function LedgerOfWinsPanel() {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const wins = ledgerOfWins();

  return (
    <section className="glass rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4 text-amber/90">
        <Trophy size={14} />
        <span className="font-mono text-[11px] tracking-[0.22em] uppercase">Ledger of Wins</span>
      </div>

      {wins.length === 0 ? (
        <div className="font-mono text-steel/55 text-[12px] py-4">
          No milestones yet. Cross a debt threshold or land a new income source and the War Chest opens.
        </div>
      ) : (
        <div className="space-y-2.5">
          {wins.map((w, i) => (
            <div key={i} className="wc-win">
              <div className="wc-win-top">
                <span className="wc-win-label">{w.milestone}</span>
                <span className="wc-win-date">{new Date(w.at).toLocaleDateString(operator.locale, { day: '2-digit', month: 'short' })}</span>
              </div>
              <div className="wc-win-row">
                <span className="wc-win-freed">+{w.freedEgp.toLocaleString()} EGP/mo freed</span>
                <span className="wc-win-arrow">→</span>
                <span className={'wc-win-into' + (w.deployedInto ? '' : ' pending')}>
                  {w.deployedInto || 'not yet deployed'}
                </span>
              </div>
              {w.returnedEgp > 0 && (
                <div className="wc-win-return">returned {w.returnedEgp.toLocaleString()} EGP so far</div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
