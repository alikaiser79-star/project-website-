/* Built-in scripted commands. The command bar tries these first; if no
   match, it falls through to Claude (if an API key is set). */

import {
  income, debt, garden, makadi, instagram,
  monthlyTotalEGP, debtClearedPct, toEGP, currency, operator,
} from '../kaiConfig';
import { loadState } from './store';

function fmt(n: number) { return n.toLocaleString(operator.locale, { maximumFractionDigits: 0 }); }

export type CmdResult = string;

export function runBuiltin(cmd: string): CmdResult | null {
  const q = cmd.trim().toLowerCase();
  if (!q) return null;

  if (/^(status|status report|sitrep|summary)$/i.test(q)) {
    const s = loadState();
    const open = s.priorities.filter(p => !p.done).length;
    return [
      `Systems nominal, ${operator.name}.`,
      `Monthly throughput projecting ${fmt(monthlyTotalEGP())} ${currency.primary}.`,
      `Credit card at ${debtClearedPct().toFixed(0)}% cleared.`,
      `Hidden Garden plant count ${garden.plantCount}.`,
      `Makadi occupancy ${(makadi.occupancy30d*100).toFixed(0)}% — ${makadi.fixLock ? 'door lock still flagged.' : 'lock OK.'}`,
      `${open} open priorities for today.`,
    ].join(' ');
  }

  if (/\b(debt|credit|card|paydown|payoff)\b/.test(q)) {
    const cleared = debt.original - loadState().debtCurrent;
    return `Credit card paydown: ${fmt(cleared)} EGP cleared of ${fmt(debt.original)}. That is ${debtClearedPct().toFixed(1)}%. Minimum payment ${fmt(debt.minPayment)} EGP.`;
  }

  if (/\b(income|earnings|money|revenue)\b/.test(q)) {
    const total = monthlyTotalEGP();
    const lines = income.map(s => `${s.label}: ${fmt(s.amount)} ${s.ccy}${s.cadence === 'nightly' ? ' / night' : ''}`).join(' · ');
    return `Income streams — ${lines}. Projected monthly total: ${fmt(total)} EGP (≈${fmt(total / currency.egpPerEur)} EUR).`;
  }

  if (/\b(tasks?|priorit(y|ies)|todo|to.do)\b/.test(q)) {
    const ps = loadState().priorities;
    const open = ps.filter(p => !p.done).map(p => '• ' + p.text).join(' ');
    if (!open) return 'Priority list is clear. Take the afternoon.';
    return `Open priorities: ${open}`;
  }

  if (/\b(garden|hidden|plant|plants)\b/.test(q)) {
    return `Hidden Garden — ${garden.plantCount} plants across ${garden.speciesCount} species. Today: ${garden.todayTasks.join(', ')}. Next event: ${garden.nextEvent.title} on ${new Date(garden.nextEvent.when).toLocaleString(operator.locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}.`;
  }

  if (/\b(makadi|airbnb|guest|booking|lock)\b/.test(q)) {
    const next = new Date(makadi.nextBooking);
    return `Makadi nightly rate ${fmt(makadi.nightlyRate)} EGP. Occupancy ${(makadi.occupancy30d*100).toFixed(0)}% over 30 days. Next booking ${next.toLocaleDateString(operator.locale, { weekday: 'long', day: '2-digit', month: 'short' })}.${makadi.fixLock ? ' Reminder — door lock still flagged for repair.' : ''} Rating ${makadi.rating}.`;
  }

  if (/\b(instagram|insta|followers|social)\b/.test(q)) {
    const lines = instagram.accounts.map(a => `${a.handle}: ${fmt(a.followers)}`).join(' · ');
    return `Instagram — ${lines}.`;
  }

  if (/\b(time|clock|hour)\b/.test(q)) {
    return `It is ${new Date().toLocaleTimeString(operator.locale, { hour: 'numeric', minute: '2-digit' })} Cairo time.`;
  }

  if (/\b(hello|hi|hey|yo)\b/.test(q)) {
    const h = new Date().getHours();
    const g = h < 5 ? 'Burning the candle late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    return `${g}, ${operator.name}. KAI here. What's the move?`;
  }

  if (/\b(help|commands|what can you do)\b/.test(q)) {
    return `Try: status, debt, income, tasks, garden, makadi, instagram, time. Or just ask me anything — if my API key is wired, I'll think it through.`;
  }

  return null;
}
