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
  | 'radar' | 'campaign' | 'counsel' | 'ambassador' | 'hunter';

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
export const CAP = 2000;

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

/* ============================================================
   §25b THE SINGLE PASS — a scoped Spine snapshot.

   The Council assembles one shared context per tick, but 97 call sites
   across a dozen engines each re-read storage, so "one pass" was a
   convention nobody could enforce. Threading a ctx parameter through all
   97 would churn every signature and ripple through every caller.

   Instead the guarantee moves to the READ: while a snapshot is active,
   every getEvents() in the call tree — in engines this module has never
   heard of — serves from that one in-memory array. The single pass becomes
   STRUCTURAL rather than conventional, with no signature changes.

   Rules:
     • SYNCHRONOUS ONLY. The scope must not span an await, or a later tick
       could read a stale snapshot. assembleContext() is fully sync.
     • WRITES ARE UNAFFECTED. logEvent() persists through the store directly,
       so appends during a scope still hit storage; they simply aren't
       visible until the scope ends — which is what makes the assembly a
       coherent view instead of a shifting one.
     • Nesting is stacked; an inner scope restores the outer on exit.
   ============================================================ */
let snapshot: KaiEvent[] | null = null;
let storageReads = 0;          // instrumentation: proves the pass is single

export function withSpineSnapshot<T>(events: KaiEvent[], fn: () => T): T {
  const prev = snapshot;
  snapshot = events;
  try { return fn(); } finally { snapshot = prev; }
}
export function inSpineSnapshot(): boolean { return snapshot !== null; }
/* Test/diagnostic: how many times storage was actually hit. */
export function spineReadCount(): number { return storageReads; }
export function resetSpineReadCount(): void { storageReads = 0; }

export function getEvents(f: EventFilter = {}): KaiEvent[] {
  const source = snapshot ?? (storageReads++, read<KaiEvent[]>(KEY, []));
  return source.filter((ev) =>
    (f.domain === undefined || ev.domain === f.domain) &&
    (f.type   === undefined || ev.type   === f.type) &&
    (f.source === undefined || ev.source === f.source) &&
    (f.since  === undefined || ev.ts >= f.since) &&
    (f.until  === undefined || ev.ts <= f.until)
  );
}

export function clearEvents(): void { write(KEY, []); emit(); }
