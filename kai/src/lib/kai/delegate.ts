/* ============================================================
   The Delegate — standing approval rules for narrow safe lanes.

   When the brain calls proposeAction(...), the new action goes
   into the queue. The Delegate then checks any ENABLED rule
   against it. If a rule matches, the action is auto-approved
   (executor runs) without Ali's tap. The audit trail still
   logs every step:

     - action_proposed         (always)
     - delegate_auto_approved  (when a Delegate rule fired)
     - <kind>_sent/committed   (executor success)

   SAFETY POSTURE
   - Rules default DISABLED. Each one is opt-in.
   - Rules can ONLY auto-approve. Auto-reject is supported but
     defaults to off — it's easier to undo a "nothing happened"
     than a "the wrong thing happened".
   - site_deploy is NEVER auto-approvable, regardless of rules.
     A live deploy is too consequential.
   - Every rule has a HARD daily cap (default 5 fires/day) so a
     runaway brain can't drain the lane.
   - The kill switch at the top of DelegatePanel disables every
     rule in one tap.
   ============================================================ */

import { read, write, emit } from './store';
import { logEvent } from './events';
import type { PendingAction, PendingKind } from './pending';

const KEY = 'kai.delegate';
const DAY = 86_400_000;

export type DelegateAction = 'auto_approve' | 'auto_reject';

export interface DelegateRule {
  id: string;
  name: string;
  lane: string;                  // human description
  kind: PendingKind;
  /* When all match, the rule fires. summary_regex matches against
     PendingAction.summary; payload_includes matches each
     key/value substring against the payload's stringified JSON. */
  summary_regex?: string;
  payload_includes?: Record<string, string>;
  action: DelegateAction;
  enabled: boolean;
  dailyCap: number;              // max fires per UTC day
  firedToday: number;
  lastFiredDay: string;          // YYYY-MM-DD
  fires: number;                 // lifetime
}

interface State {
  rules: DelegateRule[];
  /* Global kill switch — when true, no rule fires regardless of
     individual enabled flags. */
  killed: boolean;
}

function defaults(): State {
  return { rules: starterRules(), killed: false };
}

function starterRules(): DelegateRule[] {
  return [
    {
      id: 'd-makadi-booking',
      name: 'Makadi · booking inquiry auto-reply',
      lane: 'Inbound booking inquiry → auto-reply with availability + price.',
      kind: 'email_send',
      summary_regex: 'makadi.*book|book.*makadi',
      action: 'auto_approve',
      enabled: false,
      dailyCap: 5,
      firedToday: 0,
      lastFiredDay: '',
      fires: 0,
    },
  ];
}

export function getDelegate(): State {
  const s = read<State>(KEY, defaults());
  /* If there are zero rules, seed with starters. */
  if (!Array.isArray(s.rules)) s.rules = [];
  return s;
}
function saveState(s: State): void { write(KEY, s); emit(); }

export function setKillSwitch(killed: boolean): void {
  const s = getDelegate();
  s.killed = killed;
  saveState(s);
  logEvent({ domain: 'system', type: killed ? 'delegate_killed' : 'delegate_unkilled', source: 'user' });
}

export function setRuleEnabled(id: string, enabled: boolean): void {
  const s = getDelegate();
  const r = s.rules.find(x => x.id === id);
  if (!r) return;
  r.enabled = enabled;
  saveState(s);
}

export function addRule(r: Omit<DelegateRule, 'id' | 'firedToday' | 'lastFiredDay' | 'fires'>): DelegateRule {
  const s = getDelegate();
  const fresh: DelegateRule = {
    ...r,
    id: 'd-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    firedToday: 0, lastFiredDay: '', fires: 0,
  };
  s.rules.push(fresh);
  saveState(s);
  return fresh;
}

export function removeRule(id: string): void {
  const s = getDelegate();
  s.rules = s.rules.filter(r => r.id !== id);
  saveState(s);
}

/* Returns the rule that should fire for `a`, or null. */
export function match(a: PendingAction): DelegateRule | null {
  const s = getDelegate();
  if (s.killed) return null;
  /* site_deploy is never auto-handleable. */
  if (a.kind === 'site_deploy') return null;

  const today = new Date().toISOString().slice(0, 10);
  for (const r of s.rules) {
    if (!r.enabled) continue;
    if (r.kind !== a.kind) continue;
    /* Daily cap (reset on new UTC day). */
    if (r.lastFiredDay !== today) { r.firedToday = 0; r.lastFiredDay = today; }
    if (r.firedToday >= r.dailyCap) continue;

    /* Summary regex. */
    if (r.summary_regex) {
      try {
        const re = new RegExp(r.summary_regex, 'i');
        if (!re.test(a.summary)) continue;
      } catch { continue; }
    }
    /* Payload substring includes. */
    if (r.payload_includes && Object.keys(r.payload_includes).length) {
      const payloadStr = JSON.stringify(a.payload || {}).toLowerCase();
      let ok = true;
      for (const [, v] of Object.entries(r.payload_includes)) {
        if (!payloadStr.includes(String(v).toLowerCase())) { ok = false; break; }
      }
      if (!ok) continue;
    }
    return r;
  }
  return null;
}

/* Bump fires for a rule that just acted. */
export function recordFire(ruleId: string): void {
  const s = getDelegate();
  const r = s.rules.find(x => x.id === ruleId);
  if (!r) return;
  const today = new Date().toISOString().slice(0, 10);
  if (r.lastFiredDay !== today) { r.firedToday = 0; r.lastFiredDay = today; }
  r.firedToday++;
  r.fires++;
  saveState(s);
}

/* Used by pending.ts on every proposeAction(). */
export function recentFiresLast(days = 7): number {
  void days;
  const s = getDelegate();
  return s.rules.reduce((sum, r) => sum + r.firedToday, 0);
}
