/* ============================================================
   Brain Dump.

   Send a messy free-form transcript to Claude through the
   existing /api/claude proxy. Claude returns strict JSON
   sorting the dump into priorities / content_ideas /
   reminders / expenses / notes. We parse defensively, render
   an editable review screen, then commit into the existing
   stores (priorities, contentQueue, reminders, expenses,
   journal).

   No backend changes. No new key surfaces.
   ============================================================ */

import { claudeConfig } from '../kaiConfig';
import { loadState, saveState } from './store';
import { addReminder } from './reminders';
import { addJournal } from './journal';
import { addExpense } from './expenses';
import { addQueueItems, type PlannedItem } from './content';
import type { ContentAccount, ContentFormat } from '../types';

export type Sorted = {
  priorities: string[];
  content_ideas: string[];
  reminders: Array<{ text: string; when_iso: string; when_text?: string }>;
  expenses: Array<{ merchant: string; amount: number; currency?: string }>;
  notes: string[];
};

export function emptySorted(): Sorted {
  return { priorities: [], content_ideas: [], reminders: [], expenses: [], notes: [] };
}

export async function sortDump(text: string): Promise<Sorted> {
  if (!claudeConfig.enabled) throw new Error('NO_API_KEY');
  const clean = (text || '').trim();
  if (!clean) throw new Error('EMPTY');

  /* Anchor relative phrases ("tomorrow 9am", "in 2 hours") to the
     user's wall clock by passing the local now in the system
     prompt. Wall-clock ISO drops the Z and locks to the device. */
  const nowIso = new Date().toISOString();
  const localNow = new Date().toString();   // human-readable, includes TZ

  const system =
    `You are KAI's brain-dump sorter. The operator just dumped ` +
    `everything in his head — fast, messy, half-thoughts. Read ` +
    `the dump and split it into structured items. Be GENEROUS — ` +
    `capture everything; anything ambiguous or one-off goes into ` +
    `"notes". Better to over-capture than lose a thought.\n\n` +

    `CURRENT TIME\n` +
    `ISO (UTC): ${nowIso}\n` +
    `Local:     ${localNow}\n` +
    `Resolve every "in 2 hours" / "tomorrow 9am" / "next Friday" ` +
    `relative to this clock and emit an absolute ISO timestamp.\n\n` +

    `BUCKETS\n` +
    `· priorities    — concrete tasks/todos for the operator. Imperative voice. Strip "I need to ".\n` +
    `· content_ideas — Instagram reel / carousel / story concepts. Keep short, idea-shaped.\n` +
    `· reminders     — anything that should ping at a specific time. MUST include when_iso.\n` +
    `· expenses      — money spent. merchant + amount. amount is a number, no symbol.\n` +
    `· notes         — anything else worth keeping. Journal entries. One thought per item.\n\n` +

    `OUTPUT FORMAT — STRICT\n` +
    `Reply with ONLY a JSON object. No prose, no markdown fences. Schema:\n` +
    `{\n` +
    `  "priorities":    ["task 1", "task 2"],\n` +
    `  "content_ideas": ["idea 1"],\n` +
    `  "reminders":     [{ "text": "ping body", "when_iso": "YYYY-MM-DDTHH:MM:SS.000Z", "when_text": "original phrase" }],\n` +
    `  "expenses":      [{ "merchant": "Spinneys", "amount": 420, "currency": "EGP" }],\n` +
    `  "notes":         ["thought 1"]\n` +
    `}\n` +
    `Every key must appear, even if its array is empty. No extra keys. No commentary.`;

  const res = await fetch(claudeConfig.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: claudeConfig.model,
      max_tokens: 1400,
      system,
      messages: [{ role: 'user', content: clean }],
    }),
  });

  if (res.status === 503) throw new Error('NO_API_KEY');
  if (!res.ok) {
    const t = await res.text();
    throw new Error('API_ERROR: ' + res.status + ' ' + t.slice(0, 200));
  }

  const data = await res.json();
  let raw = '';
  for (const b of (data?.content || [])) {
    if (b?.type === 'text' && typeof b.text === 'string') raw += b.text;
  }
  return parseSorted(raw);
}

