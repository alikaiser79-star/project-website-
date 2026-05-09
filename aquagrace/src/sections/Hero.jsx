import { motion } from "framer-motion";
import { useMemo } from "react";
import { ChevronRight, Calendar, Sparkle } from "../components/Icons.jsx";
import { STATS } from "../data/content.js";

export default function Hero() {
  const bubbles = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        left: `${(i * 7 + Math.random() * 5) % 100}%`,
        size: 6 + Math.random() * 22,
        delay: Math.random() * 9,
        duration: 8 + Math.random() * 7,
        opacity: 0.25 + Math.random() * 0.4,
      })),
    []
  );

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <section id="home" className="relative isolate min-h-screen overflow-hidden pt-28 md:pt-36">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_top,_#0e4d8c_0%,_#0a1628_55%,_#06101e_100%)]" />
      <div className="absolute inset-0 -z-10 opacity-[0.07]" style={{
        backgroundImage:
          "radial-gradient(rgba(202,240,248,0.7) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }} />

      <div className="pointer-events-none absolute inset-0 -z-10">
        {bubbles.map((b, i) => (
          <span
            key={i}
            className="absolute bottom-0 rounded-full bg-aqua-light animate-bubble"
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
            <Sparkle className="h-3.5 w-3.5" /> Where Champions Begin
          </span>
          <h1 className="mt-5 font-display text-5xl md:text-7xl font-semibold leading-[1.02] text-white">
            Swimming with{" "}
            <span className="bg-gradient-to-r from-aqua via-aqua-light to-gold bg-clip-text text-transparent">
              grace
            </span>
            ,<br /> training with purpose.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/70">
            AquaGrace Swimming Academy guides every swimmer — from first kick to first podium — through
            premium coaching, water ballet artistry and a safety promise we live by.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => scrollTo("booking")} className="btn-primary">
              <Calendar className="h-4 w-4" /> Book a Trial
            </button>
            <button onClick={() => scrollTo("programs")} className="btn-outline">
              View Programs <ChevronRight className="h-4 w-4" />
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
                className="border-l border-aqua/30 pl-4"
              >
                <dt className="font-display text-3xl font-semibold text-white">{s.value}</dt>
                <dd className="mt-1 text-xs uppercase tracking-widest text-white/60">{s.label}</dd>
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
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-aqua/30 via-ocean/20 to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-b from-ocean/40 to-navy shadow-card">
        <div className="aspect-[4/5] bg-[linear-gradient(180deg,#0e4d8c_0%,#0a1628_100%)] relative">
          <svg viewBox="0 0 400 500" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#caf0f8" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#00b4d8" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="hg2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00b4d8" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#0e4d8c" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* lane lines */}
            {[80, 160, 240, 320].map((y) => (
              <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#caf0f8" strokeOpacity="0.12" strokeDasharray="6 12" />
            ))}
            {/* swimmer abstract shape */}
            <path d="M40 320 Q140 240 220 280 T380 250" fill="none" stroke="url(#hg)" strokeWidth="3" />
            <path d="M40 360 Q140 280 220 320 T380 290" fill="none" stroke="url(#hg2)" strokeWidth="2" />
            {/* ripple rings */}
            <circle cx="220" cy="200" r="40" fill="none" stroke="#caf0f8" strokeOpacity="0.35" />
            <circle cx="220" cy="200" r="70" fill="none" stroke="#caf0f8" strokeOpacity="0.18" />
            <circle cx="220" cy="200" r="100" fill="none" stroke="#caf0f8" strokeOpacity="0.08" />
            {/* main figure */}
            <g>
              <ellipse cx="220" cy="200" rx="22" ry="22" fill="#caf0f8" />
              <path d="M198 215 Q220 250 250 230" stroke="#caf0f8" strokeWidth="6" fill="none" strokeLinecap="round" />
            </g>
          </svg>
        </div>
        <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/10 bg-navy/80 backdrop-blur-md p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-aqua to-ocean text-navy font-semibold">★</div>
            <div>
              <p className="text-sm font-medium text-white">Certified Olympic-style coaching</p>
              <p className="text-xs text-white/55">Trusted by 500+ families</p>
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
        <path d="M0 100 C240 60 480 140 720 100 C960 60 1200 140 1440 100 L1440 200 L0 200 Z" fill="#0e4d8c" fillOpacity="0.55" />
      </svg>
      <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="absolute bottom-0 left-0 h-full w-[200%] animate-wave opacity-90">
        <path d="M0 120 C240 80 480 160 720 120 C960 80 1200 160 1440 120 L1440 200 L0 200 Z" fill="#0a1628" />
      </svg>
    </div>
  );
}
