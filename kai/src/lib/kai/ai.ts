/* ============================================================
   Commitment extraction.

   The user speaks/types a promise. Claude maps it (via the
   existing /api/claude server proxy) to one of the metrics the
   Spine actually fires. If nothing fits — return null. Better
   no commitment than a phantom one that can never resolve.

   COMMITMENT_VOCAB MUST stay aligned with the logEvent() calls
   in the rest of the app. Anything you add here also needs a
   real event firing somewhere.
   ============================================================ */

import type { Domain } from './events';
import type { CommitmentInput } from './commitments';

export interface VocabEntry { domain: Domain; event: string; means: string; }

export const COMMITMENT_VOCAB: VocabEntry[] = [
  /* Money / debt — fired by lib/tools.ts apply_debt_payment. */
  { domain: 'debt',       event: 'payment_logged',   means: 'a single credit-card payment in EGP' },
  { domain: 'debt',       event: 'balance_updated',  means: 'credit-card balance after a payment, absolute EGP. Use for "pay down to X".' },

  /* Makadi Airbnb — fired by lib/store.ts updateMakadi when rate changes. */
  { domain: 'makadi',     event: 'rate_changed',     means: 'the nightly Airbnb rate, as an absolute EGP number per night' },
  { domain: 'makadi',     event: 'occupancy_set',    means: 'the 30-day occupancy fraction 0..1 (e.g. 0.85 for 85%)' },

  /* Hidden Garden — fired by lib/store.ts updateGarden when plant count changes. */
  { domain: 'garden',     event: 'plant_added',      means: 'total Hidden Garden plant count after adding plants, absolute' },

  /* Instagram — fired by lib/store.ts upsertInstagram. */
  { domain: 'instagram',  event: 'follower_synced',  means: 'follower count for a handle, absolute. Pass the handle in meta when you can.' },

  /* Content queue — fired when an item flips to posted in lib/content.ts. */
  { domain: 'content',    event: 'reel_posted',      means: 'a reel was published. value = 1 per post. Use op ">=" target N for "post N reels".' },
  { domain: 'content',    event: 'item_posted',      means: 'any content item published (reel | carousel | story). value = 1 per post.' },

  /* Priorities — fired by complete_priority + the panel toggle. */
  { domain: 'priorities', event: 'task_done',        means: 'a priority completed. value = 1 per completion. meta.text = task label.' },

  /* Expenses — fired by lib/expenses.ts addExpense. */
  { domain: 'expense',    event: 'expense_logged',   means: 'a logged expense. value = amount. meta.category = bucket. Use op "<=" target N for "spend under N this month".' },
];

const DAY = 86_400_000;

export async function extractCommitment(text: string): Promise<CommitmentInput | null> {
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const vocabLines = COMMITMENT_VOCAB
    .map((v) => `- domain "${v.domain}", event "${v.event}": ${v.means}`).join('\n');

  const system =
`You extract at most ONE self-commitment from the user's message — a promise they made to themselves with a measurable outcome.

Today is ${todayISO}.

Map the outcome to exactly one of these tracked metrics:
${vocabLines}

Return ONLY JSON, no prose, in this shape:
{"text":"short restatement","domain":"...","event":"...","op":">="|"<="|"==","target":<number>,"deadline":"YYYY-MM-DD"}

Rules:
- target is an ABSOLUTE value (e.g. "raise rate to 55" -> target 55, op ">=").
- "pay down the card to 40k" -> domain debt, event balance_updated, op "<=", target 40000.
- "post 3 reels this week" -> domain content, event reel_posted, op ">=", target 3 (counted as a sum).
- If no deadline is stated, infer a reasonable one from context, else 14 days out.
- If there is no real self-commitment, or it can't map to a metric above, return exactly: null`;

  let raw = '';
  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system,
        messages: [{ role: 'user', content: text }],
      }),
    });
    const data = await res.json();
    raw = extractText(data);
  } catch {
    return null;
  }
  return parseCommitment(raw, today.getTime());
}

/* Tolerant of different proxy response shapes — Anthropic
   non-stream returns { content: [{ type: 'text', text }] }. */
function extractText(data: any): string {
  if (typeof data === 'string') return data;
  if (Array.isArray(data?.content)) {
    return data.content
      .filter((b: any) => b?.type === 'text' || typeof b?.text === 'string')
      .map((b: any) => b.text || '').join('\n');
  }
  return data?.text ?? data?.completion ?? data?.message ?? '';
}

function parseCommitment(raw: string, nowMs: number): CommitmentInput | null {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  if (/^null$/i.test(cleaned)) return null;
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let obj: any;
  try { obj = JSON.parse(m[0]); } catch { return null; }
  if (!obj?.event || !obj?.domain) return null;

  /* Validate against vocab — reject anything we can't actually
     fire an event for. Better no commitment than a phantom. */
  const ok = COMMITMENT_VOCAB.some(v => v.domain === obj.domain && v.event === obj.event);
  if (!ok) return null;

  const op = ['>=', '<=', '=='].includes(obj.op) ? obj.op : '>=';
  const target = Number(obj.target);
  if (Number.isNaN(target)) return null;

  let deadline: number;
  if (typeof obj.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.deadline)) {
    deadline = new Date(obj.deadline + 'T23:59:59').getTime();
  } else {
    deadline = nowMs + 14 * DAY;
  }

  return {
    text: String(obj.text || '').trim() || raw.slice(0, 80),
    metric: { domain: obj.domain, event: obj.event, op, target },
    deadline,
  };
}
