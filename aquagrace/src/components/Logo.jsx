export default function Logo({ className = "" }) {
  return (
    <a
      href="#top"
      className={`group inline-flex items-center gap-2.5 ${className}`}
      aria-label="Coach Katie — home"
    >
      <span className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-ocean to-aqua text-white shadow-card">
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20c3-3 6-3 9 0s6 3 9 0 6-3 6-3" />
          <path d="M4 25c3-3 6-3 9 0s6 3 9 0 6-3 6-3" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block font-display text-base font-bold text-ink">Coach Katie</span>
        <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-ocean">Swim · Synchro · Maadi</span>
      </span>
    </a>
  );
}
