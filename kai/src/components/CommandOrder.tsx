/* ============================================================
   §24 DIE ORDNUNG — the ordered front face. Three zones, one law: on
   opening KAI you know what needs you in under three seconds.

     ZONE 1 · NOW    — up to 3 things that need you today, or one calm line.
     ZONE 2 · BODY   — the heart + BPM and ONLY four numbers.
     ZONE 3 · DEPTHS — everything else, below the fold, silent until tapped.

   Mobile-first, one thumb: it stacks, never scrolls sideways, and the live
   surface sits in the reachable lower two-thirds. Sources the existing
   engines — no new data, just order.
   ============================================================ */

import { useState } from 'react';
import { useKaiVersion } from '../lib/kai/mirror';
import { buildNow } from '../lib/kai/nowItems';
import { getCommandSignals } from '../lib/kai/commandSignals';
import { makadiProfit } from '../lib/kai/makadiProfit';
import { computeRunway } from '../lib/kai/runway';
import { loadState } from '../lib/store';
import { emitAction, type KaiAction } from '../lib/actions';
import { ChevronDown, Heart } from 'lucide-react';

const ORGANS: Array<{ id: string; label: string }> = [
  { id: '01', label: 'Income' }, { id: '02', label: 'Debt' }, { id: '03', label: 'Garden' },
  { id: '04', label: 'Makadi' }, { id: '05', label: 'Instagram' }, { id: '06', label: 'Priorities' },
  { id: '07', label: 'Expenses' }, { id: '08', label: 'Content' }, { id: '09', label: 'Mirror' },
  { id: '10', label: 'Ledger' }, { id: '11', label: 'Tollgate' }, { id: '12', label: 'Inbox' },
];
const egp = (n: number) => Math.round(n).toLocaleString('en-GB');

export default function CommandOrder({ onOrganTap, onOrganism }: { onOrganTap?: (id: string) => void; onOrganism?: () => void }) {
  useKaiVersion();
  const [depths, setDepths] = useState(false);

  const now = Date.now();
  const nowRes = buildNow(now);
  const sig = getCommandSignals();
  const callingCount = Object.keys(sig).filter((id) => sig[id]?.calling).length;
  const bpm = Math.min(96, 58 + callingCount * 7);

  const profit = safe(() => makadiProfit(now), null);
  const runway = safe(() => computeRunway(now), null);
  const state = safe(() => loadState(), null);
  const cash = state?.liquidCash ?? null;
  const debt = state?.debtCurrent ?? null;
  const net = profit?.net ?? null;
  const days = runway && runway.runwayDays != null && isFinite(runway.runwayDays) ? Math.floor(runway.runwayDays) : null;

  const fire = (a?: KaiAction) => { if (a) emitAction(a); };

  return (
    <div className="ord">
      {/* ZONE 1 — NOW */}
      <section className="ord-now" aria-label="what needs you now">
        {nowRes.items.length > 0 ? (
          nowRes.items.map((it) => (
            <button key={it.id} className={'ord-now-item t-' + it.tone} onClick={() => fire(it.action)}>
              <span className="ord-now-dot" />
              <span className="ord-now-text">{it.text}</span>
            </button>
          ))
        ) : (
          <div className="ord-calm">{nowRes.calm}</div>
        )}
      </section>

      {/* ZONE 2 — THE BODY */}
      <section className="ord-body" aria-label="the body">
        <div className="ord-heart" style={{ ['--beat' as any]: `${(60 / bpm).toFixed(2)}s` }}>
          <Heart className={'ord-heart-icon' + (callingCount ? ' calling' : '')} size={54} strokeWidth={1.5} />
          <div className="ord-bpm">{bpm}<i>BPM</i></div>
        </div>
        <div className="ord-vitals">
          <Vital label="Cash" value={cash != null ? egp(cash) : '—'} unit="EGP" />
          <Vital label="Debt" value={debt != null ? egp(debt) : '—'} unit="EGP" tone="warn" />
          <Vital label="Makadi net" value={net != null ? (net < 0 ? '−' : '+') + egp(Math.abs(net)) : '—'} unit="EGP" tone={net != null && net >= 0 ? 'good' : 'warn'} />
          <Vital label="Runway" value={days != null ? String(days) : '—'} unit="days" />
        </div>
      </section>

      {/* ZONE 3 — THE DEPTHS */}
      <section className="ord-depths">
        <button className="ord-depths-toggle" onClick={() => setDepths((d) => !d)} aria-expanded={depths}>
          THE DEPTHS <span className="ord-depths-sub">all twelve organs</span>
          <ChevronDown size={15} className={'ord-depths-chev' + (depths ? ' up' : '')} />
        </button>
        {depths && (
          <div className="ord-organs">
            {ORGANS.map((o) => {
              const s = sig[o.id];
              return (
                <button
                  key={o.id}
                  className={'ord-organ' + (s?.calling ? ' calling' : '')}
                  onClick={() => (onOrganTap ? onOrganTap(o.id) : emitAction({ type: 'ping-panel', panel: o.id }))}
                >
                  <span className="ord-organ-id">{o.id}</span>
                  <span className="ord-organ-label">{o.label}</span>
                  <span className="ord-organ-val">{s?.formatted ?? '—'}</span>
                </button>
              );
            })}
            {onOrganism && (
              <button className="ord-organ ord-organ-living" onClick={onOrganism}>
                <span className="ord-organ-id">◇</span>
                <span className="ord-organ-label">Living organism</span>
                <span className="ord-organ-val">open</span>
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Vital({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: 'good' | 'warn' }) {
  return (
    <div className={'ord-vital' + (tone ? ' ' + tone : '')}>
      <div className="ord-vital-label">{label}</div>
      <div className="ord-vital-value">{value}<span>{unit}</span></div>
    </div>
  );
}

function safe<T>(fn: () => T, fallback: T): T { try { return fn(); } catch { return fallback; } }
