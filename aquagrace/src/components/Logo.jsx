export default function Logo({ className = "" }) {
  return (
    <a href="#home" className={`group inline-flex items-center gap-2.5 ${className}`} aria-label="AquaGrace home">
      <span className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-aqua to-ocean shadow-glow">
        <svg viewBox="0 0 32 32" className="h-6 w-6 text-navy">
          <path
            fill="currentColor"
            d="M4 20c3-3 6-3 9 0s6 3 9 0 6-3 6-3v6c-3 0-6 3-9 0s-6-3-9 0-6 3-6 3z"
          />
        </svg>
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:translate-x-full transition-transform duration-700" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-lg font-semibold text-white">AquaGrace</span>
        <span className="block text-[10px] uppercase tracking-[0.28em] text-aqua/80">Swimming Academy</span>
      </span>
    </a>
  );
}
