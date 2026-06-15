import { motion } from "framer-motion";
import { Music, Sparkle, Heart, Star, Trophy, ChevronRight, Check } from "../components/Icons.jsx";
import { BALLET } from "../data/content.js";
import { useUI } from "../context/UIContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

const TIER_ICONS = { Sparkle, Heart, Star, Trophy };

export default function WaterBallet() {
  const { openSignup } = useUI();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();

  const reserveTier = () => {
    if (isAuthed) navigate("/portal");
    else openSignup();
  };

  return (
    <section id="ballet" className="relative overflow-hidden py-28 md:py-40">
      <div className="absolute inset-0 -z-20 bg-gradient-to-b from-plum/40 via-navy to-navy-soft/60" />
      <div className="absolute inset-0 -z-10 sparkle-bg opacity-40" />
      <div className="absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-blossom/20 blur-3xl -z-10 animate-drift" />
      <div className="absolute -bottom-40 -right-40 h-[34rem] w-[34rem] rounded-full bg-coral/15 blur-3xl -z-10 animate-drift" style={{ animationDelay: "2s" }} />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[22rem] w-[22rem] rounded-full bg-lavender/15 blur-3xl -z-10" />

      <FloatingDecor />

      <div className="relative mx-auto max-w-7xl px-4 md:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <span className="eyebrow inline-flex items-center gap-2">
            <Sparkle className="h-3.5 w-3.5" /> The Heart of AquaGrace
          </span>
          <h2 className="mt-4 font-display text-5xl md:text-7xl font-semibold leading-[1.02] text-white">
            Water Ballet — <br className="hidden md:block" />
            <span className="gradient-text">where grace meets glitter.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80">
            Our flagship program for girls ages 6 to 16. Music. Costumes. Friendships.
            And the unforgettable feeling of moving through water like you're flying.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button onClick={reserveTier} className="btn-primary">
              <Heart className="h-4 w-4" /> Reserve Her Spot
            </button>
            <a href="#programs" className="btn-outline">
              See All Programs <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          <div className="mx-auto mt-10 inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-blossom/30 bg-blossom/10 px-5 py-2.5 text-sm">
            <Music className="h-4 w-4 text-blossom" />
            <span className="text-white/85">Live music · Themed showcases · Costumes designed with the girls</span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="mt-16 grid gap-8 overflow-hidden rounded-[2.5rem] border border-white/15 bg-gradient-to-br from-blossom/15 via-lavender/10 to-coral/15 p-8 md:grid-cols-2 md:p-12"
        >
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-sparkle/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-sparkle">
              <Star className="h-3.5 w-3.5" /> Most Loved Class
            </span>
            <h3 className="mt-4 font-display text-4xl font-semibold text-white md:text-5xl">
              Junior Mermaids
            </h3>
            <p className="mt-3 text-white/80">
              For girls ages 9–11 who are ready to count music, glide with grace and shine in their first
              costumed showcase. It's the season most of our girls say felt like real magic.
            </p>
            <ul className="mt-6 grid gap-2 text-sm text-white/85">
              {[
                "60-minute classes, 2–3 sessions / week",
                "Vertical positions, ballet legs, eggbeater",
                "Counts, musicality and group choreography",
                "Costume night & end-of-term showcase",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-blossom text-navy">
                    <Check className="h-3 w-3" />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={reserveTier} className="btn-primary">
                <Sparkle className="h-4 w-4" /> Join Junior Mermaids
              </button>
            </div>
          </div>
          <FeatureVisual />
        </motion.div>

        <div className="mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="font-display text-3xl md:text-4xl font-semibold text-white">
                Four tiers, one beautiful journey
              </h3>
              <p className="mt-2 max-w-xl text-white/70">
                Every tier is designed to grow with her — building confidence, technique and friendships
                that last well beyond the pool.
              </p>
            </div>
            <span className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-widest text-white/70">
              Ages 6 → 16
            </span>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {BALLET.map((b, i) => {
              const Icon = TIER_ICONS[b.icon] || Sparkle;
              return (
                <motion.article
                  key={b.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="group relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04] p-6 backdrop-blur-sm transition hover:-translate-y-1 hover:border-blossom/50"
                >
                  <div className={`absolute inset-x-0 -top-32 h-64 bg-gradient-to-b ${b.color} opacity-60 blur-3xl transition group-hover:opacity-90`} />

                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blossom to-coral text-white shadow-glow">
                        <Icon className="h-6 w-6" />
                      </span>
                      <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-blossom">
                        {b.level}
                      </span>
                    </div>

                    <h4 className="mt-5 font-display text-2xl font-semibold text-white">{b.title}</h4>
                    <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-sparkle/90">
                      {b.age}
                    </p>

                    <p className="mt-3 text-sm text-white/75 min-h-[5rem]">{b.description}</p>

                    <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                      <Stat label="Class duration" value={b.duration} />
                      <Stat label="Per week" value={b.sessions} />
                    </div>

                    <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-blossom">
                        What she'll learn
                      </p>
                      <ul className="mt-2.5 space-y-1.5 text-xs text-white/80">
                        {b.learn.map((line) => (
                          <li key={line} className="flex items-start gap-1.5">
                            <span className="mt-1 inline-flex h-1.5 w-1.5 flex-none rounded-full bg-coral" />
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      onClick={reserveTier}
                      className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blossom transition group-hover:gap-2 group-hover:text-coral"
                    >
                      Reserve her spot <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>

        <div className="mt-16 grid gap-4 rounded-3xl border border-white/15 bg-white/5 p-6 sm:grid-cols-3 md:p-8">
          <Reassure title="Small classes" desc="Never more than 6 girls per coach." />
          <Reassure title="Same coach all season" desc="Real relationships, steady progress." />
          <Reassure title="Showcase every term" desc="Family, music, sparkle — and applause." />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-white/55">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function Reassure({ title, desc }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-gradient-to-br from-lavender to-blossom text-white">
        <Heart className="h-5 w-5" />
      </span>
      <div>
        <p className="font-display text-lg font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-sm text-white/70">{desc}</p>
      </div>
    </div>
  );
}

function FloatingDecor() {
  const stars = [
    { left: "5%", top: "12%", size: 20, delay: 0 },
    { left: "92%", top: "20%", size: 14, delay: 0.6 },
    { left: "10%", top: "78%", size: 18, delay: 1.2 },
    { left: "88%", top: "70%", size: 22, delay: 1.8 },
    { left: "50%", top: "8%", size: 12, delay: 0.4 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute animate-twinkle text-sparkle"
          style={{ left: s.left, top: s.top, fontSize: s.size, animationDelay: `${s.delay}s` }}
        >
          ✦
        </span>
      ))}
    </div>
  );
}

function FeatureVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-girl-gradient opacity-30 blur-2xl" />
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] border border-white/15 bg-gradient-to-br from-lavender/30 to-blossom/30">
        <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="poolBg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5ee0f0" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <rect width="400" height="300" fill="url(#poolBg)" />

          {[60, 120, 180, 240].map((y) => (
            <path
              key={y}
              d={`M0 ${y} Q100 ${y - 6} 200 ${y} T400 ${y}`}
              fill="none"
              stroke="#cffafe"
              strokeOpacity="0.3"
              strokeDasharray="4 8"
            />
          ))}

          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${100 + i * 90}, 150)`}>
              <ellipse cx="0" cy="0" rx="14" ry="14" fill="#fff" opacity="0.95" />
              <path d="M-12 -3 Q-25 -25 -32 -50" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" />
              <path d="M12 -3 Q25 -25 32 -50" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" />
              <ellipse cx="0" cy="14" rx="22" ry="6" fill="#f9a8d4" opacity="0.85" />
              <ellipse cx="0" cy="14" rx="16" ry="4" fill="#fde68a" opacity="0.85" />
            </g>
          ))}

          <g fill="#fde68a">
            <circle cx="40" cy="40" r="2" />
            <circle cx="370" cy="60" r="3" />
            <circle cx="60" cy="270" r="2" />
            <circle cx="350" cy="250" r="2.5" />
          </g>
        </svg>
        <div className="absolute bottom-3 left-3 rounded-full bg-navy/80 px-3 py-1 text-[10px] uppercase tracking-widest text-white/70">
          Imagery placeholder · synchronized swim formation
        </div>
      </div>
    </div>
  );
}
