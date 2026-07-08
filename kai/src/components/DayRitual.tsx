/* ============================================================
   DAY COMPILE + SHUTDOWN (§6.3b) — the daily ritual. Morning: one
   screen assembling the day (escape line, today's move, top deadline,
   energy) → one tap accepts. Evening (after 21:00): a 3-tap shutdown
   — did the one thing happen, tomorrow's one thing, done. 60 seconds.
   ============================================================ */

import { useState } from 'react';
import { Flame, Sun, Moon } from 'lucide-react';
import {
  oneThingSuggestion, getEnergy, setEnergy, type Energy,
  markDayCompiled, markShutdown, setTomorrowOneThing, getPlannedOneThing,
} from '../lib/kai/protocol';
import { escapeLine } from '../lib/kai/escape';
import { activeDeadlines } from '../lib/kai/deadlines';
import { logEvent } from '../lib/kai/events';

interface Props { mode: 'compile' | 'shutdown'; onDone: () => void; }

export default function DayRitual({ mode, onDone }: Props) {
  const [energy, setEn] = useState<Energy>(() => getEnergy());
  const [step, setStep] = useState(0);
  const [tomorrow, setTomorrow] = useState('');

  const oneThing = getPlannedOneThing() || oneThingSuggestion(Date.now(), energy).text;
  const topDeadline = activeDeadlines()[0];

  function acceptDay() {
    setEnergy(energy);
    try { localStorage.setItem('kai.onething.' + new Date().toISOString().slice(0, 10), oneThing); } catch { /* ignore */ }
    markDayCompiled();
    onDone();
  }

  function finishShutdown(done: boolean) {
    try { logEvent({ domain: 'system', type: 'shutdown_review', value: done ? 1 : 0, meta: { thing: oneThing }, source: 'user' }); } catch { /* ignore */ }
    setStep(1);
  }

  if (mode === 'compile') {
    return (
      <div className="day-ritual" role="dialog" aria-label="day compile">
        <div className="day-ritual-card">
          <div className="dr-head"><Sun size={13} /> COMPILE · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</div>

          <div className="dr-row"><span className="dr-label">Escape</span><span className="dr-val">{escapeLine()}</span></div>
          <div className="dr-row"><span className="dr-label">One thing</span><span className="dr-val strong">{oneThing}</span></div>
          {topDeadline && <div className="dr-row"><span className="dr-label">Next date</span><span className="dr-val">{topDeadline.text} · {new Date(topDeadline.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span></div>}

          <div className="dr-energy">
            <span className="dr-label">Energy today</span>
            <div className="dr-energy-toggle">
              <button className={energy === 'high' ? 'on' : ''} onClick={() => setEn('high')}><Flame size={11} /> HIGH</button>
              <button className={energy === 'normal' ? 'on' : ''} onClick={() => setEn('normal')}>NORMAL</button>
            </div>
          </div>

          <button className="dr-accept" onClick={acceptDay}>ACCEPT THE DAY</button>
        </div>
      </div>
    );
  }

  /* shutdown */
  return (
    <div className="day-ritual" role="dialog" aria-label="shutdown">
      <div className="day-ritual-card">
        <div className="dr-head"><Moon size={13} /> SHUTDOWN</div>
        {step === 0 && (
          <>
            <div className="dr-q">Did you do the one thing?</div>
            <div className="dr-val strong mb">{oneThing}</div>
            <div className="dr-two">
              <button className="dr-kept" onClick={() => finishShutdown(true)}>KEPT</button>
              <button className="dr-broke" onClick={() => finishShutdown(false)}>BROKEN</button>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <div className="dr-q">Tomorrow's one thing?</div>
            <input className="dr-input" value={tomorrow} onChange={e => setTomorrow(e.target.value)} placeholder="one thing…" autoFocus />
            <button className="dr-accept" onClick={() => { if (tomorrow.trim()) setTomorrowOneThing(tomorrow.trim()); setStep(2); }}>NEXT</button>
          </>
        )}
        {step === 2 && (
          <>
            <div className="dr-q">Day closed. Rest.</div>
            <button className="dr-accept" onClick={() => { markShutdown(); onDone(); }}>DONE</button>
          </>
        )}
      </div>
    </div>
  );
}
