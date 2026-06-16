/* Lean inline SVG sparkline — no recharts dep so this stays in the
   main chunk. Pass `values` (chronological) and an optional accent. */

export default function Sparkline({
  values,
  width = 120,
  height = 28,
  color = '#FFB300',
  area = true,
  invert = false,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  area?: boolean;
  invert?: boolean;       // when true, "lower is better" — flips the fill colour
}) {
  if (!values || values.length < 2) {
    /* Building-history placeholder — no synthesised line, just a
       faint axis baseline and a status label. */
    return (
      <div
        className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase text-steel/80"
        style={{ width, height }}
        title="At least 2 daily captures are needed before a trend line."
      >
        <span
          className="inline-block h-px bg-amber/20"
          style={{ width: Math.max(20, width * 0.4) }}
        />
        <span>building history</span>
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const dx = width / (values.length - 1);
  const y = (v: number) => height - ((v - min) / range) * (height - 4) - 2;

  let d = `M 0 ${y(values[0])}`;
  for (let i = 1; i < values.length; i++) {
    d += ` L ${i * dx} ${y(values[i])}`;
  }
  const areaPath = `${d} L ${width} ${height} L 0 ${height} Z`;

  const trendIsUp = values[values.length - 1] > values[0];
  /* When invert (e.g. debt), an *upward* line means "got worse" → red. */
  const lineColor =
    !invert ? color : (trendIsUp ? '#FF5C5C' : '#7AE6A8');

  return (
    <svg width={width} height={height} className="block">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={areaPath} fill={`url(#spark-${color})`} />}
      <path
        d={d}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 3px ${lineColor}80)` }}
      />
      <circle cx={width} cy={y(values[values.length - 1])} r="2" fill={lineColor} />
    </svg>
  );
}
