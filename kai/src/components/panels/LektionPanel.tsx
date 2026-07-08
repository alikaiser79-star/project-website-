/* ============================================================
   LEKTION — one micro-lesson a day (Academy 8.1). One Claude call
   per day MAX, cached by local date. Tied to ONE real number on
   screen. Fixed shape: THE NUMBER → THE PRINCIPLE → THE MOVE →
   one German business term. Mentor tone: teach with his numbers,
   German welcome, never flatter, name a bad pattern once and give
   the counter-move. Each unlock logs a Spine `lesson` event and
   advances a consecutive-day streak.
   ============================================================ */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Flame } from 'lucide-react';
import { askClaude } from '../../lib/claude';
import { buildKaiContext } from '../../lib/kai/context';
import { logEvent } from '../../lib/kai/events';
import { pendingDrillDate, ensureDrillQuestion, recordDrillAnswer, getDrillStreak, type DrillQ } from '../../lib/kai/drill';

interface Lesson { number: string; principle: string; move: string; begriff: string; raw?: string; }

const dayKey = () => new Date().toISOString().slice(0, 10);
const CACHE = (d: string) => `kai.lektion.${d}`;
const STREAK = 'kai.lektion.streak';

function parseLesson(raw: string): Lesson {
  const grab = (label: string) => {
    const m = raw.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, 'im'));
    return m ? m[1].trim() : '';
  };
  const number = grab('NUMBER'), principle = grab('PRINCIPLE'), move = grab('MOVE'), begriff = grab('BEGRIFF');
  if (number && principle && move) return { number, principle, move, begriff };
  return { number: '', principle: '', move: '', begriff: '', raw };   // malformed → render raw
}

function bumpStreak(): number {
  try {
    const today = dayKey();
    const prev = JSON.parse(localStorage.getItem(STREAK) || '{}');
    if (prev.lastDate === today) return prev.count || 1;
    const yest = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const count = prev.lastDate === yest ? (prev.count || 0) + 1 : 1;
    localStorage.setItem(STREAK, JSON.stringify({ count, lastDate: today }));
    return count;
  } catch { return 1; }
}

