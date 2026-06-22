/* ============================================================
   The Hands — the ONLY gate through which KAI takes external
   action on Ali's behalf. The LLM cannot fire anything directly:
   its tool surface exposes propose_* tools that call
   proposeAction() and then wait for a real human tap on
   ConfirmationGate.

   This is the prompt-injection firewall. Email bodies, DMs,
   comments, web pages — none of them can convince the brain to
   ship anything without Ali approving the diff first.

   Tokens for Gmail / IG / GitHub / Vercel live in server env
   vars only. Browser never sees them. Same posture as
   ANTHROPIC_API_KEY.
   ============================================================ */

import { read, write, uid, emit } from './store';
import { logEvent } from './events';

export type PendingKind = 'email_send' | 'ig_publish' | 'site_commit' | 'site_deploy' | 'sms_send';

export interface PendingAction {
  id: string;
  kind: PendingKind;
  summary: string;
  payload: unknown;
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'failed';
  error?: string;
}

const KEY = 'kai.pending';

export function listAll(): PendingAction[] {
  return read<PendingAction[]>(KEY, []);
}

export function getPending(): PendingAction[] {
  return listAll().filter(a => a.status === 'pending');
}

/* THE ONLY way KAI's brain triggers anything external. */
export function proposeAction(kind: PendingKind, summary: string, payload: unknown): PendingAction {
  const a: PendingAction = {
    id: uid(), kind, summary, payload,
    createdAt: Date.now(), status: 'pending',
  };
  const all = listAll();
  all.push(a);
  write(KEY, all);
  emit();
  logEvent({ domain: 'system', type: 'action_proposed', meta: { kind, summary }, source: 'ai' });
  return a;
}

function setStatus(id: string, status: PendingAction['status'], error?: string) {
  const all = listAll();
  const a = all.find(x => x.id === id);
  if (!a) return;
  a.status = status;
  if (error) a.error = error.slice(0, 240);
  write(KEY, all);
  emit();
}

export function rejectAction(id: string) {
  setStatus(id, 'rejected');
  logEvent({ domain: 'system', type: 'action_rejected', meta: { id }, source: 'user' });
}

async function post<T = any>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${url} ${r.status} · ${text.slice(0, 160)}`);
  try { return JSON.parse(text); } catch { return text as any; }
}

/* Each executor logs a REAL Spine event on success so the Web /
   Oracle / Mirror can later reason over what KAI actually did. */
const EXECUTORS: Record<PendingKind, (p: any) => Promise<void>> = {
  email_send: async (p) => {
    await post('/api/gmail/send', p);
    logEvent({ domain: 'system', type: 'email_sent', meta: { to: p?.to, subject: p?.subject }, source: 'ai' });
  },
  ig_publish: async (p) => {
    await post('/api/ig/publish', p);
    logEvent({ domain: 'instagram', type: 'reel_posted', value: 1, meta: { handle: p?.handle }, source: 'ai' });
  },
  site_commit: async (p) => {
    await post('/api/site/commit', p);
    logEvent({ domain: 'system', type: 'site_committed', meta: { repo: p?.repo }, source: 'ai' });
  },
  site_deploy: async (p) => {
    await post('/api/site/deploy', p);
    logEvent({ domain: 'system', type: 'site_deployed', meta: { repo: p?.repo }, source: 'ai' });
  },
  sms_send: async (p) => {
    await post('/api/phone/send', p);
    logEvent({
      domain: 'system', type: 'sms_sent',
      meta: { to: p?.to, channel: p?.channel || 'sms' },
      source: 'ai',
    });
  },
};

export async function approveAction(id: string): Promise<void> {
  const a = listAll().find(x => x.id === id);
  if (!a || a.status !== 'pending') return;
  try {
    await EXECUTORS[a.kind](a.payload);
    setStatus(id, 'approved');
  } catch (e: any) {
    /* On failure: mark failed (NOT pending) so the user sees what
       happened and can choose to retry or reject. */
    setStatus(id, 'failed', String(e?.message || e || 'unknown'));
    throw e;
  }
}

/* Retry a failed action — flips it back to pending so the gate
   shows it again with the original payload. */
export function retryAction(id: string): void {
  const all = listAll();
  const a = all.find(x => x.id === id);
  if (!a || a.status !== 'failed') return;
  a.status = 'pending';
  a.error = undefined;
  write(KEY, all);
  emit();
}

/* Snapshot for the get_pending Claude tool — read-only, never
   triggers anything. */
export function pendingSnapshot() {
  return listAll().slice(-20).map(a => ({
    id: a.id, kind: a.kind, summary: a.summary,
    status: a.status, created_at: new Date(a.createdAt).toISOString(),
    ...(a.error ? { error: a.error } : {}),
  }));
}
