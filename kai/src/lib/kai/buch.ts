/* ============================================================
   DAS BUCH — twelve chapters a year, written by the machine that
   watched.

   At month end KAI writes the next chapter from the Spine in a fixed
   structure: what was true at the start, what he did, the ledger, the
   scars, the verdict.

   ── THE RULE THAT MAKES THIS WORTH KEEPING ────────────────────
   A chapter is only as good as its refusal to be literary. Every
   sentence here is assembled from counted events, and where a month
   holds nothing the chapter SAYS the month held nothing. A book that
   finds meaning in every month is a horoscope with better typography,
   and it would be worthless in five years — which is exactly when this
   is supposed to be worth something.

   THE VERDICT IS THE HARDEST PART and the most tempting place to
   flatter. It is derived, not written: money in versus money out,
   promises kept versus broken. If the month was bad the chapter says
   so in the first line of the verdict.

   Output is a self-contained HTML document — no build step, no
   dependencies, no network. It can be opened in twenty years by
   anything that renders HTML, which is the point of writing it down.
   ============================================================ */

import { getEvents, type KaiEvent } from './events';
import { getCommitments, type Commitment } from './commitments';

const DAY = 86_400_000;

export interface Bounds { start: number; end: number; label: string; key: string }

export function monthBounds(d = new Date()): Bounds {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
  const label = new Date(start).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const key = new Date(start).toISOString().slice(0, 7);
  return { start, end, label, key };
}

