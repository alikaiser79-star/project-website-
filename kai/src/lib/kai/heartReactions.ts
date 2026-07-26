/* ============================================================
   HEART REACTIONS — the body feels news, not just states. Watches the
   Spine and, when a real event LANDS (not a standing state), fires a
   one-shot reaction the Command Core renders as a surge to the matching
   organ: gold for a win, crimson for a blow. Then it settles calm.

   Baselines on first arm so pre-existing events never surge — only events
   logged AFTER the heart is watching react. Session-lived; no fabrication.
   ============================================================ */

import { getEvents } from './events';
import { subscribe } from './store';

export interface HeartReaction { organId: string; tone: 'gold' | 'crimson' }
type Cb = (r: HeartReaction) => void;

/* domain.type → which organ surges, and in what colour. */
const REACTABLE: Record<string, HeartReaction> = {
  'makadi.booking_confirmed':     { organId: '04', tone: 'gold' },     // a booking landed → Makadi
  'makadi.rate_changed':          { organId: '04', tone: 'gold' },     // raised the rate → Makadi
  'income.received':              { organId: '01', tone: 'gold' },     // money in → Income
  'income.salary_logged':         { organId: '01', tone: 'gold' },     // salary → Income
  'hunter.actioned':              { organId: '01', tone: 'gold' },     // a hunt paid off → Income
  'commitment.commitment_kept':   { organId: '09', tone: 'gold' },     // kept your word → Mirror
  'commitment.commitment_broken': { organId: '09', tone: 'crimson' },  // broke it → Mirror, one jolt
  'system.drift_warning':         { organId: '09', tone: 'crimson' },  // drift forming → Mirror
  'money.milestone':              { organId: '02', tone: 'gold' },     // a money milestone → Debt
  'debt.payment_logged':          { organId: '02', tone: 'gold' },     // paid the card → Debt
  'debt.balance_updated':         { organId: '02', tone: 'gold' },     // balance moved → Debt
};

const listeners = new Set<Cb>();
let seen: Set<string> | null = null;   // event ids already accounted for
let armed = false;

function scan() {
  const evs = getEvents({});
  if (seen === null) { seen = new Set(evs.map((e) => e.id)); return; }   // baseline — don't react to the past
  for (const e of evs) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const r = REACTABLE[`${e.domain}.${e.type}`];
    if (r) listeners.forEach((l) => { try { l(r); } catch { /* ignore */ } });
  }
}

/* Register a reaction handler (the Command Core panels). Arms the Spine
   watcher on first use. Returns an unsubscribe. */
export function onHeartReaction(cb: Cb): () => void {
  listeners.add(cb);
  if (!armed) { armed = true; scan(); subscribe(scan); }
  return () => { listeners.delete(cb); };
}
