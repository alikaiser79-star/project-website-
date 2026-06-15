export default function Logo({ className = "" }) {
  return (
    <a href="#home" className={`group inline-flex items-center gap-2.5 ${className}`} aria-label="AquaGrace home">
      <span className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blossom via-coral to-sparkle shadow-glow">
        <svg viewBox="0 0 32 32" className="h-6 w-6 text-white drop-shadow">
          <path
            fill="currentColor"
            d="M16 4l1.8 4.2L22 10l-4.2 1.8L16 16l-1.8-4.2L10 10l4.2-1.8z"
          />
          <path
            fill="currentColor"
            d="M4 22c3-3 6-3 9 0s6 3 9 0 6-3 6-3v5c-3 0-6 3-9 0s-6-3-9 0-6 3-6 3z"
            opacity="0.85"
          />
        </svg>
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent group-hover:translate-x-full transition-transform duration-700" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-xl font-bold text-white">AquaGrace</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-blossom">Swimming Academy</span>
      </span>
    </a>
  );
}