export default function LektionPanel({ delay = 0 }: { delay?: number }) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [streak, setStreak] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'offline'>('loading');

  /* Drill (8.2): yesterday's lesson, gated before today's. */
  const [drill, setDrill] = useState<DrillQ | null>(null);
  const [drillDate, setDrillDate] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [drillStreak, setDrillStreak] = useState(() => getDrillStreak());

  useEffect(() => {
    let alive = true;
    const dd = pendingDrillDate();
    if (dd) {
      ensureDrillQuestion(dd).then(q => {
        if (alive && q) { setDrill(q); setDrillDate(dd); }
      }).catch(() => {});
    }
    return () => { alive = false; };
  }, []);

  function answerDrill(i: number) {
    if (picked !== null || !drill || !drillDate) return;
    setPicked(i);
    setDrillStreak(recordDrillAnswer(drillDate, i === drill.correct));
  }

  useEffect(() => {
    let alive = true;
    const d = dayKey();
    try {
      const cached = localStorage.getItem(CACHE(d));
      if (cached) {
        if (!alive) return;
        setLesson(JSON.parse(cached)); setStreak(bumpStreak()); setState('ready');
        return;
      }
    } catch { /* fall through to generate */ }

    const prompt =
      'You are KAI as a MENTOR to a 33-year-old operator who reads people instantly and ' +
      'hates fluff. Teach with HIS numbers from the context. German business terms welcome. ' +
      'Never flatter; if the data shows a bad pattern, name it once and give the counter-move.\n\n' +
      'Write EXACTLY four lines, each prefixed with its label, tied to ONE real number below:\n' +
      'NUMBER: <the real number and what it is>\n' +
      'PRINCIPLE: <one concept in <=3 sentences>\n' +
      'MOVE: <one action he can take today>\n' +
      'BEGRIFF: <one German business term — translation>\n\n' +
      'CONTEXT:\n' + buildKaiContext();

    askClaude(prompt, []).then(raw => {
      if (!alive) return;
      const parsed = parseLesson(raw);
      try { localStorage.setItem(CACHE(d), JSON.stringify(parsed)); } catch { /* ignore */ }
      try { logEvent({ domain: 'system', type: 'lesson', value: 1, meta: { number: parsed.number || 'raw' }, source: 'ai' }); } catch { /* ignore */ }
      setLesson(parsed); setStreak(bumpStreak()); setState('ready');
    }).catch(() => { if (alive) setState('offline'); });

    return () => { alive = false; };
  }, []);

  return (
    <motion.div
      data-panel="22"
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay, duration: 0.5 } }}
      className="glass rounded-lg p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GraduationCap size={14} className="text-amber" />
          <span className="font-mono text-[11px] tracking-[0.25em] text-amber/80 uppercase">Lektion</span>
        </div>
        {(drillStreak > 0 ? drillStreak : streak) > 0 && (
          <span className="flex items-center gap-1 font-mono text-[11px] text-amber">
            <Flame size={12} /> {drillStreak > 0 ? drillStreak : streak}
          </span>
        )}
      </div>

      {/* DRILL — gate on yesterday's lesson before today's shows. */}
      {drill && (
        <div className="mb-4 pb-4 border-b border-amber/10">
          <div className="font-mono text-[9px] tracking-[0.2em] text-amber/50 uppercase mb-2">Drill · yesterday</div>
          <div className="font-mono text-[12px] leading-relaxed text-bone mb-2.5">{drill.question}</div>
          <div className="flex flex-col gap-1.5">
            {drill.options.map((opt, i) => {
              const answered = picked !== null;
              const isCorrect = i === drill.correct;
              const cls = !answered
                ? 'border-white/[0.08] text-bone/80 hover:border-amber/40 hover:text-bone'
                : isCorrect
                  ? 'border-emerald-400/50 text-emerald-300 bg-emerald-400/5'
                  : i === picked
                    ? 'border-danger/50 text-danger bg-danger/5'
                    : 'border-white/[0.05] text-steel/50';
              return (
                <button
                  key={i}
                  onClick={() => answerDrill(i)}
                  disabled={answered}
                  className={'text-left font-mono text-[11.5px] px-3 py-2 rounded border transition ' + cls}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className={'mt-2.5 font-mono text-[11px] ' + (picked === drill.correct ? 'text-emerald-300' : 'text-danger')}>
              {picked === drill.correct ? 'Correct. Streak holds.' : 'Wrong — re-queued in 3 days.'}
            </div>
          )}
        </div>
      )}

      {state === 'loading' && <div className="font-mono text-xs text-steel">preparing today's lesson…</div>}
      {state === 'offline' && <div className="font-mono text-xs text-steel">Lesson offline — no API key wired on the server.</div>}
      {state === 'ready' && lesson && (
        lesson.raw ? (
          <div className="font-mono text-[12px] leading-relaxed text-bone whitespace-pre-wrap">{lesson.raw}</div>
        ) : (
          <div className="flex flex-col gap-2.5 font-mono">
            <div>
              <div className="text-[9px] tracking-[0.2em] text-amber/50 uppercase">The Number</div>
              <div className="text-[14px] text-amber">{lesson.number}</div>
            </div>
            <div>
              <div className="text-[9px] tracking-[0.2em] text-amber/50 uppercase">The Principle</div>
              <div className="text-[12px] leading-relaxed text-bone">{lesson.principle}</div>
            </div>
            <div>
              <div className="text-[9px] tracking-[0.2em] text-amber/50 uppercase">The Move</div>
              <div className="text-[12px] leading-relaxed text-bone">{lesson.move}</div>
            </div>
            {lesson.begriff && (
              <div className="pt-1 border-t border-amber/10">
                <span className="text-[11px] text-amber/70">{lesson.begriff}</span>
              </div>
            )}
          </div>
        )
      )}
    </motion.div>
  );
}
