/* ============================================================
   §23.2 THE NERVOUS SYSTEM — the body feels EVENTS, not states.

   Every meaningful Spine write, the moment it lands, fires a NERVE: a
   one-shot physical reaction rendered anywhere in the app (the global
   NerveField edge-flash) and — on the Command organism — as an organ
   surge. Gold for money/wins, crimson for a blow, blue for signal, green
   for growth. Intensity scales with the event (a big booking hits harder
   than a small expense).

   Armed at BOOT (not when Command mounts), so a booking that lands while
   you're on Money — or the app is merely open in the background — is still
   felt. Baselines on first arm: only events logged AFTER the nerve is
   watching react; the past never surges. Session-lived, no fabrication.
   Doctrine: this REACTS to news within your own Spine — nothing ambient.
   ============================================================ */

import { getEvents, type KaiEvent } from './events';
import { subscribe } from './store';

export type Tone = 'gold' | 'crimson' | 'blue' | 'green';
export interface Nerve { organId: string; tone: Tone; intensity: number; label: string }

/* domain.type → how the body reacts. `base` intensity 0..1; `scale` (optional)
   grows it with the event's EGP value. Anything not mapped is felt as nothing. */
interface Spec { organId: string; tone: Tone; base: number; scale?: number; label: (e: KaiEvent) => string }
const egp = (n: number) => Math.round(n).toLocaleString('en-GB');

const MAP: Record<string, Spec> = {
  'makadi.booking_confirmed':   { organId: '04', tone: 'gold',    base: 0.85, scale: 6000, label: (e) => `Booking · ${e.meta?.guest || 'guest'}` },
  'makadi.booking_inquiry':     { organId: '04', tone: 'blue',    base: 0.5,  label: () => 'New inquiry' },
  'makadi.rate_changed':        { organId: '04', tone: 'gold',    base: 0.4,  label: (e) => `Rate → ${e.value} ${e.ccy || ''}`.trim() },
  'income.received':            { organId: '01', tone: 'gold',    base: 0.55, scale: 8000, label: (e) => `+${egp(e.value || 0)} ${e.ccy || 'EGP'}` },
  'income.salary_logged':       { organId: '01', tone: 'gold',    base: 0.6,  label: () => 'Salary in' },
  'money.milestone':            { organId: '02', tone: 'gold',    base: 0.9,  label: () => 'Milestone' },
  'debt.payment_logged':        { organId: '02', tone: 'gold',    base: 0.6,  scale: 6000, label: (e) => `Card paid ${egp(e.value || 0)}` },
  'debt.balance_updated':       { organId: '02', tone: 'gold',    base: 0.4,  label: () => 'Debt updated' },
  'expense.expense_logged':     { organId: '07', tone: 'blue',    base: 0.28, scale: 4000, label: (e) => `−${egp(e.value || 0)} ${e.ccy || 'EGP'}` },
  'commitment.commitment_kept': { organId: '09', tone: 'gold',    base: 0.6,  label: () => 'Kept your word' },
  'commitment.commitment_broken':{ organId: '09', tone: 'crimson', base: 0.9, label: () => 'Commitment broken' },
  'garden.plant_added':         { organId: '03', tone: 'green',   base: 0.35, label: () => 'Garden grew' },
  'content.reel_posted':        { organId: '08', tone: 'green',   base: 0.4,  label: () => 'Content posted' },
  'leads.stage_changed':        { organId: '12', tone: 'blue',    base: 0.35, label: (e) => `Lead → ${e.meta?.stage || ''}`.trim() },
  'hunter.actioned':            { organId: '01', tone: 'gold',    base: 0.5,  label: () => 'Hunt actioned' },
  'system.drift_warning':       { organId: '09', tone: 'crimson', base: 0.55, label: () => 'Drift forming' },
  'system.insight':             { organId: '06', tone: 'blue',    base: 0.3,  label: () => 'Overnight insight' },
};

function toNerve(e: KaiEvent): Nerve | null {
  const spec = MAP[`${e.domain}.${e.type}`];
  if (!spec) return null;
  let intensity = spec.base;
  if (spec.scale && typeof e.value === 'number') intensity = Math.min(1, spec.base + Math.min(0.4, (e.value || 0) / spec.scale * 0.4));
  return { organId: spec.organId, tone: spec.tone, intensity: Math.max(0.15, Math.min(1, intensity)), label: spec.label(e) };
}

type Cb = (n: Nerve, e: KaiEvent) => void;
const listeners = new Set<Cb>();
let seen: Set<string> | null = null;
let armed = false;

function scan() {
  const evs = getEvents({});
  if (seen === null) { seen = new Set(evs.map((e) => e.id)); return; }   // baseline — don't feel the past
  for (const e of evs) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const n = toNerve(e);
    if (n) listeners.forEach((l) => { try { l(n, e); } catch { /* ignore */ } });
  }
}

/* Arm the nervous system at boot so events are felt regardless of which view
   is showing. Idempotent. */
export function armNervousSystem(): void {
  if (armed) return;
  armed = true;
  scan();                 // set the baseline now
  subscribe(scan);        // feel every subsequent Spine write
}

export function onNerve(cb: Cb): () => void {
  listeners.add(cb);
  armNervousSystem();
  return () => { listeners.delete(cb); };
}
