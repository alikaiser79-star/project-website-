/* ============================================================
   §39 DIE ZUKUNFT — the first screen.

   Near-black and one sentence. No panels, no numbers, no navigation.
   Everything that exists still exists, one gesture down.

   THE RULES THIS COMPONENT OBEYS, and they are visible in the markup:
     · no rectangles. Nothing here has a border, a card, or a panel edge.
       The only closed shape on screen is the heart, and it is a circle
       because it is an organ.
     · one typeface, three weights (300/400/600), four sizes. They live in
       CSS custom properties and nothing outside them is used.
     · no icons. The heart is the only drawn thing.
     · the BODY is the chrome — colour, warmth, bloom, tempo and type
       weight all come from moodFor(being). A pressed month looks pressed
       before a word of it is read.
     · navigation IS the sentence. One input, voice or text.
   ============================================================ */

import { useEffect, useMemo, useRef, useState } from 'react';
import { assembleContext } from '../lib/kai/council';
import { resolveBeing } from '../lib/kai/being';
import { councilQueue } from '../lib/kai/council';
import { theSentence, theSecond, moment, moodFor, dimFor } from '../lib/kai/zukunft';
import { startPTT, stopPTT, pttBlocker, explainPTT, type PTTProblem } from '../lib/pushToTalk';
import { emitAction } from '../lib/actions';
import { useKaiVersion } from '../lib/kai/mirror';

interface Props { children?: React.ReactNode; onDepth?: (open: boolean) => void }

export default function Zukunft({ children, onDepth }: Props) {
  useKaiVersion();
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);      // depth revealed
  const [typed, setTyped] = useState('');
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState<PTTProblem | null>(null);
  const [why, setWhy] = useState(false);        // show the sentence's working
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /* The moment moves even when nothing else does. */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { sentence, second, mood, dim, mo, being } = useMemo(() => {
    const safe = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };
    const ctx = safe(() => assembleContext(now), null as any);
    const needs = safe(() => (ctx ? councilQueue(ctx).length : 0), 0);
    const b = safe(() => (ctx ? resolveBeing(ctx, needs) : null), null as any);
    return {
      sentence: safe(() => (ctx ? theSentence(ctx, now) : null), null as any),
      second: safe(() => (ctx ? theSecond(ctx, now) : null), null as any),
      mood: moodFor(b?.state || 'STEADY'),
      dim: dimFor(moment(now)),
      mo: moment(now),
      being: b,
    };
  }, [now]);

  function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    setTyped('');
    /* Navigation IS the sentence — everything goes through the one
       intent pipeline that already exists. */
    emitAction({ type: 'open-cmd', prefill: q, submit: true });
  }

  function hold() {
    const blocked = pttBlocker();
    if (blocked) { setErr(blocked); return; }
    setErr(null); setListening(true);
    startPTT({
      onError: (c) => { setListening(false); setErr(explainPTT(c)); },
      onFinal: (t) => { setListening(false); if (t.trim()) ask(t); },
    });
  }

  const style = {
    ['--zk-rgb' as any]: mood.rgb,
    ['--zk-glow' as any]: String(mood.glow * dim),
    ['--zk-weight' as any]: String(mood.weight),
    ['--zk-tempo' as any]: `${mood.tempo}s`,
    ['--zk-warmth' as any]: String(mood.warmth),
    ['--zk-dim' as any]: String(dim),
  };

  return (
    <div className={'zk' + (open ? ' is-open' : '')} style={style} ref={scrollRef}>
      {/* ZONE 1 — the sentence. This is the whole first screen. */}
      <section className="zk-first">
        <div className="zk-heart" aria-hidden="true">
          <span className="zk-heart-core" />
        </div>

        <p className="zk-say">{sentence?.text || 'Nothing needs you right now.'}</p>

        {second && <p className="zk-say-2">{second.text}</p>}

        {/* The working, behind a word. Never on screen uninvited. */}
        <button className="zk-why" onClick={() => setWhy((w) => !w)}>
          {why ? mo.label : 'why'}
        </button>
        {why && (
          <p className="zk-because">
            {sentence?.because}
            {being?.because ? ` · ${being.label.toLowerCase()} — ${being.because}` : ''}
          </p>
        )}

        {/* ZONE 2 — the one input. Voice or text, always present. */}
        <div className="zk-ask">
          <button
            className={'zk-mic' + (listening ? ' live' : '')}
            onPointerDown={hold}
            onPointerUp={() => { if (listening) stopPTT(); }}
            onPointerLeave={() => { if (listening) stopPTT(); }}
            aria-label="Hold to speak"
          >
            <span className="zk-mic-dot" />
          </button>
          <input
            className="zk-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') ask(typed); }}
            placeholder={listening ? 'listening' : 'ask'}
            enterKeyHint="go"
          />
        </div>

        {err && (
          <p className="zk-err" role="alert" onClick={() => setErr(null)}>
            {err.title}. {err.detail} <span>{err.code}</span>
          </p>
        )}

        {/* ZONE 3 — depth on demand. One word, not a tab bar. */}
        <button
          className="zk-down"
          onClick={() => setOpen((o) => { const n = !o; onDepth?.(n); return n; })}
        >
          {open ? 'less' : 'everything'}
        </button>
      </section>

      {open && <section className="zk-depth">{children}</section>}
    </div>
  );
}
