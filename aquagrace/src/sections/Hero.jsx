import { motion } from "framer-motion";
import { useMemo } from "react";
import { ChevronRight, Sparkle, Star, Heart } from "../components/Icons.jsx";
import { STATS } from "../data/content.js";
import { useUI } from "../context/UIContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

export default function Hero() {
  const { openSignup, openLogin } = useUI();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();

  const sparkles = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => ({
        left: `${(i * 4.5 + Math.random() * 4) % 100}%`,
        top: `${5 + Math.random() * 85}%`,
        size: 6 + Math.random() * 14,
        delay: Math.random() * 3,
        duration: 2 + Math.random() * 3,
      })),
    []
  );

  const bubbles = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        left: `${(i * 7 + Math.random() * 5) % 100}%`,
        size: 8 + Math.random() * 22,
        delay: Math.random() * 9,
        duration: 9 + Math.random() * 7,
        opacity: 0.25 + Math.random() * 0.4,
      })),
    []
  );

  const handlePrimary = () => {
    if (isAuthed) navigate("/portal");
    else openSignup();
  };

  return (
    <section id="home" className="relative isolate min-h-screen overflow-hidden pt-28 md:pt-36">
      <div className="absolute inset-0 -z-20 bg-dreamy-night" />
      <div className="absolute inset-0 -z-10 sparkle-bg opacity-60" />

      <div className="pointer-events-none absolute inset-0 -z-10">
        {sparkles.map((s, i) => (
          <span
            key={i}
            className="absolute animate-twinkle text-sparkle"
            style={{
              left: s.left,
              top: s.top,
              fontSize: s.size,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          >
            ✦
          </span>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 -z-10">
        {bubbles.map((b, i) => (
          <span
            key={i}
            className="absolute bottom-0 rounded-full bg-blossom/40 animate-bubble"
            style={{
              left: b.left,
              width: b.size,
              height: b.size,
              opacity: b.opacity,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
              boxShadow: "inset 0 0 10px rgba(255,255,255,0.6)",
            }}
          />
        ))}
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-32 md:grid-cols-12 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="md:col-span-7"
        >
          <span className="eyebrow inline-flex items-center gap-2">
            <Sparkle className="h-3.5 w-3.5" /> Where Every Girl Shines
          </span>
          <h1 className="mt-5 font-display text-5xl md:text-7xl font-semibold leading-[1.02] text-white">
            Dream big.{" "}
            <span className="gradient-text">Swim graceful.</span>
            <br /> Sparkle bright.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/80">
            AquaGrace is a magical home for girls ages 6–16 who love the water. From your very first
            bubbles to ribbon-winning water-ballet routines — we believe every girl deserves to feel
            graceful, brave and a little bit extraordinary.
          </p>
          <p className="mt-3 max-w-xl text-sm text-white/55">
            <span className="font-semibold text-blossom">Parents</span> — small classes, careful coaches and
            a safety promise we live by every single session. <span className="font-semibold text-blossom">Grown-ups</span>{" "}
            — we have classes for you too.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-sparkle/40 bg-sparkle/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-sparkle">
            <Sparkle className="h-3.5 w-3.5" /> Your first class is always free
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={handlePrimary} className="btn-primary">
              <Heart className="h-4 w-4" /> {isAuthed ? "Open Member Portal" : "Join the Magic"}
            </button>
            {!isAuthed && (
              <button onClick={openLogin} className="btn-outline">
                Member Log In <ChevronRight className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => document.getElementById("ballet")?.scrollIntoView({ behavior: "smooth" })}
              className="btn-ghost"
            >
              <Star className="h-4 w-4 text-sparkle" /> Explore Water Ballet
            </button>
          </div>

          <motion.dl
            className="mt-12 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.4 } } }}
          >
            {STATS.map((s) => (
              <motion.div
                key={s.label}
                variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
                className="rounded-2xl border-l-4 border-blossom/60 bg-white/5 px-4 py-3 backdrop-blur"
              >
                <dt className="font-display text-3xl font-semibold text-white">{s.value}</dt>
                <dd className="mt-1 text-[11px] uppercase tracking-widest text-blossom/90">{s.label}</dd>
              </motion.div>
            ))}
          </motion.dl>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
          className="md:col-span-5"
        >
          <HeroVisual />
        </motion.div>
      </div>

      <Waves />
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto max-w-md">
      <div className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-girl-gradient opacity-40 blur-3xl" />
      <div className="pointer-events-none absolute -top-6 -left-6 text-3xl text-sparkle animate-twinkle">✦</div>
      <div className="pointer-events-none absolute -bottom-4 -right-2 text-4xl text-blossom animate-twinkle" style={{ animationDelay: "1.4s" }}>★</div>
      <div className="pointer-events-none absolute top-1/3 -right-8 text-2xl text-coral animate-twinkle" style={{ animationDelay: "0.8s" }}>✿</div>

      <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-gradient-to-b from-blossom/20 to-navy shadow-card">
        <div className="aspect-[4/5] relative bg-gradient-to-b from-lavender/30 via-blossom/20 to-navy">
          <svg viewBox="0 0 400 500" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f9a8d4" stopOpacity="0.95" />
                <stop offset="50%" stopColor="#fde68a" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="ribbon2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5ee0f0" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="halo" cx="50%" cy="40%" r="50%">
                <stop offset="0%" stopColor="#fde68a" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
              </radialGradient>
            </defs>

            <circle cx="200" cy="200" r="120" fill="url(#halo)" />

            <path d="M30 380 Q120 240 220 300 T380 250" fill="none" stroke="url(#ribbon)" strokeWidth="6" strokeLinecap="round" />
            <path d="M40 420 Q140 300 240 350 T380 320" fill="none" stroke="url(#ribbon2)" strokeWidth="3" />
            <path d="M60 110 Q160 60 240 120 T380 90" fill="none" stroke="url(#ribbon)" strokeWidth="3" opacity="0.7" />

            <circle cx="200" cy="220" r="55" fill="none" stroke="#f9a8d4" strokeOpacity="0.45" />
            <circle cx="200" cy="220" r="85" fill="none" stroke="#c4b5fd" strokeOpacity="0.3" />
            <circle cx="200" cy="220" r="115" fill="none" stroke="#fde68a" strokeOpacity="0.18" />

            <g>
              <ellipse cx="200" cy="220" rx="22" ry="24" fill="#fff" opacity="0.95" />
              <path d="M180 215 Q150 180 140 145" stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" />
              <path d="M220 215 Q250 180 260 145" stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" />
              <path d="M195 240 Q190 290 200 340" stroke="#fff" strokeWidth="9" strokeLinecap="round" fill="none" />
              <path d="M205 240 Q230 280 260 290" stroke="#fff" strokeWidth="9" strokeLinecap="round" fill="none" />
              <ellipse cx="200" cy="245" rx="40" ry="10" fill="#f9a8d4" opacity="0.85" />
              <ellipse cx="200" cy="245" rx="32" ry="7" fill="#fde68a" opacity="0.85" />
            </g>

            <g fill="#fde68a">
              <circle cx="80" cy="80" r="2" />
              <circle cx="320" cy="60" r="2.5" />
              <circle cx="350" cy="180" r="2" />
              <circle cx="60" cy="200" r="2" />
              <circle cx="100" cy="430" r="2.5" />
              <circle cx="320" cy="420" r="2" />
            </g>
          </svg>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-navy via-navy/50 to-transparent" />
        </div>
        <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/15 bg-navy/80 backdrop-blur-md p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-blossom to-coral text-white font-semibold shadow-glow">★</div>
            <div>
              <p className="text-sm font-semibold text-white">Imagery placeholder · girls swimming &amp; water-ballet ribbons</p>
              <p className="text-xs text-white/60">Trusted by 500+ families</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Waves() {
  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 overflow-hidden">
      <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="absolute bottom-0 left-0 h-full w-[200%] animate-wave-slow opacity-60">
        <path d="M0 100 C240 60 480 140 720 100 C960 60 1200 140 1440 100 L1440 200 L0 200 Z" fill="#7c3aed" fillOpacity="0.5" />
      </svg>
      <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="absolute bottom-0 left-0 h-full w-[200%] animate-wave opacity-90">
        <path d="M0 120 C240 80 480 160 720 120 C960 80 1200 160 1440 120 L1440 200 L0 200 Z" fill="#1a0e2e" />
      </svg>
    </div>
  );
}
