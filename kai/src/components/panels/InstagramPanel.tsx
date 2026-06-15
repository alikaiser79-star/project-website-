import Panel from '../Panel';
import { instagram, operator } from '../../kaiConfig';
import { ResponsiveContainer, YAxis, Tooltip, Area, AreaChart } from 'recharts';
import { useCounter } from '../../hooks/useCounter';

function fmt(n: number) { return n.toLocaleString(operator.locale); }

function Row({ a, i }: { a: typeof instagram.accounts[number]; i: number }) {
  const value = useCounter(a.followers, { duration: 1.6, delay: i * 0.15 });
  const data = a.weekly.map((v, idx) => ({ d: idx, v }));
  const start = a.weekly[0], end = a.weekly[a.weekly.length - 1];
  const growth = ((end - start) / start) * 100;

  return (
    <div className="border border-amber/15 rounded p-3 mb-3 last:mb-0">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="font-sans text-bone text-sm">{a.handle}</div>
          <div className="font-mono text-amber text-xl tabular-nums drop-shadow-[0_0_8px_rgba(255,179,0,0.35)]">{fmt(value)}</div>
        </div>
        <div className="font-mono text-[11px] text-ok">+{growth.toFixed(1)}% / 7d</div>
      </div>
      <div className="h-[60px]">
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
      </div>
    </div>
  );
}

export default function InstagramPanel({ delay = 0 }: { delay?: number }) {
  return (
    <Panel num="05" title="Instagram" tag="REACH" delay={delay}>
      <div className="overflow-y-auto h-full">
        {instagram.accounts.map((a, i) => <Row key={a.handle} a={a} i={i} />)}
      </div>
    </Panel>
  );
}
