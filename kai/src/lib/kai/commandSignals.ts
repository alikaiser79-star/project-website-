/* ============================================================
   Real-signal provider for the Command Core.

   Each organ maps to a real domain in KAI. Both the value and
   the "calling" boolean come from the Spine + stores — never
   random walks. An organ calls when ITS domain has something
   that genuinely needs Ali's tap:
     02 DEBT     — no payment_logged event in the last 30 days
                   AND balance > 0
     04 MAKADI   — door lock still flagged
     06 PRIORITIES — any open priority older than 7 days
     08 CONTENT  — > 5 items stuck in 'idea' status
     09 MIRROR   — any open commitment < 24h to deadline OR
                   overdue OR recently broken
     10 LEDGER   — any open promise past its deadline
     11 TOLLGATE — runway < 14 days
     12 INBOX    — pending action sitting in the gate > 6h
                   OR a system.token_warning in the last 24h
   Others (01 Income, 03 Garden, 05 Instagram, 07 Expenses) are
   status-only — they never call. Their value still updates.

   Ack maps to a real action (ping the source panel, switch view,
   etc.) so tapping an organ actually does something.
   ============================================================ */

import type { OrganSignal } from './commandCore';
import { loadState } from '../store';
import { listExpenses, monthlyTotal } from '../expenses';
import { listQueue, queueCount } from '../content';
import { mirrorScore, getCommitments } from './commitments';
import { listPromises, reliabilityFor } from './ledger';
import { computeRunway } from './runway';
import { getEvents } from './events';
import { getPending } from './pending';
import { operator } from '../../kaiConfig';
import { deadlineCalling } from './deadlines';
import { fmtMoney, monthlyIncomeEgp } from './money';
import type { Currency } from '../../types';

const DAY = 86_400_000;
const HOUR = 3_600_000;

/* Compact magnitude for NON-money values (follower counts, etc.). Money
   never uses this — money goes through fmtMoney so it carries a code. */
function fmtCompact(n: number): string {
  if (!isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 10_000)    return Math.round(n / 1000) + 'K';
  return Math.round(n).toLocaleString(operator.locale);
}

function fmtPct(n: number): string {
  if (!isFinite(n)) return '—';
  return Math.round(n) + '%';
}

function fmtInt(n: number, suf = ''): string {
  return Math.round(n).toLocaleString(operator.locale) + suf;
}