export function parseSorted(raw: string): Sorted {
  let s = String(raw || '').trim();
  if (!s) throw new Error('PARSE_EMPTY');
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('PARSE_NO_OBJECT');

  let obj: any;
  try { obj = JSON.parse(s.slice(start, end + 1)); }
  catch (e: any) { throw new Error('PARSE_JSON: ' + (e?.message || 'invalid')); }

  const strList = (v: any): string[] =>
    Array.isArray(v)
      ? v.map(x => String(x ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 30)
      : [];

  const reminders = Array.isArray(obj?.reminders)
    ? obj.reminders.map((r: any) => ({
        text: String(r?.text ?? '').replace(/\s+/g, ' ').trim(),
        when_iso: normIso(r?.when_iso),
        when_text: r?.when_text ? String(r.when_text).slice(0, 80) : undefined,
      })).filter((r: any) => r.text && r.when_iso).slice(0, 30)
    : [];

  const expenses = Array.isArray(obj?.expenses)
    ? obj.expenses.map((e: any) => ({
        merchant: String(e?.merchant ?? '').replace(/\s+/g, ' ').trim(),
        amount:   Number(e?.amount),
        currency: e?.currency ? String(e.currency).toUpperCase().slice(0, 4) : undefined,
      })).filter((e: any) => e.merchant && Number.isFinite(e.amount) && e.amount > 0).slice(0, 30)
    : [];

  return {
    priorities:    strList(obj?.priorities),
    content_ideas: strList(obj?.content_ideas),
    reminders,
    expenses,
    notes:         strList(obj?.notes),
  };
}

function normIso(v: any): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(+d)) return '';
  return d.toISOString();
}

/* ── Filing ──────────────────────────────────────────────
   Writes a (user-reviewed and possibly edited) Sorted into
   every matching store. Returns a per-bucket counter so the
   summary toast tells the truth. */

export type FiledCounts = {
  priorities: number;
  content_ideas: number;
  reminders: number;
  expenses: number;
  notes: number;
};

export function fileSorted(s: Sorted): FiledCounts {
  const counts: FiledCounts = {
    priorities: 0, content_ideas: 0, reminders: 0, expenses: 0, notes: 0,
  };

  /* Priorities — prepend, mark not-done, like the manual + UI. */
  if (s.priorities.length) {
    const state = loadState();
    const fresh = s.priorities.map((text, i) => ({
      id: 'p-' + Date.now() + '-' + i,
      text,
      done: false,
    }));
    state.priorities = [...fresh, ...state.priorities];
    saveState(state);
    counts.priorities = fresh.length;
  }

  /* Content ideas — funnel into the same queue store as Plan a
     week. We don't know the account / format for free-form ideas,
     so use sensible defaults: format 'reel', account 'ali'
     (operator's main brand). User can edit on the Queue panel. */
  if (s.content_ideas.length) {
    const planned: PlannedItem[] = s.content_ideas.map((idea, i) => ({
      slot: `Idea ${i + 1}`,
      account: 'ali' as ContentAccount,
      format: 'reel' as ContentFormat,
      hook: idea,
      shotlist: ['(define shots later)'],
      caption: idea,
      hashtags: [],
    }));
    const saved = addQueueItems(planned);
    counts.content_ideas = saved.length;
  }

  /* Reminders — schedule each one. */
  for (const r of s.reminders) {
    try {
      addReminder(r.text, r.when_iso);
      counts.reminders++;
    } catch { /* skip bad rows silently */ }
  }

  /* Expenses — log as today's date, EGP default, category 'other'. */
  for (const e of s.expenses) {
    try {
      addExpense({
        merchant: e.merchant,
        total: e.amount,
        currency: e.currency || 'EGP',
        date: new Date().toISOString().slice(0, 10),
        category: 'other',
      });
      counts.expenses++;
    } catch { /* skip bad rows */ }
  }

  /* Notes — one journal entry per note. */
  for (const n of s.notes) {
    try {
      addJournal(n);
      counts.notes++;
    } catch { /* skip */ }
  }

  return counts;
}

export function summarizeCounts(c: FiledCounts): string {
  const parts: string[] = [];
  if (c.priorities)    parts.push(`${c.priorities} priorit${c.priorities === 1 ? 'y' : 'ies'}`);
  if (c.content_ideas) parts.push(`${c.content_ideas} content idea${c.content_ideas === 1 ? '' : 's'}`);
  if (c.reminders)     parts.push(`${c.reminders} reminder${c.reminders === 1 ? '' : 's'}`);
  if (c.expenses)      parts.push(`${c.expenses} expense${c.expenses === 1 ? '' : 's'}`);
  if (c.notes)         parts.push(`${c.notes} note${c.notes === 1 ? '' : 's'}`);
  if (parts.length === 0) return 'Nothing to file.';
  return 'Caught ' + parts.join(', ') + ' — filed.';
}
