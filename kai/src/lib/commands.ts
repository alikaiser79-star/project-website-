/* Built-in scripted commands. The command bar tries these first; if no
   match, it falls through to Claude (when the server has a key). All
   factual values read from the live store via accessors. */

import {
  debt, debtUtilizationPct, currency, operator,
} from '../kaiConfig';
import { loadState } from './store';
import { focusTimer } from './focusTimer';
import { addJournal } from './journal';
import { addReminder, parseDuration } from './reminders';
import { trend } from './history';
import { getCalendarCached } from './calendar';
import { monthlyTotal, categoryBreakdown, currentMonthKey } from './expenses';
import { queueCount } from './content';
import { mirrorBriefing } from './kai/commitments';
import { computeRunway, costInDays, paydayCushion, runwayBriefing } from './kai/runway';
import { ledgerBriefing } from './kai/ledger';
import { escapeLine } from './kai/escape';
import { toEgp, monthlyIncomeEgp } from './kai/money';
import { waterBriefingLine } from './kai/garden';
import { parseDeadlineCommand, addDeadline, deadlineBriefing } from './kai/deadlines';
import { warChestBrief } from './kai/warchest';
import { weeklyDrifts } from './kai/patterns';
import { addWatch } from './kai/watches';
import { doctrineText } from './kai/doctrine';
import { emitAction } from './actions';

function fmt(n: number) { return n.toLocaleString(operator.locale, { maximumFractionDigits: 0 }); }

export type CmdResult = string;