export function getCommandSignals(): Record<string, OrganSignal> {
  const out: Record<string, OrganSignal> = {};
  const now = Date.now();

  try {
    const s = loadState();

    /* 01 INCOME — monthly projection in EGP, occupancy-aware. Every
       stream is converted to EGP by its own currency; Makadi is NOT
       counted at a flat 22-night assumption — it contributes only its
       realised nights (0 booked → 0), so the headline can't show
       phantom rental income. Never calls. */
    try {
      const income = monthlyIncomeEgp(s.income, now);
      out['01'] = { formatted: fmtMoney(income, 'EGP'), calling: false };
    } catch { out['01'] = { formatted: '—', calling: false }; }

    /* 02 DEBT — balance. Calls "card past due" ONLY on a real dated
       signal: an OPEN commitment in the debt domain that's overdue.
       The old "no payment in 30d" test false-fired on every fresh
       Spine and pinned the heart — removed. */
    try {
      const bal = s.debtCurrent || 0;
      const overdueDebt = getCommitments().some(c =>
        c.status === 'open' && c.metric?.domain === 'debt' && c.deadline < now
      );
      out['02'] = {
        formatted: fmtMoney(bal, 'EGP'),
        calling: bal > 0 && overdueDebt,
      };
    } catch { out['02'] = { formatted: '—', calling: false }; }

    /* 03 GARDEN — plant count. Status-only. */
    try {
      const plants = s.garden?.plantCount ?? 0;
      out['03'] = { formatted: fmtInt(plants), calling: false };
    } catch { out['03'] = { formatted: '—', calling: false }; }

    /* 04 MAKADI — nightly rate. Calls NEEDS-YOU ONLY on the real
       signal: 0 nights booked (latest nights_booked event, else
       occupancy30d === 0). The fixLock default was removed as a
       trigger — the lock was replaced, and a maintenance flag is
       not a "needs you now" signal. */
    try {
      const rate = s.makadi?.nightlyRate ?? 0;
      const rateCcy = (s.makadi?.rateCcy ?? 'USD') as Currency;
      const lastNights = getEvents({ domain: 'makadi', type: 'nights_booked', since: now - 30 * DAY }).slice(-1)[0];
      const nightsZero = lastNights
        ? (lastNights.value ?? 0) === 0
        : (s.makadi?.occupancy30d ?? 1) === 0;
      out['04'] = {
        formatted: fmtMoney(rate, rateCcy),          // e.g. "34 USD" — never a naked number
        calling: nightsZero,
      };
    } catch { out['04'] = { formatted: '—', calling: false }; }

    /* 05 INSTAGRAM — total followers. Status-only. */
    try {
      const total = (s.instagram || []).reduce((sum, a) => sum + (a.followers || 0), 0);
      out['05'] = { formatted: fmtCompact(total), calling: false };   // followers, not money
    } catch { out['05'] = { formatted: '—', calling: false }; }

    /* 06 PRIORITIES — open count. Status-only. The old ">5 open"
       heuristic wasn't one of the real signals and could false-fire;
       priority urgency surfaces through the Mirror (commitments)
       instead. */
    try {
      const open = (s.priorities || []).filter(p => !p.done);
      out['06'] = {
        formatted: fmtInt(open.length, ' OPEN'),
        calling: false,
      };
    } catch { out['06'] = { formatted: '—', calling: false }; }

    /* 07 EXPENSES — monthly total. Status-only (Tollgate
       handles the runway alert). */
    try {
      const month = monthlyTotal();
      const count = listExpenses().filter(e => e.date.startsWith(new Date().toISOString().slice(0, 7))).length;
      void count;
      out['07'] = { formatted: fmtMoney(month, 'EGP'), calling: false };
    } catch { out['07'] = { formatted: '—', calling: false }; }

    /* 08 CONTENT — queued items. Status-only. */
    try {
      const qc = queueCount();
      const queue = listQueue();
      void queue;
      out['08'] = {
        formatted: fmtInt(qc.total, ' QUEUED'),
        calling: false,
      };
    } catch { out['08'] = { formatted: '—', calling: false }; }

    /* 09 MIRROR — kept %. Calls when an open commitment is
       overdue or < 24h to deadline. */
    try {
      const ms = mirrorScore();
      const cms = getCommitments();
      const calling = cms.some(c =>
        c.status === 'open' && c.deadline < now + DAY
      );
      out['09'] = {
        formatted: ms.score === null ? '—' : fmtPct(ms.score),
        calling,
      };
    } catch { out['09'] = { formatted: '—', calling: false }; }

    /* 10 LEDGER — average reliability across known people.
       Calls when any open promise is overdue. */
    try {
      const peopleIds = Array.from(new Set(listPromises().map(p => p.personId)));
      let totalDel = 0, totalRes = 0;
      for (const id of peopleIds) {
        const r = reliabilityFor(id);
        totalDel += r.delivered;
        totalRes += r.total;
      }
      const overdueCount = listPromises().filter(p => p.status === 'open' && p.deadline < now).length;
      out['10'] = {
        formatted: totalRes === 0 ? '—' : fmtPct((totalDel / totalRes) * 100),
        calling: overdueCount > 0,
      };
    } catch { out['10'] = { formatted: '—', calling: false }; }

    /* 11 TOLLGATE — days of runway. Calls when runway < 14d OR
       cash_on_hand is critically low (< 5,000 EGP). Reads the
       latest system.cash_on_hand event, else the liquidCash store. */
    try {
      const r = computeRunway();
      const lastCash = getEvents({ domain: 'system', type: 'cash_on_hand', since: now - 30 * DAY }).slice(-1)[0];
      const cash = lastCash ? (lastCash.value ?? 0) : (s.liquidCash ?? 0);
      const cashCritical = cash > 0 && cash < 5000;
      out['11'] = {
        formatted: r.runwayDays === null ? '—' : Math.floor(r.runwayDays) + 'd',
        calling: (r.runwayDays !== null && r.runwayDays < 14) || cashCritical,
      };
    } catch { out['11'] = { formatted: '—', calling: false }; }

    /* 12 INBOX — gate-pending count. Calls when ANY pending
       action has been sitting > 6h OR a token_warning recent. */
    try {
      const pending = getPending();
      const stale = pending.some(a => now - a.createdAt > 6 * HOUR);
      const tokenWarn = getEvents({ domain: 'system', type: 'token_warning', since: now - DAY }).length > 0;
      out['12'] = {
        formatted: fmtInt(pending.length, ' PENDING'),
        calling: stale || tokenWarn,
      };
    } catch { out['12'] = { formatted: '—', calling: false }; }
  } catch {
    /* defensive — if anything throws, return safe defaults so the
       organism never blanks out. */
    for (const id of ['01','02','03','04','05','06','07','08','09','10','11','12']) {
      if (!out[id]) out[id] = { formatted: '—', calling: false };
    }
  }

  /* Anomaly Watch (7.4): a recent anomaly event makes its organ call.
     Kept out of the anomaly module to avoid an import cycle. */
  try {
    const ORGAN_OF: Record<string, string> = { debt: '02', makadi: '04', expense: '07', commitment: '09', system: '11' };
    const recent = getEvents({ domain: 'anomaly', since: now - 7 * DAY });
    for (const e of recent) {
      const organ = ORGAN_OF[String(e.meta?.of ?? '')];
      if (organ && out[organ]) out[organ] = { ...out[organ], calling: true };
    }
  } catch { /* ignore */ }

  /* Calendar of War (6.2): a deadline at T-3d or past makes the
     Priorities organ (06) call — a hard date must not slip. */
  try {
    if (deadlineCalling(now) && out['06']) out['06'] = { ...out['06'], calling: true };
  } catch { /* ignore */ }

  return out;
}

/* Ack action per organ — opens the source panel via the existing
   ping-panel action bus, which auto-switches view first. */
export const ACK_ROUTE: Record<string, string> = {
  '01': '01',  '02': '02',  '03': '03',  '04': '04',
  '05': '05',  '06': '06',  '07': '07',  '08': '08',
  '09': '09',  '10': '11',  '11': '10',  '12': '13',
};
/* Note: panel num "13" is Inbox in Comms. The Ledger panel is "11"
   (lives in Operations). The Tollgate panel is "10" (lives in
   Money). Mapping fixed accordingly so org 10 (Ledger) opens
   panel 11, org 11 (Tollgate) opens panel 10. */
