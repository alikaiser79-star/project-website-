/* ============================================================
   The Crown — your real arc as a vertical legend timeline.

   Each milestone the Spine surfaces becomes a beat. Tap "Draft
   it" → Claude writes 2-3 on-brand @alikaiser1 story posts in
   Ali's voice, holding the through-line. One tap sends the
   chosen draft to the Content Queue.

   Reactive to the Spine via useKaiVersion, so a new milestone
   (debt crossing 50%, IG crossing 10k) appears the moment its
   proving event lands.
   ============================================================ */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Loader2, X, Sparkles, Copy, Check, Plus, RefreshCw, AlertTriangle } from 'lucide-react';
import Panel from '../Panel';
import { useKaiVersion } from '../../lib/kai/mirror';
import {
  liveBeats, draftBeat, queueBeatDraft, dismissBeat,
  type Beat, type BeatDraft,
} from '../../lib/kai/crown';
import { operator } from '../../kaiConfig';
import { sfx } from '../../lib/sound';
import { toast } from '../../hooks/useToasts';

const KIND_COLOR: Record<string, string> = {
  ig_followers:   '#C792EA',
  debt_cleared:   '#7AE6A8',
  debt_progress:  '#7AE6A8',
  plants:         '#7AE6A8',
  first_reel:     '#5FE3FF',
  first_kept:     '#FFB300',
  first_delivered:'#FFB300',
  content_count:  '#5FE3FF',
  kept_count:     '#FFB300',
};

