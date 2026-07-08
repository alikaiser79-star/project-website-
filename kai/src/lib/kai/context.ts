/* ============================================================
   buildKaiContext() — the real-numbers block every AI feature packs
   before it calls Claude, so KAI answers from Ali's data, not thin
   air. ~2.6k chars: live organ values (with [CALLING] flags), open
   commitments deadline-ranked, and a 30-day Spine summary.

   Every section is boot-from-empty safe — a fresh, unseeded install
   must never throw here. Missing data degrades to "—", never a crash.
   ============================================================ */

import { getCommandSignals } from './commandSignals';
import { retrievalBlock } from './retrieval';
import { getCommitments } from './commitments';
import { getEvents } from './events';
import { activeMissions } from './agent';
import { leadCounts } from './leads';

const DAY = 86_400_000;

const ORGAN_LABELS: Record<string, string> = {
  '01': 'INCOME', '02': 'DEBT', '03': 'GARDEN', '04': 'MAKADI',
  '05': 'INSTAGRAM', '06': 'PRIORITIES', '07': 'EXPENSES', '08': 'CONTENT',
  '09': 'MIRROR', '10': 'LEDGER', '11': 'TOLLGATE', '12': 'INBOX',
};

export function buildKaiContext(now = Date.now(), query?: string): string {
  const out: string[] = [];
  out.push(`DATE: ${new Date(now).toISOString().slice(0, 10)} (Africa/Cairo)`);

  /* §13.3a — query-aware Spine retrieval: pull the RIGHT events for the
     question (keyword+recency over the whole Spine), not just recent. */
  if (query && query.trim()) {
    try { const block = retrievalBlock(query, now); if (block) out.push(block); } catch { /* ignore */ }
  }

  /* ── live organ values ── */
  out.push('\nLIVE SIGNALS (an organ marked [CALLING] genuinely needs Ali now):');
  try {
    const sig = getCommandSignals();
    for (const id of Object.keys(ORGAN_LABELS)) {
      const s = sig[id];
      const val = s?.formatted ?? '—';
      const call = s?.calling ? '  [CALLING]' : '';
      out.push(`  ${id} ${ORGAN_LABELS[id].padEnd(10)} ${val}${call}`);
    }
  } catch { out.push('  (signals unavailable)'); }

  /* ── open commitments, deadline-ranked ── */
  out.push('\nOPEN COMMITMENTS (the Mirror, soonest deadline first):');
  try {
    const open = getCommitments()
      .filter(c => c.status === 'open')
      .sort((a, b) => a.deadline - b.deadline);
    if (!open.length) out.push('  (none open)');
    for (const c of open.slice(0, 12)) {
      const dd = Math.round((c.deadline - now) / DAY);
      const when = dd < 0 ? `${-dd}d PAST DUE` : dd === 0 ? 'due today' : `${dd}d left`;
      out.push(`  - "${c.text}" (${when})`);
    }
  } catch { out.push('  (commitments unavailable)'); }

  /* ── 30-day Spine summary ── */
  out.push('\nSPINE — last 30 days:');
  try {
    const since = now - 30 * DAY;
    const evs = getEvents({ since });
    const byDomain: Record<string, number> = {};
    for (const e of evs) byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
    const counts = Object.entries(byDomain).sort((a, b) => b[1] - a[1])
      .map(([d, n]) => `${d}×${n}`).join(', ') || '(no events)';
    out.push(`  counts: ${counts}`);
    out.push('  recent:');
    for (const e of evs.slice(-18)) {
      const dago = Math.max(0, Math.round((now - e.ts) / DAY));
      const v = typeof e.value === 'number' ? ' ' + e.value : '';
      out.push(`    ${dago}d ago · ${e.domain}.${e.type}${v}`);
    }
  } catch { out.push('  (spine unavailable)'); }

  /* ── active missions + pipeline ── */
  try {
    const missions = activeMissions();
    const lc = leadCounts();
    const pipe = Object.entries(lc).filter(([, n]) => n > 0).map(([s, n]) => `${s} ${n}`).join(', ') || 'empty';
    out.push('\nAGENT & PIPELINE:');
    out.push(`  active missions: ${missions.length}${missions.length ? ' (' + missions.map(m => m.preset || 'custom').join(', ') + ')' : ''}`);
    out.push(`  leads: ${pipe}`);
  } catch { out.push('\nAGENT & PIPELINE: (unavailable)'); }

  return out.join('\n');
}
