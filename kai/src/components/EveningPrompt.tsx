/* ============================================================
   DER EINGANG — the EVENING PROMPT. After 21:00, if nothing was
   logged today, KAI asks ONCE: "Anything spent today?" One tap drops
   you on the Money view at the quick-log bar. Silent if you already
   logged, silent after you've answered once. Never nags.
   ============================================================ */

import { Moon, X } from 'lucide-react';

interface Props { onLog: () => void; onDismiss: () => void; }

export default function EveningPrompt({ onLog, onDismiss }: Props) {
  return (
    <div className="evening" role="dialog" aria-label="Evening log prompt">
      <Moon size={15} className="evening-icon" />
      <span className="evening-text">Anything spent today?</span>
      <button className="evening-log" onClick={onLog}>log it</button>
      <button className="evening-x" onClick={onDismiss} aria-label="not today"><X size={13} /></button>
    </div>
  );
}
