/* ============================================================
   NIGHT WATCH (§7.9) — the standby face. After idle on Command, the
   panels fade and only three lines remain over the dimmed core: a
   huge clock, the next hard deadline, and ALL QUIET (or the top
   calling organ). Any touch/key wakes it. If an organ starts CALLING
   while it's up, it self-wakes so the lifted card is already there.
   ============================================================ */

import { useEffect, useState } from 'react';
import { activeDeadlines, tierOf } from '../lib/kai/deadlines';
import { getCommandSignals } from '../lib/kai/commandSignals';

const ORGAN_LABEL: Record<string, string> = {
  '01': 'INCOME', '02': 'DEBT', '03': 'GARDEN', '04': 'MAKADI', '05': 'INSTAGRAM',
  '06': 'PRIORITIES', '07': 'EXPENSES', '08': 'CONTENT', '09': 'MIRROR', '10': 'LEDGER', '11': 'TOLLGATE', '12': 'INBOX',
};

interface Props { onWake: () => void; }

export default function NightWatch({ onWake }: Props) {
  const [clock, setClock] = useState('');
  const [status, setStatus] = useState<{ calling: boolean; label: string }>({ calling: false, label: 'ALL QUIET' });

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  /* watch for a call → self-wake; otherwise show the top calling / quiet */
  useEffect(() => {
    const check = () => {
      try {
        const sig = getCommandSignals();
        const calling = Object.keys(ORGAN_LABEL).filter(id => sig[id]?.calling);
        if (calling.length) { onWake(); return; }        // self-wake on a fresh call
        setStatus({ calling: false, label: 'ALL QUIET' });
      } catch { /* ignore */ }
    };
    check();
    const t = setInterval(check, 2500);
    return () => clearInterval(t);
  }, [onWake]);

  const dl = activeDeadlines()[0];
  const dlLine = dl
    ? `${dl.text} · ${tierOf(dl) === 'overdue' ? 'OVERDUE' : new Date(dl.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
    : 'no hard dates';

  return (
    <div className="night-watch" onClick={onWake} role="button" aria-label="night watch — tap to wake">
      <div className="nw-clock">{clock}</div>
      <div className="nw-deadline">{dlLine}</div>
      <div className={'nw-status' + (status.calling ? ' calling' : '')}>{status.label}</div>
    </div>
  );
}
