/* ============================================================
   PROPOSE MODE (AI 7.5). From an Ask-KAI answer, KAI may attach up
   to 3 follow-up chips: draft the email, create the commitment,
   schedule the task. Nothing fires on its own —

     - email     → proposeAction('email_send') → the ConfirmationGate,
                   exactly like every other external proposal. Ali
                   approves; only then does it send.
     - commitment→ addCommitment (the Mirror) — internal state, so the
                   chip tap IS the approval (same as the ⌘K flow).
     - task      → addReminder — internal, tap = approval.

   The external action is the only one that can leave the device, and
   it is gated. This respects the hard rule: the LLM never fires an
   external action directly.
   ============================================================ */

import { askClaude } from '../claude';
import { proposeAction } from './pending';
import { addCommitment } from './commitments';
import { extractCommitment } from './ai';
import { addReminder } from '../reminders';

export interface ProposeChip { label: string; kind: 'email' | 'commitment' | 'task'; detail: string; }

/* One structured call after an answer: up to 3 concrete follow-ups,
   or [] when none clearly fit. Never invents an action. */
export async function suggestChips(question: string, answer: string): Promise<ProposeChip[]> {
  const prompt =
    'From the operator\'s question and your answer, propose UP TO 3 concrete follow-up ' +
    'actions he could take now. Include one ONLY if it clearly follows — fewer is fine, [] ' +
    'is fine. Return ONLY a JSON array, each item ' +
    '{"label":"<=6 words","kind":"email"|"commitment"|"task","detail":"one line of specifics"}.\n\n' +
    `QUESTION: ${question}\nANSWER: ${answer}`;
  try {
    const raw = await askClaude(prompt, []);
    const m = String(raw || '').match(/\[[\s\S]*\]/);
    if (!m) return [];
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c: any) => c && c.label && ['email', 'commitment', 'task'].includes(c.kind))
      .slice(0, 3)
      .map((c: any) => ({ label: String(c.label), kind: c.kind, detail: String(c.detail || c.label) }));
  } catch { return []; }
}

/* Fire a chip. Returns a short confirmation for the drawer. */
export async function fireChip(chip: ProposeChip): Promise<string> {
  if (chip.kind === 'email') {
    proposeAction('email_send', chip.label, { subject: chip.label, body: chip.detail });
    return 'Draft queued in the gate — approve to send.';
  }
  if (chip.kind === 'commitment') {
    const input = await extractCommitment(chip.detail).catch(() => null);
    if (input) { addCommitment(input); return 'Commitment added to the Mirror.'; }
    return 'Could not shape that into a trackable commitment.';
  }
  /* task */
  const at = new Date(Date.now() + 86_400_000).toISOString();
  addReminder(chip.detail, at);
  return 'Task scheduled for tomorrow.';
}