export default function CrownPanel({ delay = 0 }: { delay?: number }) {
  useKaiVersion();
  const beats = liveBeats();

  const newCount = beats.filter(b => b.status === 'new').length;
  const tag = beats.length === 0 ? 'no chapters yet' : `${newCount} to tell`;

  return (
    <Panel num="12" title="The Crown" tag={tag} delay={delay}>
      {beats.length === 0 ? (
        <div className="px-4 py-7 border border-amber/15 rounded text-center">
          <Crown size={22} className="text-amber/60 mx-auto mb-2" />
          <p className="text-bone/85 text-[12.5px]">Your legend writes itself.</p>
          <p className="text-steel text-[10.5px] mt-1 max-w-[320px] mx-auto leading-relaxed">
            Hit milestones — clear debt, cross a follower tier, grow the garden —
            and KAI drafts each one as a story beat in your voice, ready to post.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Spine line */}
          <div className="absolute left-[6px] top-1 bottom-1 w-px bg-amber/15" />
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {beats.map(b => (
                <motion.li
                  key={b.key}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="relative pl-6"
                >
                  <span
                    className="absolute left-0 top-1.5 w-[13px] h-[13px] rounded-full border-2 border-ink2"
                    style={{
                      background: KIND_COLOR[b.kind] || '#FFB300',
                      boxShadow: `0 0 7px ${KIND_COLOR[b.kind] || '#FFB300'}`,
                    }}
                  />
                  <BeatCard beat={b} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </Panel>
  );
}

function BeatCard({ beat }: { beat: Beat & { status: string } }) {
  const [drafts, setDrafts] = useState<BeatDraft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const when = (() => {
    try { return new Date(beat.ts).toLocaleDateString(operator.locale, { day: 'numeric', month: 'short' }); }
    catch { return ''; }
  })();

  async function draft() {
    if (busy) return;
    setBusy(true); setErr(null);
    sfx.whoosh();
    try {
      const out = await draftBeat(beat);
      setDrafts(out);
      sfx.confirm();
    } catch (e: any) {
      const msg = String(e?.message || 'unknown');
      setErr(
        msg === 'NO_API_KEY' ? 'No Anthropic key on the server.'
        : msg.startsWith('PARSE_') ? "Draft didn't parse — try again."
        : msg.startsWith('API_ERROR') ? 'API error — ' + msg.slice(11, 120)
        : msg.slice(0, 140)
      );
      sfx.error();
    } finally {
      setBusy(false);
    }
  }

  function queue(d: BeatDraft) {
    queueBeatDraft(beat, d);
    sfx.confirm();
    toast.ok('Sent to the Content Queue.', 'CROWN', 3000);
  }

  return (
    <div className="rounded-md border border-amber/15 bg-ink2/25 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-sans text-bone text-[13px] leading-snug">{beat.title}</div>
          <div className="font-mono text-[10px] text-steel/75 tracking-[0.06em] mt-0.5">
            {when}{beat.status === 'queued' ? ' · in queue' : ''}
          </div>
        </div>
        {beat.status === 'queued' ? (
          <span className="px-1.5 py-0.5 rounded border border-emerald/50 bg-emerald/10 text-emerald font-mono text-[9px] tracking-[0.16em] uppercase shrink-0">
            queued
          </span>
        ) : !drafts && !busy ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={draft}
              className="flex items-center gap-1 px-2 py-1 rounded border border-amber/40 text-amber hover:bg-amber/10 font-mono text-[10px] tracking-[0.14em] uppercase"
            >
              <Sparkles size={10} /> Draft
            </button>
            <button
              onClick={() => { dismissBeat(beat.key); }}
              className="text-steel/55 hover:text-danger p-1"
              title="Dismiss this chapter"
            >
              <X size={11} />
            </button>
          </div>
        ) : null}
      </div>

      {busy && (
        <div className="mt-2 flex items-center gap-2 font-mono text-[10.5px] text-steel">
          <Loader2 size={12} className="animate-spin text-amber" /> writing the chapter…
        </div>
      )}

      {err && (
        <div className="mt-2 flex items-center gap-2 text-danger text-[10.5px]">
          <AlertTriangle size={11} className="shrink-0" /> {err}
          <button onClick={draft} className="ml-auto flex items-center gap-1 text-amber hover:underline">
            <RefreshCw size={9} /> retry
          </button>
        </div>
      )}

      {drafts && (
        <div className="mt-2.5 space-y-2">
          {drafts.map((d, i) => (
            <DraftCard key={i} draft={d} onQueue={() => queue(d)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DraftCard({ draft, onQueue }: { draft: BeatDraft; onQueue: () => void }) {
  const [copied, setCopied] = useState<'hook' | 'caption' | null>(null);

  async function copy(text: string, which: 'hook' | 'caption') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which); sfx.confirm();
      setTimeout(() => setCopied(null), 1300);
    } catch { toast.err('Clipboard blocked.'); }
  }

  return (
    <div className="rounded border border-amber/10 bg-ink2/40 px-2.5 py-2 space-y-1.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 font-sans text-bone text-[12.5px] leading-snug">"{draft.hook}"</div>
        <button onClick={() => copy(draft.hook, 'hook')} className="text-steel hover:text-amber p-0.5 shrink-0" title="Copy hook">
          {copied === 'hook' ? <Check size={11} className="text-emerald" /> : <Copy size={11} />}
        </button>
      </div>
      <ul className="space-y-0.5">
        {draft.shotlist.map((s, i) => (
          <li key={i} className="font-mono text-[10.5px] text-steel/85 leading-snug">· {s}</li>
        ))}
      </ul>
      <div className="flex items-start gap-2">
        <div className="flex-1 font-sans text-bone/85 text-[11.5px] leading-relaxed">{draft.caption}</div>
        <button onClick={() => copy(draft.caption + (draft.hashtags.length ? '\n\n' + draft.hashtags.join(' ') : ''), 'caption')} className="text-steel hover:text-amber p-0.5 shrink-0" title="Copy caption">
          {copied === 'caption' ? <Check size={11} className="text-emerald" /> : <Copy size={11} />}
        </button>
      </div>
      {draft.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {draft.hashtags.map((t, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded border border-cyan/30 text-cyan/90 font-mono text-[9.5px]">{t}</span>
          ))}
        </div>
      )}
      <button
        onClick={onQueue}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1 mt-0.5 rounded border border-amber/40 text-amber hover:bg-amber/10 font-mono text-[10px] tracking-[0.16em] uppercase"
      >
        <Plus size={10} /> Add to queue
      </button>
    </div>
  );
}
