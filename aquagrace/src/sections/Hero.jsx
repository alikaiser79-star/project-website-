import { Whatsapp, ChevronRight, Star } from "../components/Icons.jsx";
import { WHATSAPP_URL } from "../data/content.js";

export default function Hero() {
  return (
    <section id="top" className="relative isolate overflow-hidden pt-28 pb-16 sm:pt-32 md:pt-36 md:pb-24">
      {/* Soft aqua wash */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-aqua-pale via-bg to-bg" />
      <div className="absolute -top-32 -right-20 -z-10 h-80 w-80 rounded-full bg-aqua/15 blur-3xl" />
      <div className="absolute -bottom-24 -left-10 -z-10 h-72 w-72 rounded-full bg-coral/10 blur-3xl" />

      <div className="section grid gap-10 md:grid-cols-12 md:items-center">
        <div className="md:col-span-7">
          <span className="eyebrow">Coach Katie · Maadi, Cairo</span>
          <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] text-ink sm:text-5xl md:text-6xl">
            Swimming &amp; synchronized swimming lessons in Maadi —{" "}
            <span className="text-ocean">for kids and adults</span>.
          </h1>
          <p className="mt-5 max-w-xl text-base text-ink-soft sm:text-lg">
            Calm, focused coaching from a Candidate Master of Sports in synchronized swimming.
            Real progress, in a small pool, with a coach who knows your name.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              <Whatsapp className="h-5 w-5" /> Book a free trial
            </a>
            <a
              href="#pricing"
              className="btn-secondary"
            >
              See lesson prices <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm text-ink-soft">
            <Star className="h-4 w-4 fill-current text-coral" />
            <span>Personal approach · Kids of all ages welcome · Free trial lesson</span>
          </div>
        </div>

        <div className="md:col-span-5">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-sm md:max-w-none">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-tr from-aqua/20 via-coral/10 to-transparent blur-2xl" />

      {/* Photo placeholder card */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
        <div className="relative aspect-[4/5] bg-gradient-to-b from-aqua-pale via-aqua-pale/60 to-surface">
          <svg viewBox="0 0 400 500" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="waterFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
                <stop offset="100%" stopColor="#0e7490" stopOpacity="0.55" />
              </linearGradient>
            </defs>
            {/* lane lines */}
            {[120, 200, 280, 360].map((y) => (
              <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#0e7490" strokeOpacity="0.10" strokeDasharray="6 12" />
            ))}
            {/* coach silhouette */}
            <g>
              {/* head */}
              <circle cx="200" cy="170" r="34" fill="#0e7490" opacity="0.85" />
              {/* shoulders/torso */}
              <path d="M120 320 Q200 230 280 320 L280 360 Q200 320 120 360 Z" fill="#0e7490" opacity="0.9" />
              {/* water surface */}
              <rect x="0" y="360" width="400" height="140" fill="url(#waterFade)" />
              {/* ripples */}
              <path d="M0 380 Q80 372 160 380 T 320 380 T 480 380" fill="none" stroke="#cffafe" strokeOpacity="0.7" strokeWidth="2" />
              <path d="M0 410 Q80 402 160 410 T 320 410 T 480 410" fill="none" stroke="#cffafe" strokeOpacity="0.5" strokeWidth="2" />
              <path d="M0 440 Q80 432 160 440 T 320 440 T 480 440" fill="none" stroke="#cffafe" strokeOpacity="0.35" strokeWidth="2" />
            </g>
          </svg>
          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-ocean shadow-card backdrop-blur">
            Photo of Katie · placeholder
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="font-display text-base font-semibold text-ink">Coach Katie</p>
            <p className="text-xs text-ink-soft">CMS · Synchronized swimming</p>
          </div>
          <span className="rounded-full bg-aqua-pale px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-ocean">
            Now booking
          </span>
        </div>
      </div>
    </div>
  );
}
