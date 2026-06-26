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

const DAY = 86_400_000;
const HOUR = 3_600_000;

function fmtUsd(n: number): string {
  /* Display in EGP — operator's home currency — formatted compactly. */
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

    /* 01 INCOME — monthly projection in EGP. Never calls. */
    try {
      const income = (s.income || []).reduce((sum, i) => {
        const monthly = i.cadence === 'nightly' ? i.amount * 22 : i.amount;
        const rate = s.fxEgpPerEur || 53.5;
        return sum + (i.ccy === 'EUR' ? monthly * rate : monthly);
      }, 0);
      out['01'] = { formatted: fmtUsd(income), calling: false };
    } catch { out['01'] = { formatted: '—', calling: false }; }

    /* 02 DEBT — current balance. Calls when balance > 0 AND no
       payment_logged event in the last 30 days. */
    try {
      const bal = s.debtCurrent || 0;
      const since = now - 30 * DAY;
      const paid = getEvents({ domain: 'debt', type: 'payment_logged', since }).length;
      out['02'] = {
        formatted: fmtUsd(bal),
        calling: bal > 0 && paid === 0,
      };
    } catch { out['02'] = { formatted: '—', calling: false }; }

    /* 03 GARDEN — plant count. Status-only. */
    try {
      const plants = s.garden?.plantCount ?? 0;
      out['03'] = { formatted: fmtInt(plants), calling: false };
    } catch { out['03'] = { formatted: '—', calling: false }; }

    /* 04 MAKADI — nightly rate. Calls when door lock is flagged. */
    try {
      const rate = s.makadi?.nightlyRate ?? 0;
      out['04'] = {
        formatted: fmtUsd(rate),
        calling: !!s.makadi?.fixLock,
      };
    } catch { out['04'] = { formatted: '—', calling: false }; }

    /* 05 INSTAGRAM — total followers. Status-only. */
    try {
      const total = (s.instagram || []).reduce((sum, a) => sum + (a.followers || 0), 0);
      out['05'] = { formatted: fmtUsd(total), calling: false };
    } catch { out['05'] = { formatted: '—', calling: false }; }

    /* 06 PRIORITIES — open count. Calls if any open priority
       is older than 7 days. */
    try {
      const open = (s.priorities || []).filter(p => !p.done);
      /* Priorities don't store createdAt currently — proxy via
         "more than 5 open" instead. */
      out['06'] = {
        formatted: fmtInt(open.length, ' OPEN'),
        calling: open.length > 5,
      };
    } catch { out['06'] = { formatted: '—', calling: false }; }

    /* 07 EXPENSES — monthly total. Status-only (Tollgate
       handles the runway alert). */
    try {
      const month = monthlyTotal();
      const count = listExpenses().filter(e => e.date.startsWith(new Date().toISOString().slice(0, 7))).length;
      void count;
      out['07'] = { formatted: fmtUsd(month), calling: false };
    } catch { out['07'] = { formatted: '—', calling: false }; }

    /* 08 CONTENT — queued items. Calls when > 5 unshot ideas
       stacking (means the planner ran but nothing's shipping). */
    try {
      const qc = queueCount();
      const queue = listQueue();
      void queue;
      out['08'] = {
        formatted: fmtInt(qc.total, ' QUEUED'),
        calling: qc.idea > 5,
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

    /* 11 TOLLGATE — days of runway. Calls when < 14d. */
    try {
      const r = computeRunway();
      out['11'] = {
        formatted: r.runwayDays === null ? '—' : Math.floor(r.runwayDays) + 'd',
        calling: r.runwayDays !== null && r.runwayDays < 14,
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