export function runBuiltin(cmd: string): CmdResult | null {
  const q = cmd.trim().toLowerCase();
  if (!q) return null;

  if (/^(status|status report|sitrep|summary)$/i.test(q)) {
    const s = loadState();
    const open = s.priorities.filter(p => !p.done).length;
    return [
      `Systems nominal, ${s.settings.operatorName}.`,
      `Monthly income ${fmt(monthlyIncomeEgp(s.income))} ${currency.primary} (occupancy-aware).`,
      `Credit card ${fmt(s.debtCurrent)} of ${fmt(debt.limit)} EGP (${debtUtilizationPct(s.debtCurrent).toFixed(0)}% utilised).`,
      `Hidden Garden plant count ${s.garden.plantCount}.`,
      `Makadi occupancy ${(s.makadi.occupancy30d*100).toFixed(0)}% — ${s.makadi.fixLock ? 'door lock still flagged.' : 'lock OK.'}`,
      `${open} open priorities for today.`,
    ].join(' ');
  }

  if (/\b(debt|credit|card|paydown|payoff)\b/.test(q)) {
    const bal = loadState().debtCurrent;
    const available = Math.max(0, debt.limit - bal);
    return `Credit card: ${fmt(bal)} EGP of a ${fmt(debt.limit)} EGP limit — ${debtUtilizationPct(bal).toFixed(0)}% utilised, ${fmt(available)} EGP available. APR ${debt.apr}%.`;
  }

  /* Tollgate — "can I afford 1200", "spend 1200", "is 800 worth it".
     Prices a discretionary amount in days of freedom. Checked before
     the generic money branch so the number gets caught. */
  {
    const spendMatch = q.match(/\b(?:afford|spend|buy|drop|blow|worth)\b[^\d]*?([\d][\d,. ]*)\s*(?:k\b|egp|le|pounds?)?/i);
    if (spendMatch) {
      const raw = spendMatch[1].replace(/[, ]/g, '');
      let amt = parseFloat(raw);
      if (/\dk\b/i.test(q) || /\bk\b/.test(spendMatch[0])) amt *= 1000;
      if (Number.isFinite(amt) && amt > 0) {
        const d = costInDays(amt);
        const r = computeRunway();
        if (d === null) {
          return `Can't price that yet — no spending history to measure burn against. Log a few expenses first.`;
        }
        const after = r.runwayDays === null ? null : r.runwayDays - d;
        const tail = after === null ? '' :
          ` That drops your runway to ${Math.floor(after)} days.`;
        const verdict = d >= 3 ? ' Steep — sleep on it.' : d >= 1 ? ' Noticeable.' : ' Cheap in freedom terms.';
        return `${fmt(amt)} EGP is ${d.toFixed(1)} day${d >= 1.05 || d < 0.95 ? 's' : ''} of freedom.${tail}${verdict}`;
      }
    }
  }

  /* Tollgate — "runway", "how long can I survive", "days of freedom". */
  if (/\b(runway|survive|days of freedom|how long.*(broke|survive|last)|broke)\b/.test(q)) {
    const r = computeRunway();
    if (r.runwayDays === null) {
      return `No burn signal yet — log some expenses and set your liquid cash in the Tollgate panel, then I can tell you the runway.`;
    }
    const pc = paydayCushion();
    const cushion = pc
      ? pc.cushionDays >= 0
        ? ` You hit the next payday with ${Math.round(pc.cushionDays)} days to spare.`
        : ` You're ${Math.abs(Math.round(pc.cushionDays))} days short of the next payday — move something.`
      : '';
    return `Runway: ${Math.floor(r.runwayDays)} days of freedom. ${fmt(r.liquidCash)} EGP liquid against ${fmt(r.dailyBurn)} EGP/day burn.${cushion}`;
  }

  if (/\b(income|earnings|money|revenue)\b/.test(q)) {
    const s = loadState();
    const total = monthlyIncomeEgp(s.income);
    const lines = s.income.map(x => `${x.label}: ${fmt(x.amount)} ${x.ccy}${x.cadence === 'nightly' ? ' / night' : ''}`).join(' · ');
    return `Income streams — ${lines}. Monthly total (occupancy-aware, Makadi at booked nights): ${fmt(total)} EGP (≈${fmt(total / s.fxEgpPerEur)} EUR).`;
  }

  if (/\b(tasks?|priorit(y|ies)|todo|to.do)\b/.test(q)) {
    const ps = loadState().priorities;
    const open = ps.filter(p => !p.done).map(p => '• ' + p.text).join(' ');
    if (!open) return 'Priority list is clear. Take the afternoon.';
    return `Open priorities: ${open}`;
  }

  if (/\b(garden|hidden|plant|plants)\b/.test(q)) {
    const g = loadState().garden;
    const evDate = new Date(g.nextEvent.when);
    const evLabel = Number.isNaN(+evDate)
      ? '—'
      : evDate.toLocaleString(operator.locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `Hidden Garden — ${g.plantCount} plants across ${g.speciesCount} species. Today: ${g.todayTasks.length ? g.todayTasks.join(', ') : 'no tasks set'}. Next event: ${g.nextEvent.title || '—'} on ${evLabel}.`;
  }

  if (/\b(makadi|airbnb|guest|booking|lock)\b/.test(q)) {
    const m = loadState().makadi;
    const next = new Date(m.nextBooking);
    const nextLabel = Number.isNaN(+next)
      ? '—'
      : next.toLocaleDateString(operator.locale, { weekday: 'long', day: '2-digit', month: 'short' });
    const rCcy = m.rateCcy ?? 'USD';
    const rEgp = fmt(Math.round(toEgp(m.nightlyRate, rCcy)));
    const rateSpoken = rCcy === 'EGP' ? `${fmt(m.nightlyRate)} EGP` : `${fmt(m.nightlyRate)} ${rCcy}, about ${rEgp} EGP,`;
    return `Makadi nightly rate ${rateSpoken} after tax. Occupancy ${(m.occupancy30d*100).toFixed(0)}% over 30 days. Next booking ${nextLabel}.${m.fixLock ? ' Reminder — door lock still flagged for repair.' : ''} Rating ${m.rating}.`;
  }

  if (/\b(instagram|insta|followers|social)\b/.test(q)) {
    const ig = loadState().instagram;
    if (!ig.length) return 'No Instagram accounts configured.';
    const lines = ig.map(a => `${a.handle}: ${fmt(a.followers)}`).join(' · ');
    return `Instagram — ${lines}.`;
  }

  if (/\b(time|clock|hour)\b/.test(q)) {
    return `It is ${new Date().toLocaleTimeString(operator.locale, { hour: 'numeric', minute: '2-digit' })} Cairo time.`;
  }

  if (/\b(hello|hi|hey|yo)\b/.test(q)) {
    const h = new Date().getHours();
    const g = h < 5 ? 'Burning the candle late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    return `${g}, ${loadState().settings.operatorName}. KAI here. What's the move?`;
  }

  /* Calendar of War — "deadline: <date> <text>" seeds a hard date. */
  {
    const dl = parseDeadlineCommand(cmd);
    if (dl) {
      addDeadline(dl.text, dl.date);
      const when = new Date(dl.date).toLocaleDateString(operator.locale, { weekday: 'short', day: '2-digit', month: 'short' });
      return `Deadline set — ${dl.text}, ${when}. The sentinel is watching.`;
    }
  }

  /* Das Radar (§19) — "watch <name> for <what>, weekly" adds a custom
     watch to the sweep. Cadence optional (defaults weekly). */
  {
    const wm = cmd.match(/^watch\s+(.+?)\s+for\s+(.+?)(?:[,;]?\s*(daily|weekly|monthly))?\s*$/i);
    if (wm) {
      const name = wm[1].trim();
      const what = wm[2].trim();
      const cadence = (wm[3]?.toLowerCase() as 'daily' | 'weekly' | 'monthly') || 'weekly';
      const w = addWatch({ name, query: `${name}: ${what}`, extractRule: what, cadence, domain: 'custom' });
      return `Watching “${w.name}” — ${cadence}. It joins the next sweep; findings land on the Radar.`;
    }
  }

  /* The Doctrine — KAI states its constitution (who it is, the five laws). */
  if (/^doctrine$|^constitution$|^who are you$|^what are you$|^دستور$|^عقيدة$/.test(q)) {
    return doctrineText();
  }

  /* The Morning Plan — today's 3 moves + one ruling, from the whole Spine. */
  if (/^plan$|^today$|^my plan$|^the plan$/.test(q)) {
    emitAction({ type: 'open-plan' });
    return 'Reading the Spine — today\'s plan is coming up.';
  }

  /* The Weekly Reckoning — the Sunday accounting, summonable any day. */
  if (/^reckon$|^reckoning$|^the reckoning$|^weekly reckoning$/.test(q)) {
    emitAction({ type: 'open-reckon' });
    return 'Closing the books on the week…';
  }

  /* DER ZWILLING — the Twin: the behavioral model + drift. Bare command
     opens the read; "counsel <decision>" runs a ruling on that decision. */
  if (/^twin$|^zwilling$|^der zwilling$|^the twin$|^زوجي$|^التوأم$|^counsel$|^counsel .+/i.test(q)) {
    const decision = cmd.trim().replace(/^\s*counsel\s+/i, '').trim();
    emitAction({ type: 'open-twin', question: /^counsel\s+/i.test(cmd.trim()) && decision ? decision : undefined });
    return 'Der Zwilling — reading your record.';
  }

  /* DER JÄGER — the Hunter: the ranked opportunity ledger, money attached. */
  if (/^hunt$|^hunter$|^jäger$|^jager$|^der jäger$|^الصياد$|^opportunities$/i.test(q)) {
    emitAction({ type: 'open-hunter' });
    return 'Der Jäger — hunting revenue moves.';
  }

  /* DER BOTSCHAFTER — the Ambassador lives in Settings; summon it here. */
  if (/^ambassador$|^botschafter$|^der botschafter$|^makadi ambassador$/i.test(q)) {
    emitAction({ type: 'open-settings', section: 'Makadi Ambassador' });
    return 'Opening the Makadi Ambassador.';
  }

  if (/^briefing$|^brief$|^morning\b|^daily\b/.test(q)) {
    return briefing();
  }

  if (/^weekly$|^review$|^week\b/.test(q)) {
    return weeklyReview();
  }

  /* Reminders: "remind me in 30 minutes to call Mira" */
  const remM = cmd.match(/^(?:remind me|reminder)\s+(?:in\s+)?(.+?)\s+(?:to|that|about)\s+(.+)$/i);
  if (remM) {
    const ms = parseDuration(remM[1]);
    if (ms) {
      const at = new Date(Date.now() + ms).toISOString();
      addReminder(remM[2], at);
      const minutes = Math.round(ms / 60_000);
      return `Reminder set for ${minutes} minute${minutes === 1 ? '' : 's'} from now — ${remM[2]}.`;
    }
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
      const rate = loadState().fxEgpPerEur;
      if (/\beur\b/.test(q) || /\beuros?\b/.test(q)) {
        return `${fmt(amount)} EUR is ${fmt(amount * rate)} EGP at ${rate.toFixed(2)}.`;
      }
      return `${fmt(amount)} EGP is approximately ${fmt(amount / rate)} EUR at ${rate.toFixed(2)}.`;
    }
  }

  if (/\b(help|commands|what can you do)\b/.test(q)) {
    return `Try: status, briefing, weekly, debt, income, tasks, garden, makadi, instagram, time, focus 25, break, convert 1000 eur. Or just ask me anything.`;
  }

  return null;
}

/* Action-oriented briefing — names the top 2-3 things to do today.
   Kept under 6 lines. Reads live state, debt, income, priorities,
   garden tasks, Makadi flags, habits, and real trend deltas. */
export function briefing(): string {
  const s = loadState();
  const h = new Date().getHours();
  const greet = h < 5 ? "You're up late" : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const name = s.settings?.operatorName || 'commander';
  const total = monthlyIncomeEgp(s.income);
  const util = debtUtilizationPct(s.debtCurrent);

  /* Candidate actions, weighted. Higher weight = more important. */
  type Cand = { weight: number; text: string };
  const candidates: Cand[] = [];

  /* Real Google Calendar events — highest priority when imminent. */
  try {
    const cal = getCalendarCached();
    if (cal.ok && Array.isArray(cal.events)) {
      const evs = cal.events.slice(0, 3);
      for (const ev of evs) {
        const d = new Date(ev.start);
        if (Number.isNaN(+d)) continue;
        const days = Math.ceil((+d - Date.now()) / 86_400_000);
        if (days < 0 || days > 7) continue;
        const when = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days}d`;
        const weight = days <= 0 ? 15 : days === 1 ? 14 : days === 2 ? 12 : 10 - days;
        candidates.push({ weight, text: `${ev.title} ${when}` });
      }
    }
  } catch { /* defensive */ }

  /* Imminent garden event takes top weight when ≤2 days away. */
  const ev = new Date(s.garden?.nextEvent?.when ?? 0);
  if (!Number.isNaN(+ev)) {
    const days = Math.ceil((+ev - Date.now()) / 86_400_000);
    if (days >= 0 && days <= 2) {
      candidates.push({
        weight: 14,
        text: `Prep for ${s.garden?.nextEvent?.title || 'garden event'} — ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `${days}d`}`,
      });
    }
  }

  /* Fix-lock is high-priority operational drag. */
  if (s.makadi?.fixLock) {
    candidates.push({ weight: 13, text: 'Book the Makadi locksmith — still flagged' });
  }

  /* Open priorities — earlier ones weighted higher. */
  (s.priorities ?? []).filter(p => !p.done).forEach((p, i) => {
    candidates.push({ weight: 11 - Math.min(i, 5), text: p.text });
  });

  /* Garden tasks for today (a notch below explicit priorities). */
  (s.garden?.todayTasks ?? []).forEach(t => {
    candidates.push({ weight: 6, text: t });
  });

  /* Content queue nudge — surface unshot items as a single action.
     One slot only so it doesn't crowd out priorities / events. */
  try {
    const qc = queueCount();
    if (qc.idea > 0) {
      candidates.push({
        weight: 7,
        text: `Shoot ${qc.idea} planned ${qc.idea === 1 ? 'item' : 'items'} from the content queue`,
      });
    }
  } catch { /* defensive */ }

  /* Pick the top 3 distinct actions. Dedupe on text. */
  candidates.sort((a, b) => b.weight - a.weight);
  const seen = new Set<string>();
  const top = candidates.filter(c => {
    const k = c.text.toLowerCase().trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 3);

  /* Trend tail — only included when we have real data. */
  const debtTrend = trend('debt', 14);
  let tail = '';
  if (debtTrend && debtTrend.delta < -500) {
    tail = ` Debt down ${Math.abs(Math.round(debtTrend.delta)).toLocaleString('en-GB')} EGP over ${debtTrend.samples}d — momentum holding.`;
  } else if (debtTrend && debtTrend.delta > 500) {
    tail = ` Debt up ${Math.round(debtTrend.delta).toLocaleString('en-GB')} EGP over ${debtTrend.samples}d — watch it.`;
  }

  /* Monthly spend — surface when there's anything logged this month. */
  let spendLine = '';
  try {
    const spent = monthlyTotal(currentMonthKey());
    if (spent > 0) {
      const top = categoryBreakdown(currentMonthKey())[0];
      const topPart = top ? ` Top category ${top.category}.` : '';
      spendLine = ` Spent ${fmt(spent)} EGP this month so far.${topPart}`;
    }
  } catch { /* defensive */ }

  const lines: string[] = [];
  lines.push(`${greet}, ${name}. Card ${util.toFixed(0)}% utilised (${fmt(s.debtCurrent)} of ${fmt(debt.limit)} EGP). ~${fmt(total)} EGP projecting this month.${tail}${spendLine}`);
  /* Calendar of War — hard dates dominate the briefing as they near. */
  try { for (const m of deadlineBriefing()) lines.push(m); } catch { /* defensive */ }
  if (top.length === 0) {
    lines.push(`Priority list clear and no garden tasks queued. Take the morning.`);
  } else {
    top.forEach((c, i) => lines.push(`${i + 1}. ${c.text}.`));
  }

  /* War Chest — one nag for freed cashflow still unallocated (§9.4). */
  try {
    const wc = warChestBrief();
    if (wc) lines.push(wc);
  } catch { /* defensive */ }

  /* Proactive KAI (§13.3b) — pattern drifts vs the trailing 8 weeks. */
  try {
    for (const d of weeklyDrifts()) lines.push(d);
  } catch { /* defensive */ }

  /* Der Gärtner — today's watering plan (§10.3). Quiet when no plant
     has a schedule yet. */
  try {
    const w = waterBriefingLine();
    if (w) lines.push(w);
  } catch { /* defensive */ }

  /* Tollgate — runway + payday cushion. Quiet when no burn signal. */
  try {
    for (const m of runwayBriefing()) lines.push(m);
  } catch { /* defensive */ }

  /* Mirror lines — overdue / countdown / recently broken / score.
     Quiet when there's nothing to say. */
  try {
    for (const m of mirrorBriefing()) lines.push(m);
  } catch { /* defensive */ }

  /* Ledger lines — flakes you're about to lean on + overdue
     promises owed to you. Quiet by default. */
  try {
    for (const m of ledgerBriefing()) lines.push(m);
  } catch { /* defensive */ }

  /* Escape Velocity — THE number, in every briefing. */
  try { lines.push(escapeLine()); } catch { /* defensive */ }

  lines.push(`What's the first move?`);
  /* Hard cap — Tollgate + Mirror + Ledger all feed in now. */
  return lines.slice(0, 12).join('\n');
}

