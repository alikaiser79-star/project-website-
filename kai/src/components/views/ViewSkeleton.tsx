/* Skeleton grid shown while a view's chunk loads (§13.1) — panels
   fade in rather than popping in raw. Matches the panel grid so the
   layout doesn't jump when the real panels arrive. */
export default function ViewSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8 items-start" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-lg p-5 skeleton-panel" style={{ animationDelay: `${i * 0.06}s` }}>
          <div className="sk-line sk-title" />
          <div className="sk-line" style={{ width: '62%' }} />
          <div className="sk-line" style={{ width: '90%' }} />
          <div className="sk-line" style={{ width: '48%' }} />
        </div>
      ))}
    </div>
  );
}
