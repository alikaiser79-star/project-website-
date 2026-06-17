/* ────────────────────────────────────────────────────────────
   KAI tool-use surface. These are the real actions Claude can
   take when the streaming endpoint returns a tool_use block.
   ──────────────────────────────────────────────────────────── */

import { addReminder, cancelReminder, listReminders } from './reminders';
import { addJournal } from './journal';
import { focusTimer } from './focusTimer';
import {
  loadState, saveState,
  updateGarden, updateMakadi, upsertInstagram, removeInstagram, setFx,
} from './store';
import { briefing, weeklyReview } from './commands';
import { getSnapshots, trend, coverage } from './history';
import { toggleHabit } from './habits';
import { updateGoal as updateGoalFn, goalCurrent, goalPct } from './goals';
import { toast } from '../hooks/useToasts';
import {
  debt, monthlyTotalEGP, debtClearedPct, operator,
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
    description: 'Read the user’s current LIVE state — income streams, debt, garden, makadi, instagram, priorities, journal preview, FX rate. Use this whenever you need facts before answering.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_briefing',
    description: 'Generate the daily briefing narrative summary.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_weekly_review',
    description: 'Generate a 7-day recap of journal entries, priorities closed, habit hits, debt progress.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_trends',
    description: 'Read the recent N-day history of debt, income projection, habits-per-day, priorities-open, journal count, and per-handle IG followers. Only returns REAL captured days — if `coverage_days` is < 2, do NOT claim any trend direction.',
    input_schema: {
      type: 'object',
      properties: { days: { type: 'number', description: 'How many days back. Default 14.' } },
    },
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
  /* ── New in v1.13: write tools for the previously-static surfaces ── */
  {
    name: 'update_garden',
    description: "Update Hidden Garden state. Provide only the fields the user changed; others stay as-is. tasks_today replaces the whole list when given.",
    input_schema: {
      type: 'object',
      properties: {
        plant_count:       { type: 'number' },
        species_count:     { type: 'number' },
        tasks_today:       { type: 'array', items: { type: 'string' } },
        next_event_title:  { type: 'string' },
        next_event_when:   { type: 'string', description: 'ISO timestamp for the event start.' },
      },
    },
  },
  {
    name: 'update_makadi',
    description: 'Update Makadi Airbnb state. Provide only the fields the user changed.',
    input_schema: {
      type: 'object',
      properties: {
        nightly_rate_egp: { type: 'number' },
        occupancy_30d:    { type: 'number', description: 'Fraction 0..1.' },
        next_booking:     { type: 'string', description: 'ISO timestamp.' },
        fix_lock:         { type: 'boolean' },
        rating:           { type: 'number' },
      },
    },
  },
  {
    name: 'update_instagram',
    description: "Set the follower count for an Instagram handle. Adds the handle if it doesn't exist. Use `remove: true` to delete a handle entirely.",
    input_schema: {
      type: 'object',
      properties: {
        handle:    { type: 'string', description: 'e.g. @hiddengarden.eg' },
        followers: { type: 'number' },
        remove:    { type: 'boolean' },
      },
      required: ['handle'],
    },
  },
  {
    name: 'set_fx_rate',
    description: 'Update the EGP-per-EUR exchange rate used everywhere KAI converts between currencies.',
    input_schema: {
      type: 'object',
      properties: { egp_per_eur: { type: 'number' } },
      required: ['egp_per_eur'],
    },
  },
  {
    name: 'update_goal',
    description: "Edit a long-term goal — label, target, current, or unit. Pass only the fields the user changed. When a goal has a `liveSource`, its current value is derived from live data and `current` is ignored.",
    input_schema: {
      type: 'object',
      properties: {
        id:      { type: 'string', description: 'Goal id, e.g. g-debt, g-savings, g-plants, g-ig.' },
        label:   { type: 'string' },
        target:  { type: 'number' },
        current: { type: 'number' },
        unit:    { type: 'string' },
      },
      required: ['id'],
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
        fx_egp_per_eur: s.fxEgpPerEur,
        income: s.income.map(i => ({ label: i.label, amount: i.amount, ccy: i.ccy, cadence: i.cadence })),
        income_total_monthly_egp: Math.round(monthlyTotalEGP(s.income, s.fxEgpPerEur)),
        debt: { original: debt.original, current: s.debtCurrent, percent_cleared: Math.round(debtClearedPct()) },
        garden: {
          plant_count: s.garden.plantCount,
          species: s.garden.speciesCount,
          tasks_today: s.garden.todayTasks,
          next_event: s.garden.nextEvent,
        },
        makadi: {
          rate_egp: s.makadi.nightlyRate,
          occupancy_30d: s.makadi.occupancy30d,
          next_booking: s.makadi.nextBooking,
          fix_lock_flag: s.makadi.fixLock,
          rating: s.makadi.rating,
        },
        instagram: s.instagram.map(a => ({ handle: a.handle, followers: a.followers })),
        priorities_open: s.priorities.filter(p => !p.done).map(p => p.text),
        priorities_done: s.priorities.filter(p => p.done).map(p => p.text),
        journal_recent: s.journal.slice(0, 5).map(e => e.text),
        habits: s.habits.map(h => ({ label: h.label, history_count: h.history.length })),
        pending_reminders: s.reminders.filter(r => !r.fired).map(r => ({ at: r.at, text: r.text })),
        goals: s.goals.map(g => ({
          id: g.id, label: g.label, target: g.target, unit: g.unit,
          current: goalCurrent(g), percent: Math.round(goalPct(g)),
          live_source: g.liveSource ?? null,
        })),
      };
      return JSON.stringify(snap);
    }
    case 'get_briefing': {
      return briefing();
    }
    case 'get_weekly_review': {
      return weeklyReview();
    }
    case 'get_trends': {
      const days = Math.max(2, Math.min(180, call.input?.days ?? 14));
      const snaps = getSnapshots(days);
      const cov = coverage();
      const igHandles = new Set<string>();
      for (const s of snaps) if (s.igByHandle) for (const h of Object.keys(s.igByHandle)) igHandles.add(h);
      const ig_by_handle: Record<string, number[]> = {};
      for (const h of igHandles) {
        ig_by_handle[h] = snaps
          .map(s => s.igByHandle?.[h])
          .filter((n): n is number => typeof n === 'number');
      }
      return JSON.stringify({
        days_requested: days,
        coverage_days: cov,
        captured_days_in_window: snaps.length,
        captured_dates: snaps.map(s => s.d),
        note: cov < 2
          ? 'Fewer than 2 daily captures so far. Do not state any trend direction as fact.'
          : 'Real captured data — no synthesis.',
        debt:                 { series: snaps.map(s => s.debt),           trend: trend('debt', days) },
        income_monthly_egp:   { series: snaps.map(s => s.incomeMonthly),  trend: trend('incomeMonthly', days) },
        priorities_open:      { series: snaps.map(s => s.prioritiesOpen) },
        habits_today:         { series: snaps.map(s => s.habitsToday) },
        journal_count:        { series: snaps.map(s => s.journalCount) },
        ig_followers_total:   { series: snaps.map(s => s.igFollowers) },
        ig_by_handle,
      });
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

    /* ── New in v1.13: write tools for the previously-static surfaces ── */
    case 'update_garden': {
      const i = call.input || {};
      const patch: any = {};
      if (typeof i.plant_count   === 'number')  patch.plantCount   = i.plant_count;
      if (typeof i.species_count === 'number')  patch.speciesCount = i.species_count;
      if (Array.isArray(i.tasks_today))         patch.todayTasks   = i.tasks_today.map(String);
      if (typeof i.next_event_title === 'string' || typeof i.next_event_when === 'string') {
        const cur = loadState().garden.nextEvent;
        patch.nextEvent = {
          title: typeof i.next_event_title === 'string' ? i.next_event_title : cur.title,
          when:  typeof i.next_event_when  === 'string' ? i.next_event_when  : cur.when,
        };
      }
      if (Object.keys(patch).length === 0) return JSON.stringify({ ok: false, reason: 'no fields provided' });
      updateGarden(patch);
      toast.ok('Garden updated.', 'KAI · TOOL', 3000);
      return JSON.stringify({ ok: true, garden: loadState().garden });
    }
    case 'update_makadi': {
      const i = call.input || {};
      const patch: any = {};
      if (typeof i.nightly_rate_egp === 'number')  patch.nightlyRate  = i.nightly_rate_egp;
      if (typeof i.occupancy_30d    === 'number')  patch.occupancy30d = Math.max(0, Math.min(1, i.occupancy_30d));
      if (typeof i.next_booking     === 'string')  patch.nextBooking  = i.next_booking;
      if (typeof i.fix_lock         === 'boolean') patch.fixLock      = i.fix_lock;
      if (typeof i.rating           === 'number')  patch.rating       = Math.max(0, Math.min(5, i.rating));
      if (Object.keys(patch).length === 0) return JSON.stringify({ ok: false, reason: 'no fields provided' });
      updateMakadi(patch);
      toast.ok('Makadi updated.', 'KAI · TOOL', 3000);
      return JSON.stringify({ ok: true, makadi: loadState().makadi });
    }
    case 'update_instagram': {
      const handle = String(call.input?.handle || '').trim();
      if (!handle) return JSON.stringify({ ok: false, reason: 'missing handle' });
      if (call.input?.remove === true) {
        removeInstagram(handle);
        toast.ok(`IG removed: ${handle}`, 'KAI · TOOL', 3000);
        return JSON.stringify({ ok: true, removed: handle });
      }
      const followers = Number(call.input?.followers);
      if (!Number.isFinite(followers) || followers < 0) {
        return JSON.stringify({ ok: false, reason: 'followers must be a non-negative number' });
      }
      upsertInstagram(handle, Math.round(followers));
      const display = handle.startsWith('@') ? handle : '@' + handle;
      toast.ok(`IG ${display} · ${followers.toLocaleString('en-GB')}`, 'KAI · TOOL', 3000);
      return JSON.stringify({ ok: true, instagram: loadState().instagram });
    }
    case 'set_fx_rate': {
      const rate = Number(call.input?.egp_per_eur);
      if (!Number.isFinite(rate) || rate <= 0) {
        return JSON.stringify({ ok: false, reason: 'rate must be a positive number' });
      }
      setFx(rate);
      toast.ok(`FX rate: 1 EUR = ${rate.toFixed(2)} EGP`, 'KAI · TOOL', 3000);
      return JSON.stringify({ ok: true, fx_egp_per_eur: rate });
    }
    case 'update_goal': {
      const id = String(call.input?.id || '');
      if (!id) return JSON.stringify({ ok: false, reason: 'missing id' });
      const patch: any = {};
      if (typeof call.input?.label   === 'string') patch.label   = call.input.label;
      if (typeof call.input?.target  === 'number') patch.target  = call.input.target;
      if (typeof call.input?.current === 'number') patch.current = call.input.current;
      if (typeof call.input?.unit    === 'string') patch.unit    = call.input.unit;
      if (Object.keys(patch).length === 0) return JSON.stringify({ ok: false, reason: 'no fields provided' });
      const existing = loadState().goals.find(g => g.id === id);
      if (!existing) return JSON.stringify({ ok: false, reason: 'unknown goal id' });
      updateGoalFn(id, patch);
      toast.ok(`Goal updated: ${existing.label}`, 'KAI · TOOL', 3000);
      return JSON.stringify({ ok: true, goal: loadState().goals.find(g => g.id === id) });
    }
    default:
      return 'error: unknown tool';
  }
}
