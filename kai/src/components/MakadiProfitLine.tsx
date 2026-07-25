/* ============================================================
   MAKADI PROFIT LINE (Command headline) — the one number of the month,
   glanceable on the Command organism without opening a tab. Pure Spine
   arithmetic (makadiProfit), live. Tap → the full panel on the Money view.
   Silent until there's Makadi money to report (no zero-state noise).
   ============================================================ */

import { useKaiVersion } from '../lib/kai/mirror';
import { makadiProfit } from '../lib/kai/makadiProfit';

const egp = (n: number) => Math.round(n).toLocaleString('en-GB');

export default function MakadiProfitLine({ onOpen }: { onOpen: () => void }) {
  useKaiVersion();                      // re-render when the Spine bus fires
  const p = makadiProfit();
  if (p.spent === 0 && p.earned === 0) return null;   // nothing logged → stay quiet

  const under = p.net < 0;
  const cls = 'makadi-line' + (p.brokeEven ? ' is-paid' : under ? ' is-under' : '');
  const sub = p.brokeEven
    ? `paid for itself · ${p.nightsBooked} night${p.nightsBooked === 1 ? '' : 's'}`
    : `${p.nightsToBreakEven} night${p.nightsToBreakEven === 1 ? '' : 's'} to break even`;

  return (
    <button className={cls} onClick={onOpen} title={p.verdict} aria-label={`Makadi profit line — ${p.verdict}`}>
      <span className="makadi-line-label">MAKADI</span>
      <span className="makadi-line-net">
        {under ? '−' : p.net > 0 ? '+' : ''}{egp(Math.abs(p.net))}<i>EGP</i>
      </span>
      <span className="makadi-line-sub">{sub}</span>
    </button>
  );
}