export function previousMonth(now = Date.now()): Bounds {
  const d = new Date(now);
  return monthBounds(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}

/* ── the chapter ─────────────────────────────────────────────── */

export interface Section { title: string; lines: string[] }
export interface Chapter {
  label: string;
  key: string;
  events: number;
  sections: Section[];
  verdict: string;
  empty: boolean;
}

function egp(n: number): string { return Math.round(n).toLocaleString('en-GB') + ' EGP'; }
function sum(evs: KaiEvent[]): number { return evs.reduce((s, e) => s + (typeof e.value === 'number' ? e.value : 0), 0); }

export function chapter(b: Bounds, now = Date.now()): Chapter {
  const inMonth = getEvents({ since: b.start, until: b.end - 1 }).filter((e) => e.ts <= now);
  const before = getEvents({ until: b.start - 1 });

  const sections: Section[] = [];

  /* ── I. WHAT WAS TRUE AT THE START ── */
  const startDebt = before.filter((e) => e.domain === 'debt' && typeof e.value === 'number').sort((a, x) => x.ts - a.ts)[0];
  const startOpen = getCommitments().filter((c) => c.createdAt < b.start && (c.resolvedAt == null || c.resolvedAt >= b.start));
  sections.push({
    title: 'What was true at the start',
    lines: before.length === 0
      ? ['Nothing. The record began this month.']
      : [
          `${before.length} events already on the record.`,
          startDebt ? `The card stood at ${egp(startDebt.value || 0)}.` : 'No card balance had been recorded.',
          startOpen.length ? `${startOpen.length} promise${startOpen.length === 1 ? '' : 's'} carried in, unfinished.` : 'Nothing was carried in unfinished.',
        ],
  });

  /* ── II. WHAT I DID ── */
  const byDomain = new Map<string, number>();
  for (const e of inMonth) byDomain.set(e.domain, (byDomain.get(e.domain) || 0) + 1);
  const busiest = [...byDomain.entries()].sort((a, x) => x[1] - a[1]).slice(0, 5);
  const bookings = inMonth.filter((e) => e.domain === 'makadi' && e.type === 'booking_confirmed');
  const kept = getCommitments().filter((c) => c.status === 'kept' && (c.resolvedAt ?? 0) >= b.start && (c.resolvedAt ?? 0) < b.end);
  sections.push({
    title: 'What I did',
    lines: inMonth.length === 0
      ? ['Nothing reached the record this month. That is the finding, not a gap in it.']
      : [
          `${inMonth.length} things happened and were written down.`,
          busiest.length ? `Busiest: ${busiest.map(([d, n]) => `${d} (${n})`).join(', ')}.` : '',
          bookings.length ? `${bookings.length} booking${bookings.length === 1 ? '' : 's'} confirmed.` : 'No bookings confirmed.',
          kept.length ? `${kept.length} promise${kept.length === 1 ? '' : 's'} kept.` : '',
        ].filter(Boolean),
  });

  /* ── III. THE LEDGER ── */
  const income = inMonth.filter((e) => e.domain === 'income' && typeof e.value === 'number');
  const expense = inMonth.filter((e) => e.domain === 'expense' && typeof e.value === 'number');
  const inTotal = sum(income), outTotal = sum(expense);
  sections.push({
    title: 'The ledger',
    lines: (income.length || expense.length)
      ? [
          `In:  ${egp(inTotal)} across ${income.length} entries.`,
          `Out: ${egp(outTotal)} across ${expense.length} entries.`,
          `Net: ${inTotal - outTotal >= 0 ? '+' : '−'}${egp(Math.abs(inTotal - outTotal))}.`,
        ]
      : ['No money was logged this month. The ledger is empty, which is a fact about the logging, not about the money.'],
  });

  /* ── IV. THE SCARS ── */
  const broken = getCommitments().filter((c) => c.status === 'broken' && (c.resolvedAt ?? 0) >= b.start && (c.resolvedAt ?? 0) < b.end);
  const anomalies = inMonth.filter((e) => e.domain === 'anomaly' || /fail|error|blocked|refused/i.test(e.type));
  sections.push({
    title: 'The scars',
    lines: (broken.length || anomalies.length)
      ? [
          ...broken.map((c) => `Broke: "${c.text}", due ${new Date(c.deadline).toISOString().slice(0, 10)}.`),
          ...anomalies.slice(-4).map((e) => `${new Date(e.ts).toISOString().slice(0, 10)} — ${e.domain}.${e.type}`),
        ]
      : ['Nothing broke that the record noticed.'],
  });

  /* ── V. THE VERDICT — derived, never written ── */
  const resolvedThis = [...kept, ...broken];
  const keptRate = resolvedThis.length ? kept.length / resolvedThis.length : null;
  const net = inTotal - outTotal;

  let verdict: string;
  if (inMonth.length === 0) {
    verdict = 'Nothing was recorded, so nothing can be judged. An empty month in the book is a month you did not keep.';
  } else if (keptRate === null && income.length === 0 && expense.length === 0) {
    verdict = 'The month happened but almost none of it was measured. There is not enough here to call it good or bad, and that itself is the verdict.';
  } else {
    const money = net > 0 ? `You ended ${egp(net)} up.` : net < 0 ? `You ended ${egp(Math.abs(net))} down.` : 'You ended level.';
    const word = keptRate === null ? 'No promise came due.'
      : keptRate >= 0.8 ? `You kept ${kept.length} of ${resolvedThis.length} promises.`
      : keptRate >= 0.5 ? `You kept ${kept.length} of ${resolvedThis.length} — half of what you said.`
      : `You kept ${kept.length} of ${resolvedThis.length}. Most of what you promised did not happen.`;
    verdict = `${money} ${word}`;
  }

  return {
    label: b.label, key: b.key, events: inMonth.length,
    sections, verdict, empty: inMonth.length === 0,
  };
}

/* ── the document ────────────────────────────────────────────
   Self-contained: no build step, no dependencies, no network. It has
   to open in twenty years. */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function chapterHtml(c: Chapter): string {
  const body = c.sections.map((s, i) => `
    <section>
      <h2><span class="n">${String(i + 1).padStart(2, '0')}</span>${esc(s.title)}</h2>
      ${s.lines.map((l) => `<p>${esc(l)}</p>`).join('\n      ')}
    </section>`).join('\n');

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DAS BUCH · ${esc(c.label)}</title>
<style>
  :root { --ink:#f0e2d0; --ink2:rgba(240,226,208,.56); --gold:#ffb46e; --bg:#080606; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
    font-weight:300; line-height:1.65; -webkit-font-smoothing:antialiased; }
  main { max-width:34rem; margin:0 auto; padding:14vh 1.5rem 20vh; }
  header { margin-bottom:5rem; }
  .kicker { font-size:.65rem; letter-spacing:.34em; text-transform:uppercase; color:var(--ink2); }
  h1 { font-size:clamp(2rem,8vw,3rem); font-weight:300; letter-spacing:-.02em; margin:.6rem 0 0; }
  .count { font-size:.7rem; letter-spacing:.16em; text-transform:uppercase; color:var(--ink2); margin-top:1rem; }
  section { margin:0 0 3.4rem; }
  h2 { font-size:.7rem; font-weight:600; letter-spacing:.24em; text-transform:uppercase;
    color:var(--gold); margin:0 0 1rem; display:flex; gap:.9rem; align-items:baseline; }
  .n { color:var(--ink2); font-weight:300; }
  p { margin:0 0 .7rem; font-size:1rem; color:var(--ink); }
  .verdict { margin-top:5rem; padding-top:2.4rem; border-top:1px solid rgba(255,180,110,.18); }
  .verdict h2 { color:var(--ink2); }
  .verdict p { font-size:clamp(1.2rem,4.4vw,1.5rem); line-height:1.4; letter-spacing:-.01em; }
  footer { margin-top:6rem; font-size:.62rem; letter-spacing:.18em; text-transform:uppercase; color:rgba(240,226,208,.3); }
  @media print { body { background:#fff; color:#111; } h2 { color:#8a5a20; } }
</style>
</head><body><main>
  <header>
    <div class="kicker">Das Buch</div>
    <h1>${esc(c.label)}</h1>
    <div class="count">${c.events} events on the record</div>
  </header>
${body}
  <div class="verdict">
    <h2><span class="n">${String(c.sections.length + 1).padStart(2, '0')}</span>The verdict</h2>
    <p>${esc(c.verdict)}</p>
  </div>
  <footer>Written from the Spine · not edited afterwards</footer>
</main></body></html>`;
}

export function chapterText(c: Chapter): string {
  const L = [`DAS BUCH — ${c.label}`, `${c.events} events on the record`, ''];
  for (const s of c.sections) {
    L.push(s.title.toUpperCase());
    for (const l of s.lines) L.push('  ' + l);
    L.push('');
  }
  L.push('THE VERDICT');
  L.push('  ' + c.verdict);
  return L.join('\n');
}
