/* ============================================================
   §28.2 THE HEART → THE STATE OF BEING.

   The heart used to beat from a signal count — arithmetic, not a state.
   Now it reads the whole Council context and resolves ONE state:

     WOUNDED  something is broken and it is his doing — a promise missed,
              a commitment gone red. The body jolts, KAI writes plainly.
     PRESSED  the walls are close — cash thin, runway short, too much due.
              Terse, no ornament. Nothing but the next move.
     HUNTING  nothing is bleeding and there is real money on the table.
              Sharp, forward, appetite in the voice.
     RISING   the numbers are moving his way — wins landing, net climbing.
              Warm, still honest, allowed to say so.
     STEADY   nothing calls. The resting state, and a legitimate one.

   Each state carries rhythm (bpm band), colour temperature, vein
   behaviour AND a voice directive that goes into KAI's prompts — so
   "pressed" reads terse and "rising" reads warm without a separate
   setting. One glance at the core states his life without a number.

   Deterministic, ranked, and derived only from real Council data.
   ============================================================ */

import type { CouncilContext } from './council';

export type Being = 'WOUNDED' | 'PRESSED' | 'HUNTING' | 'RISING' | 'STEADY';

export interface BeingState {
  state: Being;
  bpm: number;
  /* CSS-facing */
  rgb: string;            // core colour
  glow: number;           // 0..1 bloom strength
  veins: 'calm' | 'tight' | 'quick' | 'surge';
  /* Language-facing */
  label: string;          // the one word shown under the heart
  because: string;        // WHY — never a mood without a reason
  voice: string;          // directive appended to KAI's prompts
}

const DAY = 86_400_000;

/* Thresholds are named so a state is never a mystery. */
const CASH_THIN = 8_000;         // EGP on hand below which the walls are close
const RUNWAY_SHORT = 21;         // days
const PRESSED_NEEDS = 3;         // simultaneous needs that constitute pressure
const HUNT_WORTH = 3_000;        // EGP of live opportunity worth calling appetite

/* `needs` is the Council queue length. Passed in rather than imported so
   this module stays a leaf — being is read BY the surfaces, never by the
   Council, and a cycle here would be a boot hazard. */
export function resolveBeing(ctx: CouncilContext, needs = 0): BeingState {
  const now = ctx.now;
  const brokeRecently = ctx.events.filter(
    (e) => e.domain === 'commitment' && e.type === 'commitment_broken' && now - e.ts < 7 * DAY,
  ).length;
  const overdue = ctx.overdue.length;
  const cash = ctx.runway?.liquidCash ?? 0;
  const runwayDays = ctx.runway?.runwayDays ?? null;
  const huntWorth = ctx.moves.reduce((s, m) => s + (m.expectedEgp || 0), 0);
  const winsRecent = ctx.events.filter(
    (e) => now - e.ts < 7 * DAY && (
      (e.domain === 'makadi' && e.type === 'booking_confirmed') ||
      (e.domain === 'money' && e.type === 'milestone') ||
      (e.domain === 'commitment' && e.type === 'commitment_kept')),
  ).length;
  const netUp = (ctx.profit?.net ?? 0) >= 0 || (ctx.ledger?.attributedEgp ?? 0) > 0;

  /* Ranked: a wound outranks pressure, pressure outranks appetite. */
  if (brokeRecently > 0 || overdue > 0) {
    const what = overdue > 0 ? `${overdue} commitment${overdue === 1 ? '' : 's'} overdue` : `${brokeRecently} broken this week`;
    return {
      state: 'WOUNDED', bpm: 88, rgb: '255, 74, 58', glow: 0.9, veins: 'surge',
      label: 'WOUNDED', because: what,
      voice: 'Ali has broken his word recently. Write plainly and without comfort. Name the miss once, then the repair. No praise.',
    };
  }

  if ((cash > 0 && cash < CASH_THIN) || (runwayDays != null && runwayDays < RUNWAY_SHORT) || needs >= PRESSED_NEEDS) {
    const what = cash > 0 && cash < CASH_THIN ? `cash at ${Math.round(cash).toLocaleString('en-GB')} EGP`
      : runwayDays != null && runwayDays < RUNWAY_SHORT ? `${Math.floor(runwayDays)} days of runway`
      : `${needs} things need you`;
    return {
      state: 'PRESSED', bpm: 80, rgb: '255, 150, 60', glow: 0.7, veins: 'tight',
      label: 'PRESSED', because: what,
      voice: 'The walls are close. Be terse — short sentences, no ornament, no preamble. One move at a time.',
    };
  }

  if (huntWorth >= HUNT_WORTH) {
    return {
      state: 'HUNTING', bpm: 72, rgb: '255, 196, 90', glow: 0.75, veins: 'quick',
      label: 'HUNTING', because: `${Math.round(huntWorth).toLocaleString('en-GB')} EGP on the table`,
      voice: 'There is money in reach and nothing bleeding. Write forward and sharp — name the move and what it pays.',
    };
  }

  if (winsRecent > 0 && netUp) {
    return {
      state: 'RISING', bpm: 66, rgb: '130, 230, 165', glow: 0.65, veins: 'quick',
      label: 'RISING', because: `${winsRecent} win${winsRecent === 1 ? '' : 's'} this week`,
      voice: 'The numbers moved his way. Warm, still honest — you may say it is going well, but keep the facts first.',
    };
  }

  return {
    state: 'STEADY', bpm: 58, rgb: '255, 180, 110', glow: 0.4, veins: 'calm',
    label: 'STEADY', because: 'nothing calls',
    voice: 'Nothing is urgent. Calm and unhurried; do not manufacture urgency to seem useful.',
  };
}

/* The voice directive for prompts — how KAI writes in this state. */
export function beingVoice(ctx: CouncilContext, needs = 0): string {
  return resolveBeing(ctx, needs).voice;
}
