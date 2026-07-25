/* ============================================================
   The Spine — an append-only event stream.

   Every meaningful mutation in KAI fires a logEvent() so the
   Mirror (and future analytics: Oracle, Web, One, Spar) can
   reason over real history instead of self-report.

   FIFO-capped at 2000 entries so localStorage never blows up.
   Read paths return [] when nothing's there — boot-from-empty
   is a hard guarantee.
   ============================================================ */

import { read, write, writeSafe, uid, emit } from './store';
import { reclaimStorage } from './reclaim';
import type { Currency } from '../../types';

export type Domain =
  | 'income' | 'debt' | 'garden' | 'makadi' | 'instagram'
  | 'priorities' | 'expense' | 'habit' | 'content'
  | 'commitment' | 'people' | 'system' | 'anomaly'
  | 'agent' | 'leads' | 'deadline' | 'money'
  | 'radar' | 'campaign' | 'counsel' | 'hunter';

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
  let all = read<KaiEvent[]>(KEY, []);
  all.push(ev);
  if (all.length > CAP) all = all.slice(all.length - CAP);

  /* Persist — and PROVE it landed. On a real device the origin's
     localStorage can be full (a fat Spine + typed state + history +
     token logs), and setItem then throws QuotaExceededError. The old
     code swallowed that silently, so a booking could be "logged" yet be
     absent on the next read — an invisible, permanent failure that no
     amount of re-running the guard could heal. Now: if the write fails,
     prune the OLDEST events (the newest, incl. this one, are what matter)
     and retry, progressively harder, so the append ALWAYS persists as
     long as any space at all is reclaimable. */
  if (!writeSafe(KEY, all)) {
    /* Stage 1 — trim our own tail (helps only if kai.events is the bloat). */
    let saved = false;
    for (const keep of [1200, 600, 250, 80, 20]) {
      const pruned = all.slice(Math.max(0, all.length - keep));
      if (writeSafe(KEY, pruned)) { all = pruned; saved = true; break; }
    }
    /* Stage 2 — still stuck means the space is held by OTHER keys (snapshot
       history in the state blob, watcher caches). Reclaim globally, then
       retry the full array, trimming again only if it's still tight. This
       is what lets a NEW append (the confirmed bookings) land on a device
       whose origin filled up after the older events were written. */
    if (!saved) {
      reclaimStorage();
      if (!writeSafe(KEY, all)) {
        for (const keep of [1200, 600, 250, 80, 20]) {
          const pruned = all.slice(Math.max(0, all.length - keep));
          if (writeSafe(KEY, pruned)) { all = pruned; break; }
        }
      }
    }
  }
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
