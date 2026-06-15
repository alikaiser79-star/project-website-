import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Sparkle, Heart, Star, ChevronRight } from "../components/Icons.jsx";
import { useUI } from "../context/UIContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const STEPS = [
  {
    n: "01",
    icon: Sparkle,
    title: "Find her level",
    desc: "Answer three quick questions and we'll match her — or you — to a class that fits like a glove.",
    action: "Take the 90-sec quiz",
    color: "from-lavender/40 via-blossom/30 to-coral/20",
  },
  {
    n: "02",
    icon: Heart,
    title: "Try a free class",
    desc: "Create a free account and book a complimentary first class from your member portal — no card needed.",
    action: "Claim free trial",
    color: "from-blossom/40 via-coral/30 to-sparkle/20",
  },
  {
    n: "03",
    icon: Star,
    title: "Join the magic",
    desc: "Pick a monthly or annual plan, meet the coaches and the team, and start a sparkle journey she'll remember.",
    action: "See plans",
    color: "from-coral/40 via-sparkle/30 to-blossom/20",
  },
];

export default function HowItWorks() {
  const { openSignup, openLevelFinder } = useUI();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();

  const handleStep = (i) => {
    if (i === 0) return openLevelFinder();
    if (i === 1) {
      if (isAuthed) return navigate("/portal");
      return openSignup();
    }
    document.getElementById("membership")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section id="how" className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 -z-20 bg-gradient-to-b from-navy via-navy-soft/30 to-navy" />
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-72 w-[42rem] rounded-full bg-blossom/10 blur-3xl -z-10" />
      <div className="absolute top-12 right-12 text-3xl text-sparkle animate-twinkle">✦</div>
      <div className="absolute bottom-12 left-12 text-2xl text-blossom animate-twinkle" style={{ animationDelay: "1.4s" }}>★</div>

      <div className="relative mx-auto max-w-7xl px-4 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="eyebrow inline-flex items-center gap-2">
            <Sparkle className="h-3.5 w-3.5" /> How it works
          </span>
          <h2 className="mt-3 font-display text-4xl md:text-5xl font-semibold leading-[1.05] text-white">
            Three sparkly steps to the pool
          </h2>
          <p className="mt-4 text-white/75 md:text-lg">
            From "I'm curious" to "see you Tuesday" — usually in under five minutes.
          </p>
        </div>

        {/* Steps */}
        <div className="relative mt-14 grid gap-6 md:grid-cols-3">
          {/* Connecting dotted line — desktop only */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-[88px] hidden h-px border-t border-dashed border-blossom/30 md:block"
          />

          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.button
                key={s.n}
                type="button"
                onClick={() => handleStep(i)}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04] p-7 text-left transition hover:-translate-y-1 hover:border-blossom/50"
              >
                <div className={`absolute inset-x-0 -top-32 h-64 bg-gradient-to-b ${s.color} opacity-60 blur-3xl transition group-hover:opacity-90`} />

                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-5xl font-bold gradient-text leading-none">{s.n}</span>
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blossom to-coral text-white shadow-glow">
                      <Icon className="h-6 w-6" />
                    </span>
                  </div>

                  <h3 className="mt-6 font-display text-2xl font-semibold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm text-white/75">{s.desc}</p>

                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blossom transition group-hover:gap-2 group-hover:text-coral">
                    {s.action} <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
