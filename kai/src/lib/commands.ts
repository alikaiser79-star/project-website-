/* Built-in scripted commands. The command bar tries these first; if no
   match, it falls through to Claude (if an API key is set). */

import {
  income, debt, garden, makadi, instagram,
  monthlyTotalEGP, debtClearedPct, toEGP, currency, operator,
} from '../kaiConfig';
import { loadState } from './store';
import { focusTimer } from './focusTimer';
import { addJournal } from './journal';

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

  if (/^briefing$|^brief$|^morning\b|^daily\b/.test(q)) {
    return briefing();
  }

  /* Journal capture: "note that …", "journal …", "log …", "remember …" */
  const noteM = cmd.match(/^(?:note(?:[,: ] that)?|remember(?: that)?|log|journal)[,: ]+(.+)$/i);
  if (noteM) {
    addJournal(noteM[1].trim());
    return 'Noted in the journal.';
  }

  // focus timer voice/text controls
  if (/\b(focus|deep work|start (a )?timer|pomodoro)\b/.test(q)) {
    const m = q.match(/(\d{1,3})\s*(?:min|mins|minute|m)?/);
    const mins = m ? Math.max(1, Math.min(180, parseInt(m[1]))) : 25;
    focusTimer.start(mins, 'focus');
    return `Focus block started — ${mins} minutes. Heads down.`;
  }
  if (/\b(break|rest)\b/.test(q) && /\b(start|begin|take)\b/.test(q)) {
    focusTimer.start(5, 'break');
    return 'Break started — five minutes.';
  }
  if (/\b(stop|cancel|kill)\b/.test(q) && /\b(timer|focus|pomodoro)\b/.test(q)) {
    focusTimer.stop();
    return 'Focus block stopped.';
  }

  if (/\b(convert|in (eur|euros?))\b/.test(q)) {
    const amount = parseFloat((q.match(/(\d[\d,.]*)/) || [])[1]?.replace(/,/g, '') || '');
    if (amount) {
      if (/\beur\b/.test(q) || /\beuros?\b/.test(q)) {
        return `${fmt(amount)} EUR is ${fmt(amount * currency.egpPerEur)} EGP.`;
      }
      return `${fmt(amount)} EGP is approximately ${fmt(amount / currency.egpPerEur)} EUR.`;
    }
  }

  if (/\b(help|commands|what can you do)\b/.test(q)) {
    return `Try: status, briefing, debt, income, tasks, garden, makadi, instagram, time, focus 25, break, convert 1000 eur. Or just ask me anything — if my API key is wired, I'll think it through.`;
  }

  return null;
}

export function briefing(): string {
  const s = loadState();
  const open = s.priorities.filter(p => !p.done);
  const total = monthlyTotalEGP();
  const cleared = debtClearedPct();
  const lines: string[] = [];
  const h = new Date().getHours();
  const time = h < 5 ? "You're up late" : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';

  lines.push(`${time}, ${operator.name}. Daily briefing.`);
  lines.push(`Throughput projecting ${fmt(total)} EGP this month, roughly ${fmt(total / currency.egpPerEur)} euros.`);
  lines.push(`Credit card paydown at ${cleared.toFixed(0)} percent.`);

  if (open.length) lines.push(`${open.length} open priorit${open.length === 1 ? 'y' : 'ies'}: ${open.slice(0, 3).map(p => p.text).join('; ')}${open.length > 3 ? '; and more' : ''}.`);
  else lines.push(`Priority list clear.`);

  lines.push(`Hidden Garden — ${garden.todayTasks.length} task${garden.todayTasks.length === 1 ? '' : 's'} for today.`);
  if (makadi.fixLock) lines.push(`Reminder — Makadi door lock still needs the locksmith.`);

  const ev = new Date(garden.nextEvent.when);
  const days = Math.max(0, Math.ceil((+ev - Date.now()) / 86_400_000));
  lines.push(`Next event: ${garden.nextEvent.title} in ${days} day${days === 1 ? '' : 's'}.`);

  lines.push(`That's the picture. What's the move?`);
  return lines.join(' ');
}
