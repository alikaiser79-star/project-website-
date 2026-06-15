import { Link } from "react-router-dom";
import { Sparkle, ChevronRight, Heart } from "../components/Icons.jsx";
import { useUI } from "../context/UIContext.jsx";

export default function NotFound() {
  const { openLevelFinder } = useUI();
  return (
    <main className="relative isolate min-h-screen overflow-hidden pt-28 md:pt-36">
      <div className="absolute inset-0 -z-20 bg-dreamy-night" />
      <div className="absolute inset-0 -z-10 sparkle-bg opacity-60" />

      {/* floating sparkles */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {[
          { left: "8%", top: "12%", size: 18, delay: 0 },
          { left: "84%", top: "18%", size: 14, delay: 0.6 },
          { left: "18%", top: "70%", size: 20, delay: 1.2 },
          { left: "78%", top: "62%", size: 22, delay: 1.8 },
          { left: "48%", top: "8%", size: 12, delay: 0.4 },
        ].map((s, i) => (
          <span
            key={i}
            className="absolute animate-twinkle text-sparkle"
            style={{ left: s.left, top: s.top, fontSize: s.size, animationDelay: `${s.delay}s` }}
          >
            ✦
          </span>
        ))}
      </div>

      <div className="relative mx-auto grid max-w-5xl items-center gap-12 px-4 pb-32 md:grid-cols-2 md:px-8">
        <div>
          <span className="eyebrow inline-flex items-center gap-2">
            <Sparkle className="h-3.5 w-3.5" /> Lost in the deep end
          </span>
          <h1 className="mt-4 font-display text-7xl font-bold leading-none md:text-8xl">
            <span className="gradient-text">404</span>
          </h1>
          <h2 className="mt-3 font-display text-3xl font-semibold text-white md:text-4xl">
            This page swam away.
          </h2>
          <p className="mt-3 max-w-lg text-white/75">
            We can't find what you're looking for — but the rest of the magic is still here.
            Try one of these to get back on course.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/" className="btn-primary">
              <Heart className="h-4 w-4" /> Back to the home pool
            </Link>
            <button onClick={openLevelFinder} className="btn-outline">
              Try the Level Finder <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 text-sm sm:max-w-md">
            {[
              { to: "/", id: "ballet", label: "Water Ballet" },
              { to: "/", id: "adults", label: "For Adults" },
              { to: "/", id: "schedule", label: "Weekly Schedule" },
              { to: "/", id: "faq", label: "Common Questions" },
            ].map((q) => (
              <Link
                key={q.label}
                to={`/#${q.id}`}
                className="group inline-flex items-center justify-between rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-white/85 transition hover:border-blossom/40 hover:bg-blossom/10"
              >
                {q.label}
                <ChevronRight className="h-4 w-4 text-blossom transition group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </div>

        {/* Visual */}
        <div className="relative mx-auto w-full max-w-sm">
          <div className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-girl-gradient opacity-30 blur-3xl" />
          <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-white/15 bg-gradient-to-br from-blossom/20 via-lavender/15 to-navy">
            <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
              {/* spiral pool ripples */}
              {[40, 70, 100, 140, 180].map((r) => (
                <circle key={r} cx="200" cy="220" r={r} fill="none" stroke="#f9a8d4" strokeOpacity={0.35 - r / 600} />
              ))}
              {/* lost swimmer */}
              <g transform="translate(200,220)">
                <ellipse cx="0" cy="0" rx="20" ry="20" fill="#fff" opacity="0.95" />
                <path d="M-18 -2 Q-40 -25 -52 -55" stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" />
                <path d="M18 -2 Q40 -25 52 -55" stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" />
                <ellipse cx="0" cy="18" rx="34" ry="9" fill="#f9a8d4" opacity="0.9" />
                <ellipse cx="0" cy="18" rx="26" ry="6" fill="#fde68a" opacity="0.9" />
              </g>
              {/* question mark of sparkles */}
              <g fill="#fde68a">
                <circle cx="280" cy="90" r="3" />
                <circle cx="295" cy="105" r="3.5" />
                <circle cx="305" cy="125" r="3" />
                <circle cx="300" cy="148" r="3" />
                <circle cx="290" cy="170" r="3" />
                <circle cx="290" cy="200" r="4" />
              </g>
            </svg>
            <div className="absolute bottom-3 left-3 rounded-full bg-navy/80 px-3 py-1 text-[10px] uppercase tracking-widest text-white/70">
              Imagery placeholder · lost mermaid
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
