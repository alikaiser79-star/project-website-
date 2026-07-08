/* ============================================================
   REWIND (§7.8) — the dashboard remembers. The Spine is append-only,
   so time travel is free: signalsAt(t) recomputes each organ's value
   as it stood on day t, derived purely from events ≤ t. Fed to the
   engine as its signal provider while scrubbing, the whole command
   view (values + heart arousal) replays. Organs without enough
   history keep their live value dimmed — no fabrication.
   ============================================================ */

import { getEvents } from './events';
import { getCommandSignals } from './commandSignals';
import { operator } from '../../kaiConfig';
import type { OrganSignal } from './commandCore';

const DAY = 86_400_000;

function fmtEgp(n: number): string {
  if (!isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 10_000) return Math.round(n / 1000) + 'K';
  return Math.round(n).toLocaleString(operator.locale);
}

/* Last event value on/before t for a domain+type. */
function lastValueAt(domain: any, type: string, t: number): number | undefined {
  const evs = getEvents({ domain, type }).filter(e => e.ts <= t);
  return evs.length ? evs[evs.length - 1].value : undefined;
}

/* Historical signals as of time t. Event-backed organs (debt, makadi,
   garden) recompute exactly; the rest fall back to their live value.
   Calling is held false — past alarms aren't reliably reconstructable,
   so the heart simply rests through the replay rather than faking it. */
export function signalsAt(t: number): Record<string, OrganSignal> {
  const out: Record<string, OrganSignal> = {};
  const live = getCommandSignals();
  for (const k of Object.keys(live)) out[k] = { formatted: live[k].formatted, calling: false };

  const debt = lastValueAt('debt', 'balance_updated', t);
  if (debt != null) out['02'] = { formatted: fmtEgp(debt), calling: false };

  const rate = lastValueAt('makadi', 'rate_changed', t);
  if (rate != null) out['04'] = { formatted: fmtEgp(rate), calling: false };

  const plants = lastValueAt('garden', 'plant_added', t);
  if (plants != null) out['03'] = { formatted: Math.round(plants).toLocaleString(operator.locale), calling: false };

  return out;
}

/* The scrubbable range: from the first Spine event to now. */
export function rewindRange(): { min: number; max: number } {
  const evs = getEvents({});
  const min = evs.length ? evs[0].ts : Date.now() - 30 * DAY;
  return { min: Math.min(min, Date.now() - DAY), max: Date.now() };
}
