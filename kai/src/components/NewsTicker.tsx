import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { fetchTopStories, Story } from '../lib/news';

export default function NewsTicker() {
  const [items, setItems] = useState<Story[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchTopStories(8)
      .then(s => { if (alive) { setItems(s); setErr(null); } })
      .catch(e => alive && setErr(e.message));
    const t = setInterval(() => {
      fetchTopStories(8).then(s => { if (alive) setItems(s); }).catch(() => {});
    }, 15 * 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const line = err
    ? 'feed offline · holding'
    : items.length === 0
      ? 'linking up to feed…'
      : items.map(i => i.title).join('   ◊   ');

  return (
    <div className="glass rounded-md px-3 py-2 flex items-center gap-3 overflow-hidden">
      <div className="flex items-center gap-2 shrink-0 pr-3 border-r border-amber/15">
        <Radio size={12} className="text-amber animate-pulse-soft" />
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-amber">HN · top</span>
      </div>
      <div className="overflow-hidden flex-1 relative">
        <div className="whitespace-nowrap font-mono text-[12px] text-bone marquee">
          {line}
          <span className="text-amber/40">   ◊   </span>
          {line}
        </div>
      </div>

      <style>{`
        .marquee {
          display: inline-block;
          padding-left: 100%;
          animation: marq 50s linear infinite;
        }
        @keyframes marq {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
}