/* A narrative recap of the last 7 days from the data we have locally. */
export function weeklyReview(): string {
  const s = loadState();
  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const journalCount = s.journal.filter(e => +new Date(e.at) >= sevenDaysAgo).length;
  const closedThisWeek = s.priorities.filter(p => p.done).length;
  const openCount = s.priorities.filter(p => !p.done).length;

  const habitLines: string[] = [];
  for (const h of s.habits) {
    const checked = h.history.filter(d => +new Date(d + 'T00:00:00') >= sevenDaysAgo).length;
    if (checked > 0) habitLines.push(`${h.label} ${checked} of 7`);
  }

  const out: string[] = [];
  out.push(`Weekly review, ${s.settings.operatorName}.`);
  out.push(`${journalCount} journal ${journalCount === 1 ? 'entry' : 'entries'} captured.`);
  out.push(closedThisWeek
    ? `Closed ${closedThisWeek} priorit${closedThisWeek === 1 ? 'y' : 'ies'}; ${openCount} still open.`
    : `Zero priorities closed; ${openCount} open.`);
  if (habitLines.length) out.push(`Habit hits — ${habitLines.join('; ')}.`);
  else out.push(`No habits ticked this week.`);
  out.push(`Credit card sits at ${fmt(s.debtCurrent)} EGP, ${debtUtilizationPct(s.debtCurrent).toFixed(0)} percent utilised of ${fmt(debt.limit)}.`);
  if (s.makadi.fixLock) out.push(`Makadi lock still flagged — that's been carried for a while.`);
  out.push(`What's the focus for next week?`);
  return out.join(' ');
}
