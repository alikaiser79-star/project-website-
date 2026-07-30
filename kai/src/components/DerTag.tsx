/* DER TAG — the ten-second logger, inside KAI.
   Same UI as the standalone file; the difference is that every entry
   goes straight into the Spine through logEvent(). No export step. */
import { useState } from 'react';
import { parseTag, logTag, streak, byDay } from '../lib/kai/tag';
import { startPTT, stopPTT, pttBlocker, explainPTT } from '../lib/pushToTalk';
import { useKaiVersion } from '../lib/kai/mirror';
import { emit } from '../lib/kai/store';

export default function DerTag({ onClose }: { onClose?: () => void }) {
  useKaiVersion();
  const [line, setLine] = useState('');
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [live, setLive] = useState(false);
  const s = streak();
  const days = byDay(Date.now(), 10);

  function submit(text: string) {
    const p = parseTag(text);
    if (!p.entry) { setMsg({ text: p.problem || 'No.', bad: true }); return; }
    logTag(p.entry); emit();
    setLine('');
    setMsg({ text: `Logged ${Math.round(p.entry.amountEgp).toLocaleString('en-GB')} · ${p.entry.word} — already in the Spine.`, bad: false });
  }

  function hold() {
    const b = pttBlocker();
    if (b) { setMsg({ text: `${b.title}. ${b.detail}`, bad: true }); return; }
    setLive(true);
    startPTT({
      onInterim: setLine,
      onError: (c) => { setLive(false); const e = explainPTT(c); setMsg({ text: `${e.title} (${e.code})`, bad: true }); },
      onFinal: (t) => { setLive(false); if (t.trim()) submit(t); },
    });
  }

  return (
    <div className="tag">
      <div className="tag-kicker">Der Tag</div>
      <div className="tag-streak"><span>{s.days}</span> day streak</div>
      <div className="tag-sub">
        {s.total === 0 ? 'amount and one word' : `${s.total} entries${s.today ? '' : ' · today is still open'} · longest ${s.longest}`}
      </div>

      <form className="tag-form" onSubmit={(e) => { e.preventDefault(); submit(line); }}>
        <button type="button" className={'tag-mic' + (live ? ' live' : '')}
          onPointerDown={hold} onPointerUp={() => live && stopPTT()} aria-label="hold to speak"><i /></button>
        <input value={line} onChange={(e) => setLine(e.target.value)}
          placeholder="340 fuel" enterKeyHint="done" autoCapitalize="none" />
      </form>
      {msg && <div className={'tag-msg' + (msg.bad ? ' bad' : '')}>{msg.text}</div>}

      <ul className="tag-list">
        {days.map((d) => (
          <li key={d.day}>
            <b>{d.egp >= 0 ? '+' : '−'}{Math.abs(Math.round(d.egp)).toLocaleString('en-GB')}</b>
            {d.words.join(' · ')}<span>{d.day.slice(5)}</span>
          </li>
        ))}
      </ul>

      {onClose && <button className="tag-close" onClick={onClose}>close</button>}
    </div>
  );
}
