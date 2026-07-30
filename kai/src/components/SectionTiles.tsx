/* ============================================================
   THE FOUR TILES — because a command you cannot see is not shipped.

   Thirteen sections were reachable only by typing an exact word that
   appeared nowhere in the interface. The cheat sheet now lists all of
   them; these four are the ones worth a permanent surface, because
   they answer the questions actually asked most often:

     today  — what do I do right now          (§44.1 DAS URTEIL)
     markt  — where does the next pound go     (§44.3 DER MARKT)
     mann   — how am I                         (§46 DER MANN)
     tag    — log the thing I just did         (Der Tag)

   Deliberately NOT a new section: this renders output that already
   exists, through runBuiltin, which is the same path the command bar
   uses. No second source of truth, and nothing here can disagree with
   what typing the word gives you.
   ============================================================ */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Scale, TrendingUp, HeartPulse, Timer, X } from 'lucide-react';
import { runBuiltin } from '../lib/commands';
import { useKaiVersion } from '../lib/kai/mirror';

type Tile = { key: string; cmd: string; label: string; sub: string; Icon: typeof Scale };

const TILES: Tile[] = [
  { key: 'urteil', cmd: 'today',  label: 'The ruling', sub: 'one thing, now',    Icon: Scale },
  { key: 'markt',  cmd: 'markt',  label: 'The board',  sub: 'next pound',        Icon: TrendingUp },
  { key: 'mann',   cmd: 'mann',   label: 'The man',    sub: 'body · hours',      Icon: HeartPulse },
  { key: 'tag',    cmd: 'tag',    label: 'Der Tag',    sub: 'log it',            Icon: Timer },
];

export default function SectionTiles() {
  useKaiVersion();
  const [open, setOpen] = useState<{ title: string; body: string } | null>(null);

  function run(t: Tile) {
    let body: string;
    try {
      /* runBuiltin returns null when nothing matched. That would be a
         wiring bug rather than an empty result, so it says so instead
         of rendering a blank sheet. */
      body = runBuiltin(t.cmd) ?? `Nothing answered "${t.cmd}". That is a routing bug, not an empty result — the command exists.`;
    } catch (e: any) {
      body = `"${t.cmd}" threw: ${String(e?.message || e)}`;
    }
    setOpen({ title: t.label, body });
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TILES.map((t) => (
          <button
            key={t.key}
            onClick={() => run(t)}
            className="flex flex-col items-start gap-1 px-3 py-3 rounded border border-amber/20 hover:border-amber/60 text-left transition-colors"
          >
            <t.Icon size={14} className="text-amber/80" />
            <span className="text-bone text-[13px] leading-tight">{t.label}</span>
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-steel">{t.sub}</span>
          </button>
        ))}
      </div>

      {/* PORTALLED TO BODY, and that is the whole reason it works.
          This component renders inside App's <div className="relative
          z-10">, which creates a stacking context — so a child's
          z-index competes only with its siblings INSIDE that div and
          can never outrank .day-ritual or .wc-scrim, which are siblings
          of the container itself. z-[700] alone did nothing; the
          screenshot showed the day-ritual card still on top of an open
          sheet. Exactly the mistake the lock overlay had. */}
      {open && createPortal((
        <div
          className="fixed inset-0 z-[700] flex items-start justify-center overflow-y-auto px-3 py-[6vh]"
          style={{ background: '#06090e' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}
        >
          <div className="glass w-[min(720px,96vw)] rounded-md">
            <header className="flex items-center justify-between px-4 py-3 border-b border-amber/15">
              <h3 className="font-sans text-bone text-sm tracking-wide">{open.title}</h3>
              <button onClick={() => setOpen(null)} className="text-steel hover:text-amber"><X size={14} /></button>
            </header>
            {/* Column-aligned monospace, so it must NOT reflow: wrapping
                turned "The card  59,000 EGP  return  +38%" into three
                ragged lines and destroyed the only structure the
                readout has. It scrolls inside its own box instead —
                the page body never scrolls sideways. */}
            <div className="overflow-x-auto">
              <pre className="px-4 py-3 font-mono text-[12px] leading-relaxed text-bone whitespace-pre">
                {open.body}
              </pre>
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  );
}
