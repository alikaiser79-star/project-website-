/* ============================================================
   NIGHT LEDGER strip (§14.4) — "while you were away", shown once on the
   first open of the day. Three lines max, dismissible. Honest: if the
   pulse ran and nothing moved, it says so.
   ============================================================ */

import { useEffect, useState } from 'react';
import { Moon, X } from 'lucide-react';
import { nightLedger, markSeen, shouldShowNightLedger } from '../lib/kai/nightLedger';

export default function NightLedger() {
  const [report, setReport] = useState<{ lines: string[] } | null>(null);

  useEffect(() => {
    /* wait past the boot so it doesn't fight the entrance. */
    const t = setTimeout(() => {
      try { if (shouldShowNightLedger()) setReport(nightLedger()); } catch { /* ignore */ }
    }, 3200);
    return () => clearTimeout(t);
  }, []);

  function dismiss() { markSeen(); setReport(null); }

  if (!report) return null;

  return (
    <div className="night-ledger" role="status">
      <div className="night-head">
        <span className="night-title"><Moon size={12} /> WHILE YOU WERE AWAY</span>
        <button className="night-x" onClick={dismiss} aria-label="dismiss"><X size={13} /></button>
      </div>
      <ul className="night-lines">
        {report.lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </div>
  );
}
