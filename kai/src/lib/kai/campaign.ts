/* ============================================================
   DER FELDZUG (§18) — the campaign module. A disciplined outreach
   engine for Von Kaiser Farms / Hidden Garden against a fixed set of
   TARGETS (schools, clubs, cultural centres). Four moving parts:

     TARGETS      a store of who we're courting — contact, language,
                  the offer, pipeline status, last touch, notes.
     DRAFT ENGINE draftOutreach(target) → Claude writes a personalised
                  email in the TARGET'S language from the Kaiser story
                  templates. It does NOT send.
     THE GATE     every draft becomes proposeAction('email_send') — it
                  waits at the ConfirmationGate for Ali's tap. Nothing
                  leaves the device autonomously.
     PIPELINE     scouted → contacted → replied → won / dead (the panel).

   Pulse integration: stale targets (contacted, no reply, going cold)
   surface via staleTargets() for the morning dispatch and the panel.
   ============================================================ */

import { read, write, emit } from './store';
import { logEvent } from './events';
import { proposeAction } from './pending';
import { askClaude } from '../claude';

const KEY = 'kai.targets';
const SEED_FLAG = 'kai.targets.seeded.v1';
const DAY = 86_400_000;

export type TargetLang = 'de' | 'en' | 'ru' | 'ar';
export type TargetStatus = 'scouted' | 'contacted' | 'replied' | 'won' | 'dead';
export const TARGET_STATUSES: TargetStatus[] = ['scouted', 'contacted', 'replied', 'won', 'dead'];

export interface Target {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  lang: TargetLang;
  offer?: string;          // what we're proposing to them
  status: TargetStatus;
  lastTouch?: number;      // ms — last time we drafted/sent to them
  notes?: string;
  lastDraft?: { subject: string; body: string; at: number };   // last generated draft (kept even when unsent)
}

export function listTargets(): Target[] { return read<Target[]>(KEY, []); }
function writeAll(list: Target[]) { write(KEY, list); emit(); }

export function addTarget(input: Partial<Target> & { name: string }): Target {
  const t: Target = {
    id: 't-' + Math.random().toString(36).slice(2, 9),
    name: input.name,
    contactName: input.contactName,
    email: input.email,
    lang: input.lang || 'en',
    offer: input.offer,
    status: input.status || 'scouted',
    notes: input.notes,
  };
  writeAll([...listTargets(), t]);
  try { logEvent({ domain: 'campaign', type: 'target_added', meta: { id: t.id, name: t.name, lang: t.lang }, source: 'user' }); } catch { /* ignore */ }
  return t;
}
export function updateTarget(id: string, patch: Partial<Target>): void {
  writeAll(listTargets().map((t) => (t.id === id ? { ...t, ...patch } : t)));
}
export function setTargetStatus(id: string, status: TargetStatus): void {
  updateTarget(id, { status });
  try { logEvent({ domain: 'campaign', type: 'status_changed', meta: { id, status }, source: 'user' }); } catch { /* ignore */ }
}
export function removeTarget(id: string): void { writeAll(listTargets().filter((t) => t.id !== id)); }

/* Targets that have gone cold: contacted but no reply for > 5 days. */
export function staleTargets(now = Date.now()): Target[] {
  return listTargets().filter((t) => t.status === 'contacted' && (!t.lastTouch || now - t.lastTouch > 5 * DAY));
}

/* ── the DRAFT ENGINE ──────────────────────────────────────
   Writes a personalised outreach email in the target's language from
   the Kaiser story templates, then queues it at the Gate. Returns a
   short status for the caller (panel / command bar). */

const LANG_NAME: Record<TargetLang, string> = { de: 'German', en: 'English', ru: 'Russian', ar: 'Arabic' };

const STORY =
  'THE KAISER STORY (source material — weave in, do not dump):\n' +
  '- Von Kaiser Farms / the Hidden Garden: a family-run garden and event space in Cairo (Maadi), ' +
  'grown by Ali Kaiser — calm, green, off the noise of the city.\n' +
  '- What we offer partners: fresh produce, a venue for community days / markets / school trips / ' +
  'cultural events, and a genuine local partner who shows up and follows through.\n' +
  '- Voice: warm but direct, no corporate fluff, no over-promising. Short paragraphs. One clear ask.';

export interface DraftResult { ok: boolean; reason?: string; subject?: string; noRecipient?: boolean; }

