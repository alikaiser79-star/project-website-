/* ============================================================
   THE WITNESS.

   Once per day, on first unlock, KAI says one line before the
   Command view. Not a briefing, not advice, not metrics — a
   TESTIMONY: one sentence about who this man's actions PROVE he
   is, written like an epitaph in reverse. Only claims the Spine
   can back. Never flatters. On a day a commitment broke, it says
   so, flat.

   The line is generated from getEvents(30d) + the Mirror via the
   /api/claude proxy, cached per day in a rolling 30-line scroll
   (swipe down on the hero to read the month). If the proxy is
   unreachable, a deterministic local witness speaks from the same
   events so the Witness is never silent — and never invents.
   ============================================================ */

import { getEvents } from './events';
import { getCommitments } from './commitments';
import { loadState } from '../store';

export interface WitnessEntry { date: string; line: string; }

const SCROLL_KEY = 'kai.witness.scroll';   // last 30 testimony lines
const SHOWN_KEY  = 'kai.witness.shownDate'; // YYYY-MM-DD last shown
const MAX_SCROLL = 30;
const DAY = 86_400_000;
const MAX_LEN = 90;

/* Praise words the Witness must never use. If the model slips one
   in, we don't ship the line — we fall back to the flat local one. */
const PRAISE = /\b(great|amazing|incredible|awesome|proud|well done|impressive|fantastic|excellent|brilliant|good job|keep it up|nailed it)\b/i;

export function todayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function getScroll(): WitnessEntry[] {
  try { return JSON.parse(localStorage.getItem(SCROLL_KEY) || '[]'); } catch { return []; }
}
function saveScroll(list: WitnessEntry[]): void {
  try { localStorage.setItem(SCROLL_KEY, JSON.stringify(list.slice(0, MAX_SCROLL))); } catch { /* ignore */ }
}

/* Show at most once per calendar day. */
export function shouldShowWitness(now = Date.now()): boolean {
  try { return localStorage.getItem(SHOWN_KEY) !== todayKey(now); } catch { return false; }
}
export function markWitnessShown(now = Date.now()): void {
  try { localStorage.setItem(SHOWN_KEY, todayKey(now)); } catch { /* ignore */ }
}

function clampLine(s: string): string {
  let line = String(s || '').replace(/\s+/g, ' ').trim().replace(/^["']|["']$/g, '');
  if (line.length > MAX_LEN) line = line.slice(0, MAX_LEN - 1).trimEnd() + '…';
  return line;
}

/* Compact, factual digest of the last 30 days for the model. Every
   line here is a real Spine event or Mirror row — the model may only
   arrange these facts, never add new ones. */
function buildDigest(now = Date.now()): string {
  const since = now - 30 * DAY;
  const evs = getEvents({ since });
  const lines: string[] = [];
  for (const e of evs.slice(-60)) {
    const days = Math.max(0, Math.round((now - e.ts) / DAY));
    const meta = e.meta && Object.keys(e.meta).length ? ' ' + JSON.stringify(e.meta) : '';
    const val = typeof e.value === 'number' ? ' ' + e.value : '';
    lines.push(`${days}d ago · ${e.domain}.${e.type}${val}${meta}`);
  }
  const cms = getCommitments();
  for (const c of cms) {
    const dd = Math.round((c.deadline - now) / DAY);
    const when = dd < 0 ? `${-dd}d overdue` : `${dd}d left`;
    lines.push(`commitment[${c.status}] "${c.text}" (${when})`);
  }
  return lines.join('\n');
}

/* Deterministic local witness — used when the proxy is unreachable.
   Speaks only from the Spine, prioritising a broken promise, then an
   overdue one, then a proven act, then the card. Never flatters. */
export function localWitness(now = Date.now()): string {
  const cms = getCommitments();
  const broken = cms.find(c => c.status === 'broken');
  if (broken) return clampLine(`You said: "${broken.text}." The data says it didn't happen.`);

  const overdue = cms.filter(c => c.status === 'open' && c.deadline < now).sort((a, b) => a.deadline - b.deadline)[0];
  if (overdue) {
    const dd = Math.round((now - overdue.deadline) / DAY);
    return clampLine(`"${overdue.text}" — ${dd} day${dd === 1 ? '' : 's'} past the line. The Mirror is watching.`);
  }

  const since = now - 30 * DAY;
  const lock = getEvents({ domain: 'makadi', type: 'lock_replaced', since })[0];
  if (lock) return clampLine('The lock your file calls broken — you replaced it with your own hands.');

  const bal = getEvents({ domain: 'debt', type: 'balance_updated', since }).slice(-1)[0];
  if (bal && typeof bal.value === 'number') {
    return clampLine(`Thirty days of this card, and the number is ${Math.round(bal.value / 1000)}k. You didn't look away.`);
  }

  const nights = getEvents({ domain: 'makadi', type: 'nights_booked', since }).slice(-1)[0];
  if (nights && (nights.value ?? 0) === 0) {
    return clampLine('It is rentable, and it is empty. The listing waits on you, not the room.');
  }

  const s = loadState();
  return clampLine(`Thirty days logged. ${(s.priorities || []).filter(p => !p.done).length} still open. The record is honest.`);
}

async function generateFromClaude(now = Date.now()): Promise<string | null> {
  const digest = buildDigest(now);
  const system =
`You are THE WITNESS inside KAI. You speak ONE line to Ali before he sees his day.
It is not a briefing, not advice, not a metric. It is a TESTIMONY: one sentence about
who this man's actions prove he is — written like an epitaph in reverse.

Register (match this tone, do not copy):
- "Thirty days ago this card was 75,000. You didn't talk about it."
- "The lock your file calls broken — you replaced it with your own hands, 500km away."
- "You promised photos by the 12th. The Mirror is watching. So am I."

HARD RULES:
- Only state claims the FACTS below can prove. Cite nothing you cannot see there.
- ONE sentence, max ${MAX_LEN} characters.
- No praise words (great, amazing, proud, well done, impressive…). No flattery. Ever.
- If a commitment broke, say so — flat, no cushion.
- Plain JetBrains-Mono English. No markdown, no quotes around the whole line, no emoji.
Return ONLY the line.

FACTS (last 30 days of the Spine + the Mirror):
${digest}`;

  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 120,
        system,
        messages: [{ role: 'user', content: 'Speak the line.' }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = Array.isArray(data?.content)
      ? data.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join(' ')
      : (data?.text ?? '');
    const line = clampLine(raw);
    if (!line || PRAISE.test(line)) return null;   // never ship flattery
    return line;
  } catch {
    return null;
  }
}

/* Return today's testimony, generating + caching it if needed. Always
   resolves to a real line (Claude, else the local witness). */
export async function ensureTodayTestimony(now = Date.now()): Promise<string> {
  const key = todayKey(now);
  const scroll = getScroll();
  const existing = scroll.find(e => e.date === key);
  if (existing) return existing.line;

  const line = (await generateFromClaude(now)) || localWitness(now);
  const next = [{ date: key, line }, ...scroll.filter(e => e.date !== key)].slice(0, MAX_SCROLL);
  saveScroll(next);
  return line;
}
