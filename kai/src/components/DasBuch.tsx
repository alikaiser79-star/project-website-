/* DAS BUCH — the month, read inside KAI. The chapter is generated from
   the Spine at read time, so it is never stale and never hand-edited. */
import { useMemo, useState } from 'react';
import { monthBounds, previousMonth, chapter, chapterHtml } from '../lib/kai/buch';
import { useKaiVersion } from '../lib/kai/mirror';

export default function DasBuch({ onClose }: { onClose?: () => void }) {
  useKaiVersion();
  const [back, setBack] = useState(1);       // 1 = last full month
  const b = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() - back + 1);
    return back === 0 ? monthBounds() : previousMonth(new Date(d.getFullYear(), d.getMonth(), 1).getTime());
  }, [back]);
  const c = useMemo(() => chapter(b), [b]);

  function download() {
    try {
      const blob = new Blob([chapterHtml(c)], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `buch-${c.key}.html`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { /* ignore */ }
  }

  return (
    <div className="buch">
      <div className="buch-kicker">Das Buch</div>
      <h1 className="buch-title">{c.label}</h1>
      <div className="buch-count">{c.events} events on the record</div>

      {c.sections.map((s, i) => (
        <section key={s.title} className="buch-sec">
          <h2><span>{String(i + 1).padStart(2, '0')}</span>{s.title}</h2>
          {s.lines.map((l, j) => <p key={j}>{l}</p>)}
        </section>
      ))}

      <div className="buch-verdict">
        <h2><span>{String(c.sections.length + 1).padStart(2, '0')}</span>The verdict</h2>
        <p>{c.verdict}</p>
      </div>

      <div className="buch-foot">
        <button onClick={() => setBack((n) => n + 1)}>earlier</button>
        {back > 1 && <button onClick={() => setBack((n) => Math.max(1, n - 1))}>later</button>}
        <button onClick={download}>save this chapter</button>
        {onClose && <button onClick={onClose}>close</button>}
      </div>
      <div className="buch-note">Written from the Spine, at read time. Never hand-edited.</div>
    </div>
  );
}
