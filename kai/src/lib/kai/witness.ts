/* ============================================================
   §30.11 THE SPINE → THE WITNESS STAND.

   A ledger you can only assert is worth little when contested. This makes
   the Spine tamper-EVIDENT and exportable as a verifiable record.

     THE CHAIN   h[i] = SHA-256( h[i-1] || canonical(event[i]) ). Computed
                 deterministically from the event sequence, so altering a
                 single field in a single event changes every hash after it
                 and the break is visible at an exact index.
     THE SEALS   periodically the head hash + count is written into the
                 Spine as a system/seal. Because seals SYNC to the server,
                 they are an anchor the device cannot quietly rewrite: a
                 local edit reproduces a different head than the sealed one.
     THE RECORD  any domain exports as a canonical, verifiable document —
                 the events, their hashes, the seals that cover them, and
                 instructions to re-verify independently.

   HONEST BOUNDS, stated because this is the feature where overclaiming
   would be worst:
     • Tamper-EVIDENT, not tamper-PROOF. An attacker with the device and
       enough time can recompute the chain AND the local seals. What they
       cannot do is match seals already synced to the server or exported
       earlier — that is where the real evidentiary weight sits.
     • The chain proves INTERNAL CONSISTENCY and ORDER, not that a claim
       was true when written. It shows a record was not altered after the
       fact; it cannot show the fact itself.
     • This is not a legal signature. It is strong contemporaneous
       record-keeping, which is a different and more modest thing.
   ============================================================ */

import { getEvents, logEvent, type KaiEvent, type Domain } from './events';

const GENESIS = '0'.repeat(64);

/* ── canonical form: the bytes that get hashed ───────────────── */
/* Key order must be fixed or the same event hashes two ways. */
export function canonical(e: KaiEvent): string {
  return JSON.stringify({
    id: e.id, ts: e.ts, domain: e.domain, type: e.type,
    value: e.value ?? null, ccy: e.ccy ?? null,
    meta: sortDeep(e.meta ?? null), source: e.source,
  });
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.keys(o).sort().reduce<Record<string, unknown>>((acc, k) => { acc[k] = sortDeep(o[k]); return acc; }, {});
  }
  return v;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ── the chain ───────────────────────────────────────────────── */
export interface ChainLink { index: number; id: string; ts: number; hash: string }

/* Events in canonical order — ts then id, so two devices derive the same
   chain from the same set regardless of arrival order. */
