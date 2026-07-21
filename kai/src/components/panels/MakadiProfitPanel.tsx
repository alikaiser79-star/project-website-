/* ============================================================
   MAKADI PROFIT LINE (Money view) — the one number that says whether the
   apartment paid for itself. Pure Spine arithmetic (makadiProfit), live —
   spent vs earned, net position in EGP, and one honest verdict. Updates
   automatically as real booking / expense events land. No projections.
   ============================================================ */

import { motion } from 'framer-motion';
import { Home } from 'lucide-react';
import { useKaiVersion } from '../../lib/kai/mirror';
import { makadiProfit } from '../../lib/kai/makadiProfit';

const egp = (n: number) => Math.round(n).toLocaleString('en-GB');

export default function MakadiProfitPanel({ delay = 0 }: { delay?: number }) {
  useKaiVersion();                       // re-render when the Spine bus fires
  const p = makadiProfit();
  const under = p.net < 0;               // still invested
  const netColor = p.brokeEven ? 'text-emerald-400' : under ? 'text-amber' : 'text-steel/70';

  return (
    <motion.div
      data-panel="22"
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-lg p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <Home size={14} className="text-amber" />
        <span className="font-mono text-[11px] tracking-[0.25em] text-amber/80 uppercase">Makadi · Paid for itself?</span>
      </div>

      {/* the number */}
      <div className={'font-mono tabular-nums text-[30px] leading-none ' + netColor}>
        {under ? '−' : p.net > 0 ? '+' : ''}{egp(Math.abs(p.net))}
        <span className="text-[13px] text-steel/50 ml-1.5">EGP net</span>
      </div>

      {/* spent vs earned */}
      <div className="flex gap-4 mt-3">
        <div>
          <div className="font-mono text-[9px] tracking-[0.15em] text-steel/40 uppercase">Invested</div>
          <div className="font-mono text-[14px] text-bone/80">{egp(p.spent)} <span className="text-[10px] text-steel/40">EGP</span></div>
        </div>
        <div>
          <div className="font-mono text-[9px] tracking-[0.15em] text-steel/40 uppercase">Earned</div>
          <div className="font-mono text-[14px] text-bone/80">{egp(p.earned)} <span className="text-[10px] text-steel/40">EGP</span></div>
        </div>
        {p.nightsBooked > 0 && (
          <div>
            <div className="font-mono text-[9px] tracking-[0.15em] text-steel/40 uppercase">Nights</div>
            <div className="font-mono text-[14px] text-bone/80">{p.nightsBooked}</div>
          </div>
        )}
      </div>

      {/* the verdict */}
      <div className={'font-mono text-[11px] leading-snug mt-3 ' + (p.brokeEven ? 'text-emerald-300/90' : 'text-steel/60')}>
        {p.verdict}
      </div>
    </motion.div>
  );
}
