import Panel from '../Panel';
import { useEffect, useState } from 'react';
import { operator } from '../../kaiConfig';
import { ResponsiveContainer, YAxis, Tooltip, Area, AreaChart } from 'recharts';
import { useCounter } from '../../hooks/useCounter';
import { getInstagram } from '../../lib/store';
import { instagramSeries } from '../../lib/history';
import type { IgAccount } from '../../types';

function fmt(n: number) { return n.toLocaleString(operator.locale); }

function Row({ a, i }: { a: IgAccount; i: number }) {
  const value = useCounter(a.followers, { duration: 1.6, delay: i * 0.15 });
  const series = instagramSeries(a.handle, 14);
  const hasHistory = series.length >= 2;
  const data = hasHistory ? series.map((v, idx) => ({ d: idx, v })) : [];
  const start = hasHistory ? series[0] : 0;
  const end   = hasHistory ? series[series.length - 1] : 0;
  const growth = hasHistory && start > 0 ? ((end - start) / start) * 100 : 0;

  return (
    <div className="border border-amber/15 rounded p-3 mb-3 last:mb-0">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="font-sans text-bone text-sm">{a.handle}</div>
          <div className="font-mono text-amber text-xl tabular-nums drop-shadow-[0_0_8px_rgba(255,179,0,0.35)]">{fmt(value)}</div>
        </div>
        <div className={'font-mono text-[11px] ' + (hasHistory ? (growth >= 0 ? 'text-ok' : 'text-danger') : 'text-steel')}>
          {hasHistory ? `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% · ${series.length}d` : 'building history'}
        </div>
      </div>
      <div className="h-[60px]">
        {hasHistory ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={'g-' + i} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%"  stopColor="#FFB300" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#FFB300" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin - 50', 'dataMax + 50']} />
              <Tooltip
                contentStyle={{ background: '#0E141C', border: '1px solid rgba(255,179,0,0.4)', fontFamily: 'JetBrains Mono', fontSize: 11, color: '#FFB300' }}
                cursor={{ stroke: 'rgba(255,179,0,0.3)' }}
              />
              <Area type="monotone" dataKey="v" stroke="#FFB300" strokeWidth={1.5} fill={`url(#g-${i})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center font-mono text-[10px] tracking-[0.18em] uppercase text-steel/80">
            chart unlocks after a couple of daily captures
          </div>
        )}
      </div>
    </div>
  );
}

export default function InstagramPanel({ delay = 0 }: { delay?: number }) {
  const [accounts, setAccounts] = useState<IgAccount[]>(() => getInstagram());

  useEffect(() => {
    const sync = () => setAccounts(getInstagram());
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    const t = setInterval(sync, 4000);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      clearInterval(t);
    };
  }, []);

  return (
    <Panel num="05" title="Instagram" tag="REACH" delay={delay}>
      <div className="overflow-y-auto h-full">
        {accounts.length === 0 && (
          <div className="font-mono text-[12px] text-steel">
            No accounts. Add one in Settings → Instagram.
          </div>
        )}
        {accounts.map((a, i) => <Row key={a.handle} a={a} i={i} />)}
      </div>
    </Panel>
  );
}