export async function draftOutreach(targetId: string): Promise<DraftResult> {
  const t = listTargets().find((x) => x.id === targetId);
  if (!t) return { ok: false, reason: 'not_found' };

  const prompt =
    `Write a cold outreach email to ${t.contactName ? t.contactName + ' at ' : ''}${t.name}` +
    `${t.offer ? ` — the offer: ${t.offer}` : ''}.\n` +
    `Write ENTIRELY in ${LANG_NAME[t.lang]}. Personalise to who they are. ` +
    `${t.notes ? `Context on them: ${t.notes}. ` : ''}` +
    `Return ONLY minified JSON: {"subject":"<subject in ${LANG_NAME[t.lang]}>","body":"<full email in ${LANG_NAME[t.lang]}, with greeting and sign-off from Ali Kaiser>"}.\n\n` +
    STORY;

  let subject = '', body = '';
  try {
    const raw = await askClaude(prompt, [], { tier: 'heavy', feature: 'feldzug-draft', maxTokens: 900 });
    const m = String(raw || '').match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, reason: 'no_draft' };
    const p = JSON.parse(m[0]);
    subject = String(p.subject || '').slice(0, 200);
    body = String(p.body || '').slice(0, 4000);
  } catch (e: any) {
    return { ok: false, reason: e?.message === 'NO_API_KEY' ? 'no_key' : 'draft_failed' };
  }
  if (!body) return { ok: false, reason: 'empty' };

  /* Keep the draft on the target either way — a heavy generation isn't
     wasted just because a recipient hasn't been added yet. */
  const now = Date.now();
  updateTarget(t.id, { lastDraft: { subject, body, at: now }, lastTouch: now });

  /* No recipient → don't queue a doomed Gate action (send would 400).
     The draft is saved; the operator adds an email, then re-drafts to
     queue it. */
  if (!t.email) return { ok: true, subject, noRecipient: true };

  /* THE GATE — queue, never send. The email leaves only on Ali's tap. */
  proposeAction('email_send', `Outreach → ${t.name} (${t.lang})`, {
    to: t.email, subject, body, targetId: t.id,
  });
  updateTarget(t.id, { status: t.status === 'scouted' ? 'contacted' : t.status });
  try { logEvent({ domain: 'campaign', type: 'draft_queued', meta: { id: t.id, name: t.name, lang: t.lang }, source: 'ai' }); } catch { /* ignore */ }
  return { ok: true, subject };
}

/* Fuzzy-find a target by a spoken/typed name, for the ⌘K
   "draft outreach for CSA" command. */
export function findTarget(name: string): Target | undefined {
  const q = name.trim().toLowerCase();
  if (!q) return undefined;
  const list = listTargets();
  return list.find((t) => t.name.toLowerCase() === q)
    || list.find((t) => t.name.toLowerCase().includes(q) || q.includes(t.name.toLowerCase()));
}

/* ── seed: the launch targets ─────────────────────────────── */
export function isTargetsSeeded(): boolean { try { return localStorage.getItem(SEED_FLAG) === '1'; } catch { return false; } }
export function seedTargets(force = false): { ran: boolean; count?: number } {
  try {
    if (!force && isTargetsSeeded()) return { ran: false };
    const seeds: Array<Partial<Target> & { name: string }> = [
      { name: 'Cairo American College (CAC)', lang: 'en', offer: 'school trips + community-day produce stand at the Hidden Garden', notes: 'International school, Maadi — parent community, PTA events.' },
      { name: 'BCA (British Community Association)', lang: 'en', offer: 'venue for community days / markets; fresh produce supply', notes: 'Maadi expat community hub — regular events.' },
      { name: 'DEO (Deutsche Evangelische Oberschule)', lang: 'de', offer: 'Schulausflüge und Gemeinschaftstage im Hidden Garden', notes: 'German school in Cairo — Ausflüge, Feste.' },
      { name: 'Wadi Degla Club', lang: 'ar', offer: 'venue partnership + produce supply for club events', notes: 'Large sporting/social club — family events.' },
      { name: 'Russian Cultural Center', lang: 'ru', offer: 'cultural events and markets at the Hidden Garden', notes: 'Cultural programming — community gatherings.' },
    ];
    for (const s of seeds) addTarget(s);
    try { localStorage.setItem(SEED_FLAG, '1'); } catch { /* ignore */ }
    return { ran: true, count: seeds.length };
  } catch { return { ran: false }; }
}