export function ordered(events: KaiEvent[]): KaiEvent[] {
  return [...events].sort((a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export async function buildChain(events: KaiEvent[]): Promise<ChainLink[]> {
  const seq = ordered(events);
  const out: ChainLink[] = [];
  let prev = GENESIS;
  for (let i = 0; i < seq.length; i++) {
    const h = await sha256(prev + '|' + canonical(seq[i]));
    out.push({ index: i, id: seq[i].id, ts: seq[i].ts, hash: h });
    prev = h;
  }
  return out;
}

export async function headHash(events: KaiEvent[]): Promise<string> {
  const c = await buildChain(events);
  return c.length ? c[c.length - 1].hash : GENESIS;
}

/* ── seals: the anchors that make alteration visible ─────────── */
export interface Seal { at: number; count: number; head: string; checkpoints?: Array<[number, string]> }

/* Every Nth link is stored with the seal. Without them a broken seal only
   says "something in these 400 events changed"; with them the break narrows
   to a 25-event window — the difference between "your record is disputed"
   and "THIS entry was altered". */
const CHECKPOINT_EVERY = 25;

export function seals(): Seal[] {
  return getEvents({ domain: 'system', type: 'seal' })
    .map((e) => ({
      at: e.ts, count: Number(e.meta?.count) || 0, head: String(e.meta?.head || ''),
      checkpoints: Array.isArray(e.meta?.checkpoints) ? (e.meta!.checkpoints as Array<[number, string]>) : undefined,
    }))
    .filter((s) => s.head)
    .sort((a, b) => a.at - b.at);
}

/* Write a seal over everything that exists now. Idempotent per head. */
export async function seal(now = Date.now()): Promise<Seal | null> {
  /* A seal must not cover itself, so hash the events as they stand BEFORE
     writing it. */
  const events = getEvents({}).filter((e) => !(e.domain === 'system' && e.type === 'seal'));
  if (!events.length) return null;
  const chain = await buildChain(events);
  const head = chain.length ? chain[chain.length - 1].hash : GENESIS;
  const prior = seals();
  if (prior.length && prior[prior.length - 1].head === head) return prior[prior.length - 1];  // nothing new
  const checkpoints: Array<[number, string]> = [];
  for (let i = CHECKPOINT_EVERY - 1; i < chain.length; i += CHECKPOINT_EVERY) checkpoints.push([i, chain[i].hash]);
  const s: Seal = { at: now, count: events.length, head, checkpoints };
  try { logEvent({ domain: 'system', type: 'seal', value: s.count, meta: { head, count: s.count, checkpoints }, source: 'auto', ts: now }); } catch { /* ignore */ }
  return s;
}

/* ── verification ────────────────────────────────────────────── */
export interface Verification {
  ok: boolean;
  events: number;
  sealsChecked: number;
  brokenAt: number | null;      // index of the first divergence
  detail: string;
}

/* Re-derive the chain and check it against every seal. A seal whose head
   doesn't reproduce means events it covered were altered, removed, or
   reordered after it was written. */
export async function verify(now = Date.now()): Promise<Verification> {
  const all = getEvents({}).filter((e) => !(e.domain === 'system' && e.type === 'seal'));
  const chain = await buildChain(all);
  const ss = seals();
  if (!ss.length) {
    return { ok: true, events: all.length, sealsChecked: 0, brokenAt: null,
      detail: `${all.length} events chained. No seals yet — seal now to anchor this history.` };
  }

  let brokenAt: number | null = null;
  let window: [number, number] | null = null;
  let checked = 0;
  for (const s of ss) {
    /* the chain as it stood at that count */
    if (s.count > chain.length) { brokenAt = chain.length; break; }         // events went missing
    const headThen = s.count === 0 ? GENESIS : chain[s.count - 1].hash;
    checked++;
    if (headThen !== s.head) {
      /* Narrow: the first checkpoint that fails bounds the alteration. */
      let lower = 0;
      for (const [idx, h] of s.checkpoints ?? []) {
        if (idx >= chain.length) { brokenAt = chain.length; break; }
        if (chain[idx].hash !== h) { brokenAt = idx; break; }
        lower = idx + 1;
      }
      if (brokenAt == null) brokenAt = Math.max(lower, s.count - 1);
      window = [lower, brokenAt];
      break;
    }
  }

  const ok = brokenAt == null;
  const detail = ok
    ? `${all.length} events, ${checked} seal${checked === 1 ? '' : 's'} verified. The chain is intact — nothing was altered after it was recorded.`
    : window
      ? `BROKEN. A sealed checkpoint no longer reproduces: an event between index ${window[0]} and ${window[1]} was changed, removed, or reordered after it was recorded.`
      : `BROKEN at index ${brokenAt ?? 0}. A seal no longer reproduces: something recorded earlier was changed, removed, or reordered.`;
  return { ok, events: all.length, sealsChecked: checked, brokenAt, detail };
}

/* ── the record: what you hand to someone who contests you ───── */
export interface WitnessRecord {
  subject: string;
  generatedAt: number;
  events: KaiEvent[];
  chain: ChainLink[];
  seals: Seal[];
  head: string;
  verification: Verification;
  howToVerify: string[];
}

export async function exportRecord(domain: Domain | 'all', now = Date.now(), filter?: (e: KaiEvent) => boolean): Promise<WitnessRecord> {
  const all = getEvents({}).filter((e) => !(e.domain === 'system' && e.type === 'seal'));
  const fullChain = await buildChain(all);
  const seq = ordered(all);

  /* The subset being produced, but chained IN THE CONTEXT of the whole
     ledger — a record whose hashes only cover the convenient events would
     prove nothing. Each included event keeps its true global index. */
  const keep = seq
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => (domain === 'all' || e.domain === domain) && (!filter || filter(e)));

  return {
    subject: domain === 'all' ? 'Full ledger' : `Domain: ${domain}`,
    generatedAt: now,
    events: keep.map((k) => k.e),
    chain: keep.map((k) => fullChain[k.i]),
    seals: seals(),
    head: fullChain.length ? fullChain[fullChain.length - 1].hash : GENESIS,
    verification: await verify(now),
    howToVerify: [
      'Each link is SHA-256 of (previous hash + "|" + the canonical event JSON).',
      'Canonical JSON fixes key order as: id, ts, domain, type, value, ccy, meta (keys sorted deeply), source.',
      'The first hash uses 64 zeros as the previous hash.',
      'Events are ordered by ts, then by id, so the same set always produces the same chain.',
      'Recompute from the included indices: any altered field changes that link and every link after it.',
      'A seal records the head hash at a point in time. Re-deriving must reproduce it exactly.',
    ],
  };
}

/* A plain-text document — the thing you can print, email, or attach. */
export function recordText(r: WitnessRecord): string {
  const d = (t: number) => new Date(t).toISOString().replace('T', ' ').slice(0, 19);
  const lines: string[] = [];
  lines.push('KAI — RECORD OF EVENTS');
  lines.push(r.subject);
  lines.push(`Generated ${d(r.generatedAt)} · ${r.events.length} events`);
  lines.push('');
  lines.push(r.verification.ok ? 'STATUS: chain intact' : 'STATUS: CHAIN BROKEN — see verification');
  lines.push(r.verification.detail);
  lines.push('');
  lines.push('EVENTS');
  r.events.forEach((e, i) => {
    const link = r.chain[i];
    const val = typeof e.value === 'number' ? ` ${e.value}${e.ccy ? ' ' + e.ccy : ''}` : '';
    lines.push(`  [${String(link?.index ?? i).padStart(4)}] ${d(e.ts)}  ${e.domain}.${e.type}${val}`);
    if (e.meta && Object.keys(e.meta).length) lines.push(`         ${JSON.stringify(sortDeep(e.meta)).slice(0, 200)}`);
    lines.push(`         sha256 ${link?.hash ?? '—'}`);
  });
  lines.push('');
  lines.push('SEALS');
  if (!r.seals.length) lines.push('  (none)');
  for (const s of r.seals) lines.push(`  ${d(s.at)}  covering ${s.count} events  head ${s.head}`);
  lines.push('');
  lines.push('HOW TO VERIFY THIS DOCUMENT');
  r.howToVerify.forEach((h, i) => lines.push(`  ${i + 1}. ${h}`));
  lines.push('');
  lines.push('LIMITS OF THIS RECORD');
  lines.push('  This shows the record was not altered after it was written, and in what order');
  lines.push('  events were recorded. It does not itself prove any statement was true when made.');
  return lines.join('\n');
}
