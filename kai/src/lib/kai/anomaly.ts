/* ============================================================
   ANOMALY WATCH (AI 7.4). Statistics run on the client, FIRST and
   free. Claude is called ONLY when a real trigger fires — never on a
   timer, never to poll. On a fire, one call writes the alarm in plain
   language; it's logged to the Spine as an `anomaly` event (which
   makes the matching organ start calling) and surfaced as a toast.

   Triggers (all client-side):
     - burn spike       — recent 3-day burn > 1.5× the trailing 30-day
                           daily average
     - overdue promise  — an open commitment past its deadline
     - stale call       — an organ calling > 48h (proxy for unacked)

   Each trigger has a stable key and fires at most once per day.
   ============================================================ */

import { getEvents, logEvent, type Domain } from './events';
import { getCommitments } from './commitments';
import { getCommandSignals } from './commandSignals';
import { askClaude } from '../claude';
import { toast } from '../../hooks/useToasts';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const FIRED = (key: string, day: string) => `kai.anomaly.fired.${day}.${key}`;
const CALLSINCE = (id: string) => `kai.anomaly.callsince.${id}`;

interface Trigger { key: string; kind: 'burn_spike' | 'overdue_promise' | 'stale_call'; of: Domain; detail: string; }

/* organ id → the domain an anomaly should attribute to (for calling). */
export const ANOMALY_ORGAN: Record<string, Domain> = {
  '02': 'debt', '04': 'makadi', '07': 'expense', '09': 'commitment', '11': 'system',
};

function detectTriggers(now: number): Trigger[] {
  const out: Trigger[] = [];

  /* burn spike */
  try {
    const sum = (since: number) => getEvents({ domain: 'expense', type: 'expense_logged', since })
      .reduce((s, e) => s + (typeof e.value === 'number' ? e.value : 0), 0);
    const avg30 = sum(now - 30 * DAY) / 30;
    const recent3 = sum(now - 3 * DAY) / 3;
    if (avg30 > 0 && recent3 > avg30 * 1.5) {
      out.push({ key: 'burn_spike', kind: 'burn_spike', of: 'expense', detail: `3-day burn ${Math.round(recent3)}/day vs 30-day avg ${Math.round(avg30)}/day` });
    }
  } catch { /* skip */ }

  /* overdue commitments */
  try {
    for (const c of getCommitments()) {
      if (c.status === 'open' && c.deadline < now) {
        const dd = Math.round((now - c.deadline) / DAY);
        out.push({ key: 'overdue_' + c.id, kind: 'overdue_promise', of: (c.metric?.domain as Domain) || 'commitment', detail: `"${c.text}" ${dd}d past deadline` });
      }
    }
  } catch { /* skip */ }

  /* stale call — an organ calling > 48h. Track first-seen; clear when
     it stops calling (which stands in for being acked/resolved). */
  try {
    const sig = getCommandSignals();
    for (const id of Object.keys(ANOMALY_ORGAN)) {
      const calling = !!sig[id]?.calling;
      if (calling) {
        const raw = localStorage.getItem(CALLSINCE(id));
        const since = raw ? +raw : now;
        if (!raw) localStorage.setItem(CALLSINCE(id), String(now));
        if (now - since > 48 * HOUR) {
          out.push({ key: 'stale_' + id, kind: 'stale_call', of: ANOMALY_ORGAN[id], detail: `organ ${id} calling for ${Math.round((now - since) / HOUR)}h` });
        }
      } else {
        localStorage.removeItem(CALLSINCE(id));
      }
    }
  } catch { /* skip */ }

  return out;
}

function localAlarm(t: Trigger): string {
  if (t.kind === 'burn_spike') return `Spend is running hot — ${t.detail}. Ease off before it eats the runway.`;
  if (t.kind === 'overdue_promise') return `Overdue: ${t.detail}. The Mirror already logged it.`;
  return `Something has needed you for two days — ${t.detail}. Clear it or kill it.`;
}

/* Run the watch. Detects triggers client-side; for each NEW one, makes
   ONE Claude call for the plain-language alarm, logs it to the Spine,
   and toasts it. Returns how many fired. Safe to call on boot / on the
   Spine bus — it never calls Claude unless a fresh trigger exists. */
export async function runAnomalyWatch(now = Date.now()): Promise<number> {
  const day = dayKey(now);
  const fresh = detectTriggers(now).filter(t => {
    try { return !localStorage.getItem(FIRED(t.key, day)); } catch { return false; }
  });
  let fired = 0;
  for (const t of fresh) {
    try { localStorage.setItem(FIRED(t.key, day), '1'); } catch { /* ignore */ }
    let text: string;
    try {
      const prompt =
        'Write ONE plain, flat sentence (no praise, no padding) alerting the operator to ' +
        'this anomaly in his numbers. Name the number. Give the counter-move in the same ' +
        `sentence if it fits.\n\nANOMALY: ${t.detail}`;
      text = (await askClaude(prompt, [])).trim() || localAlarm(t);
    } catch {
      text = localAlarm(t);   // offline → the deterministic alarm
    }
    try { logEvent({ domain: 'anomaly', type: t.kind, value: 1, meta: { text, of: t.of, detail: t.detail }, source: 'ai' }); } catch { /* ignore */ }
    /* On phones the calling organ + Spine already carry it; a fixed
       toast would overlay the river (the zero-overlap law). */
    const mobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (!mobile) { try { toast.warn(text, 'ANOMALY', 9000); } catch { /* ignore */ } }
    fired++;
  }
  return fired;
}
