import { useMemo } from "react";
import { motion } from "framer-motion";
import { ACHIEVEMENTS, INSPIRATIONS, SHOWCASES } from "../data/content.js";
import { Sparkle, Heart, Music, Star, Trophy, Shield, Users, Calendar, ChevronRight, Check } from "./Icons.jsx";

const ICONS = { Heart, Sparkle, Music, Star, Trophy, Shield, Users };

const RARITY = {
  Common: "from-lavender/50 to-blossom/30 text-white border-blossom/30",
  Rare: "from-blossom/60 to-coral/40 text-white border-coral/40",
  Epic: "from-coral/60 to-sparkle/40 text-navy border-sparkle/50",
  Legendary: "from-sparkle/70 to-blossom/40 text-navy border-sparkle/70",
};

function pickInspiration(seed) {
  // Stable rotation per day so it feels like a "daily message"
  const idx = (seed % INSPIRATIONS.length + INSPIRATIONS.length) % INSPIRATIONS.length;
  return INSPIRATIONS[idx];
}

function nextShowcase() {
  const today = new Date().toISOString().slice(0, 10);
  return SHOWCASES.find((s) => s.date >= today) || SHOWCASES[0];
}

export default function JourneyPanel({ user, onBook, onRsvp }) {
  const earned = useMemo(() => ACHIEVEMENTS.filter((a) => a.earned), []);
  const inProgress = useMemo(() => ACHIEVEMENTS.filter((a) => !a.earned), []);
  const streak = Math.min(12, Math.max(1, Math.floor(user.sessionsUsed * 0.8) || 3));
  const sparklePoints = earned.length * 120 + Math.floor(user.sessionsUsed * 40);
  const next = nextShowcase();
  const showcaseDate = next ? new Date(next.date + "T00:00:00") : null;
  const showcaseDay = showcaseDate?.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const today = new Date();
  const inspiration = pickInspiration(today.getDate() + today.getMonth() * 31);

  return (
    <div className="mt-10 space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-blossom">
            <Sparkle className="mr-1 inline h-3.5 w-3.5" /> Your journey
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
            Sparkle, streaks & skills
          </h2>
        </div>
      </div>

      {/* Top row: Sparkle points + streak + next showcase */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Sparkle Points */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-blossom/30 bg-gradient-to-br from-blossom/20 via-lavender/10 to-transparent p-5"
        >
          <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-blossom/30 blur-3xl" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-blossom">Sparkle points</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-display text-4xl font-bold text-white">{sparklePoints}</span>
            <span className="text-xs text-sparkle">✦</span>
          </div>
          <p className="mt-1 text-xs text-white/65">Earned from sessions and skills</p>
        </motion.div>

        {/* Streak */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="relative overflow-hidden rounded-3xl border border-coral/30 bg-gradient-to-br from-coral/15 via-blossom/10 to-transparent p-5"
        >
          <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-coral/20 blur-3xl" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-coral">Current streak</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-display text-4xl font-bold text-white">{streak}</span>
            <span className="text-xs text-white/65">weeks</span>
          </div>
          <div className="mt-3 flex gap-0.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i < streak ? "bg-gradient-to-r from-blossom to-coral" : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </motion.div>

        {/* Next showcase */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative overflow-hidden rounded-3xl border border-sparkle/30 bg-gradient-to-br from-sparkle/15 via-blossom/10 to-transparent p-5"
        >
          <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-sparkle/20 blur-3xl" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-sparkle">Next showcase</p>
          {next ? (
            <>
              <p className="mt-2 font-display text-lg font-semibold text-white">{next.title}</p>
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-white/75">
                <Calendar className="h-3 w-3 text-sparkle" /> {showcaseDay} · {next.time}
              </p>
              <button
                onClick={onRsvp}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sparkle hover:text-blossom"
              >
                RSVP from showcases <ChevronRight className="h-3 w-3" />
              </button>
            </>
          ) : (
            <p className="mt-2 text-sm text-white/65">No showcases scheduled.</p>
          )}
        </motion.div>
      </div>

      {/* Inspiration of the day */}
      <motion.blockquote
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-r from-blossom/10 via-lavender/5 to-coral/10 p-6 md:p-7"
      >
        <span className="pointer-events-none absolute -top-4 -right-2 text-3xl text-sparkle animate-twinkle">✦</span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-blossom">
          <Sparkle className="mr-1 inline h-3 w-3" /> Inspiration of the day
        </p>
        <p className="mt-2 font-display text-xl leading-snug text-white md:text-2xl">
          "{inspiration}"
        </p>
      </motion.blockquote>

      {/* Achievements grid */}
      <div className="rounded-3xl border border-white/15 bg-white/[0.04] p-6 md:p-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blossom">Achievements</p>
            <h3 className="mt-1 font-display text-xl font-semibold text-white">
              {earned.length} of {ACHIEVEMENTS.length} earned
            </h3>
          </div>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-widest text-white/65">
            Common · Rare · Epic · Legendary
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ACHIEVEMENTS.map((a, i) => {
            const Icon = ICONS[a.icon] || Sparkle;
            const rarityClass = RARITY[a.rarity];
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.04 * i }}
                className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 transition ${
                  a.earned
                    ? rarityClass + " shadow-card"
                    : "from-white/[0.03] to-white/[0.01] text-white/55 border-white/10 grayscale"
                }`}
              >
                {a.earned && (
                  <span className="pointer-events-none absolute right-2 top-2 text-xs text-sparkle animate-twinkle">✦</span>
                )}
                <div className="flex items-start gap-3">
                  <span className={`grid h-10 w-10 flex-none place-items-center rounded-2xl ${a.earned ? "bg-white/20 backdrop-blur" : "bg-white/5"}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                      {a.rarity}
                    </p>
                    <p className="mt-0.5 font-display text-sm font-semibold leading-snug">
                      {a.title}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs opacity-85">{a.desc}</p>
                {a.earned ? (
                  <p className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                    <Check className="h-3 w-3" /> Earned
                  </p>
                ) : (
                  <div className="mt-3">
                    <div className="h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-blossom to-coral"
                        style={{ width: `${Math.round((a.progress || 0) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-white/55">
                      {Math.round((a.progress || 0) * 100)}% progress
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row">
          <p className="text-sm text-white/70">
            <Sparkle className="mr-1.5 inline h-4 w-4 text-sparkle" />
            Book your next session to keep your streak alive.
          </p>
          <button onClick={onBook} className="btn-primary px-5 py-2 text-sm">
            <Heart className="h-4 w-4" /> Book a Session
          </button>
        </div>
      </div>

      {/* Coming-up callout */}
      {inProgress.length > 0 && (
        <div className="rounded-3xl border border-white/15 bg-white/[0.03] p-5 md:p-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blossom">Closest to earning</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {inProgress
              .filter((a) => (a.progress || 0) > 0)
              .sort((a, b) => (b.progress || 0) - (a.progress || 0))
              .slice(0, 2)
              .map((a) => {
                const Icon = ICONS[a.icon] || Sparkle;
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-gradient-to-br from-blossom/30 to-coral/20 text-blossom">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{a.title}</p>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-blossom to-coral"
                          style={{ width: `${Math.round((a.progress || 0) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-blossom">{Math.round((a.progress || 0) * 100)}%</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
