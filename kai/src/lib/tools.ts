/* ────────────────────────────────────────────────────────────
   KAI tool-use surface. These are the real actions Claude can
   take when the streaming endpoint returns a tool_use block.
   ──────────────────────────────────────────────────────────── */

import { addReminder, cancelReminder, listReminders } from './reminders';
import { addJournal } from './journal';
import { focusTimer } from './focusTimer';
import { loadState, saveState } from './store';
import { briefing } from './commands';
import { toggleHabit } from './habits';
import { toast } from '../hooks/useToasts';
import {
  income, debt, garden, makadi, instagram,
  monthlyTotalEGP, debtClearedPct, operator,
} from '../kaiConfig';

export type ToolCall = { id: string; name: string; input: any };
export type ToolResult = { tool_use_id: string; content: string };

/* JSON Schemas Claude sees. Keep descriptions tight and unambiguous. */
export const TOOL_SCHEMAS = [
  {
    name: 'add_reminder',
    description: "Schedule a reminder that pings the user later. Use this whenever the user asks you to remind them of something in N minutes / hours.",
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'What to remind the user about.' },
        minutes: { type: 'number', description: 'How many minutes from now to fire the reminder. Convert hours to minutes if needed.' },
      },
      required: ['text', 'minutes'],
    },
  },
  {
    name: 'add_journal',
    description: 'Capture a quick note in the user’s journal. Use when the user asks you to "remember", "note", "log", or "journal" something.',
    input_schema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
  {
    name: 'add_priority',
    description: 'Add a priority/todo to the user’s priority list.',
    input_schema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
  {
    name: 'start_focus',
    description: 'Start a focus or break block. Defaults to 25 minutes of focus.',
    input_schema: {
      type: 'object',
      properties: {
        minutes: { type: 'number' },
        kind: { type: 'string', enum: ['focus', 'break'] },
      },
      required: ['minutes'],
    },
  },
  {
    name: 'apply_debt_payment',
    description: 'Apply a payment toward the credit-card debt — subtracts the amount from the current balance.',
    input_schema: {
      type: 'object',
      properties: { amount_egp: { type: 'number' } },
      required: ['amount_egp'],
    },
  },
  {
    name: 'get_state_snapshot',
    description: 'Read the user’s current state — income streams, debt, garden, makadi, instagram, priorities, journal preview. Use this whenever you need facts before answering.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_briefing',
    description: 'Generate the daily briefing narrative summary.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'complete_priority',
    description: 'Mark a priority as done by fuzzy text match against its label.',
    input_schema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Substring of the priority label to match.' } },
      required: ['text'],
    },
  },
  {
    name: 'cancel_reminder',
    description: 'Cancel a pending reminder by fuzzy text match against its label.',
    input_schema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
  {
    name: 'snooze_reminder',
    description: 'Push a pending reminder back by N minutes.',
    input_schema: {
      type: 'object',
      properties: { text: { type: 'string' }, minutes: { type: 'number' } },
      required: ['text', 'minutes'],
    },
  },
  {
    name: 'mark_habit',
    description: 'Tick a habit as done for today by fuzzy label match.',
    input_schema: {
      type: 'object',
      properties: { label: { type: 'string' } },
      required: ['label'],
    },
  },
];

export async function runTool(call: ToolCall): Promise<string> {
  switch (call.name) {
    case 'add_reminder': {
      const { text, minutes } = call.input || {};
      if (!text || typeof minutes !== 'number') return 'error: missing text or minutes';
      const at = new Date(Date.now() + minutes * 60_000).toISOString();
      const r = addReminder(text, at);
      toast.ok(`Reminder set: “${text}” in ${minutes}m`, 'KAI · TOOL', 3800);
      return JSON.stringify({ ok: true, id: r.id, at });
    }
    case 'add_journal': {
      const { text } = call.input || {};
      if (!text) return 'error: missing text';
      addJournal(text);
      toast.ok(`Journal: “${text.slice(0, 60)}”`, 'KAI · TOOL', 3000);
      return JSON.stringify({ ok: true });
    }
    case 'add_priority': {
      const { text } = call.input || {};
      if (!text) return 'error: missing text';
      const s = loadState();
      s.priorities = [{ id: 'p-' + Date.now(), text, done: false }, ...s.priorities];
      saveState(s);
      toast.ok(`Priority added: “${text}”`, 'KAI · TOOL', 3000);
      return JSON.stringify({ ok: true });
    }
    case 'start_focus': {
      const minutes = Math.max(1, Math.min(180, call.input?.minutes ?? 25));
      const kind = call.input?.kind === 'break' ? 'break' : 'focus';
      focusTimer.start(minutes, kind);
      return JSON.stringify({ ok: true, minutes, kind });
    }
    case 'apply_debt_payment': {
      const amt = Math.max(0, call.input?.amount_egp ?? 0);
      if (amt <= 0) return 'error: amount must be > 0';
      const s = loadState();
      s.debtCurrent = Math.max(0, s.debtCurrent - amt);
      saveState(s);
      toast.ok(`Debt -${amt.toLocaleString('en-GB')} EGP applied`, 'KAI · TOOL', 3000);
      return JSON.stringify({ ok: true, newBalance: s.debtCurrent });
    }
    case 'get_state_snapshot': {
      const s = loadState();
      const snap = {
        operator: { name: s.settings.operatorName, timezone: operator.timezone },
        income: income.map(i => ({ label: i.label, amount: i.amount, ccy: i.ccy, cadence: i.cadence })),
        income_total_monthly_egp: Math.round(monthlyTotalEGP()),
        debt: { original: debt.original, current: s.debtCurrent, percent_cleared: Math.round(debtClearedPct()) },
        garden: { plant_count: garden.plantCount, species: garden.speciesCount, tasks_today: garden.todayTasks, next_event: garden.nextEvent },
        makadi: { rate_egp: makadi.nightlyRate, occupancy_30d: makadi.occupancy30d, fix_lock_flag: makadi.fixLock },
        instagram: instagram.accounts.map(a => ({ handle: a.handle, followers: a.followers })),
        priorities_open: s.priorities.filter(p => !p.done).map(p => p.text),
        priorities_done: s.priorities.filter(p => p.done).map(p => p.text),
        journal_recent: s.journal.slice(0, 5).map(e => e.text),
        habits: s.habits.map(h => ({ label: h.label, history_count: h.history.length })),
        pending_reminders: s.reminders.filter(r => !r.fired).map(r => ({ at: r.at, text: r.text })),
      };
      return JSON.stringify(snap);
    }
    case 'get_briefing': {
      return briefing();
    }
    case 'complete_priority': {
      const needle = (call.input?.text || '').toLowerCase();
      if (!needle) return 'error: missing text';
      const s = loadState();
      const hit = s.priorities.find(p => !p.done && p.text.toLowerCase().includes(needle));
      if (!hit) return JSON.stringify({ ok: false, reason: 'no matching open priority' });
      s.priorities = s.priorities.map(p => p.id === hit.id ? { ...p, done: true } : p);
      saveState(s);
      toast.ok(`Completed: “${hit.text}”`, 'KAI · TOOL', 3000);
      return JSON.stringify({ ok: true, completed: hit.text });
    }
    case 'cancel_reminder': {
      const needle = (call.input?.text || '').toLowerCase();
      if (!needle) return 'error: missing text';
      const hit = listReminders().find(r => r.text.toLowerCase().includes(needle));
      if (!hit) return JSON.stringify({ ok: false, reason: 'no matching reminder' });
      cancelReminder(hit.id);
      toast.ok(`Cancelled: “${hit.text}”`, 'KAI · TOOL', 3000);
      return JSON.stringify({ ok: true, cancelled: hit.text });
    }
    case 'snooze_reminder': {
      const needle = (call.input?.text || '').toLowerCase();
      const minutes = Math.max(1, call.input?.minutes ?? 5);
      if (!needle) return 'error: missing text';
      const hit = listReminders().find(r => r.text.toLowerCase().includes(needle));
      if (!hit) return JSON.stringify({ ok: false, reason: 'no matching reminder' });
      cancelReminder(hit.id);
      const at = new Date(Date.now() + minutes * 60_000).toISOString();
      addReminder(hit.text, at);
      toast.ok(`Snoozed “${hit.text}” by ${minutes}m`, 'KAI · TOOL', 3000);
      return JSON.stringify({ ok: true, snoozed_until: at });
    }
    case 'mark_habit': {
      const needle = (call.input?.label || '').toLowerCase();
      if (!needle) return 'error: missing label';
      const s = loadState();
      const hit = s.habits.find(h => h.label.toLowerCase().includes(needle));
      if (!hit) return JSON.stringify({ ok: false, reason: 'no matching habit' });
      const today = new Date().toISOString().slice(0, 10);
      const already = hit.history.includes(today);
      if (!already) toggleHabit(hit.id);
      toast.ok(`Habit ticked: “${hit.label}”`, 'KAI · TOOL', 3000);
      return JSON.stringify({ ok: true, habit: hit.label, was_already_done: already });
    }
    default:
      return 'error: unknown tool';
  }
}
