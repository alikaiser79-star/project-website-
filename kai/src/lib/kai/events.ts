/* ============================================================
   The Spine — an append-only event stream.

   Every meaningful mutation in KAI fires a logEvent() so the
   Mirror (and future analytics: Oracle, Web, One, Spar) can
   reason over real history instead of self-report.

   FIFO-capped at 2000 entries so localStorage never blows up.
   Read paths return [] when nothing's there — boot-from-empty
   is a hard guarantee.
   ============================================================ */

import { read, write, uid, emit } from './store';
import type { Currency } from '../../types';

export type Domain =
  | 'income' | 'debt' | 'garden' | 'makadi' | 'instagram'
  | 'priorities' | 'expense' | 'habit' | 'content'
  | 'commitment' | 'people' | 'system' | 'anomaly'
  | 'agent' | 'leads' | 'deadline' | 'money'
  | 'radar' | 'campaign' | 'counsel';

export type EventSource = 'user' | 'voice' | 'receipt' | 'braindump' | 'ai' | 'auto';

export interface KaiEvent {
  id: string;
  ts: number;
  domain: Domain;
  type: string;
  value?: number;
  /* Explicit currency for money-valued events (debt, income, makadi
     rate, expense…). When set, `value` is denominated in `ccy` — never
     an assumed unit. Absent for non-money events (counts, ratios). */
  ccy?: Currency;
  meta?: Record<string, unknown>;
  source: EventSource;
}

const KEY = 'kai.events';
const CAP = 2000;

export function logEvent(e: Omit<KaiEvent, 'id' | 'ts'> & { ts?: number }): KaiEvent {
  const ev: KaiEvent = {
    id: uid(),
    ts: e.ts ?? Date.now(),
    domain: e.domain,
    type: e.type,
    value: e.value,
    ccy: e.ccy,
    meta: e.meta,
    source: e.source,
  };
  const all = read<KaiEvent[]>(KEY, []);
  all.push(ev);
  if (all.length > CAP) all.splice(0, all.length - CAP);
  write(KEY, all);
  emit();
  return ev;
}

export interface EventFilter {
  domain?: Domain;
  type?: string;
  source?: EventSource;
  since?: number;
  until?: number;
}

export function getEvents(f: EventFilter = {}): KaiEvent[] {
  return read<KaiEvent[]>(KEY, []).filter((ev) =>
    (f.domain === undefined || ev.domain === f.domain) &&
    (f.type   === undefined || ev.type   === f.type) &&
    (f.source === undefined || ev.source === f.source) &&
    (f.since  === undefined || ev.ts >= f.since) &&
    (f.until  === undefined || ev.ts <= f.until)
  );
}

export function clearEvents(): void { write(KEY, []); emit(); }
