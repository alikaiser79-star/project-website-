import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X, Sparkle, ChevronRight, ChevronLeft, Check, Heart } from "./Icons.jsx";
import { useUI } from "../context/UIContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const QUESTIONS = [
  {
    id: "audience",
    prompt: "Who's the class for?",
    options: [
      { id: "g6_8", label: "A girl aged 6–8", hint: "Tiny Swans territory" },
      { id: "g9_11", label: "A girl aged 9–11", hint: "Junior Mermaids age" },
      { id: "g12_14", label: "A girl aged 12–14", hint: "Rising Stars age" },
      { id: "g15_16", label: "A girl aged 15–16", hint: "Elite Corps age" },
      { id: "adult", label: "An adult (me!)", hint: "Adult programs" },
      { id: "family", label: "A toddler with parent", hint: "Mom & Me" },
    ],
  },
  {
    id: "experience",
    prompt: "How comfortable are they in the water?",
    options: [
      { id: "new", label: "Brand new — never tried", hint: "We start gently" },
      { id: "some", label: "A little — can float", hint: "Comfortable in shallow water" },
      { id: "confident", label: "Confident — can swim laps", hint: "Ready for technique" },
      { id: "advanced", label: "Advanced — competitive background", hint: "Skip to performance" },
    ],
  },
  {
    id: "goal",
    prompt: "What feels most exciting?",
    options: [
      { id: "ballet", label: "Water ballet & performance", hint: "Music, routines, showcases" },
      { id: "stroke", label: "Strong strokes & technique", hint: "Build skill and stamina" },
      { id: "fitness", label: "Joint-friendly fitness", hint: "Move, breathe, feel good" },
      { id: "fun", label: "Fun, friends & confidence", hint: "Splash and giggle together" },
    ],
  },
];

// Decide which class to recommend from the picked answers.
function recommend({ audience, experience, goal }) {
  if (audience === "family") return PICKS["mom-me"];
  if (audience === "adult") {
    if (goal === "ballet") return PICKS["adult-ballet"];
    if (goal === "fitness") return PICKS["aqua-fit"];
    return PICKS["adult-swim"];
  }
  // Girls' tiers — start from the age bucket.
  const baseByAudience = {
    g6_8: PICKS["tiny"],
    g9_11: PICKS["junior"],
    g12_14: PICKS["rising"],
    g15_16: PICKS["elite"],
  };
  let pick = baseByAudience[audience] || PICKS["tiny"];

  // Brand-new + older girl → start one tier lower so it feels safe.
  if (experience === "new" && (audience === "g12_14" || audience === "g15_16")) {
    pick = { ...PICKS["splash"], extra: pick.name };
  }
  // Advanced + younger → bump up a tier.
  if (experience === "advanced" && audience === "g6_8") {
    pick = { ...PICKS["junior"], extra: "Tiny Swans" };
  }
  // Stroke-focused goal → recommend Stroke Stars in addition.
  if (goal === "stroke") return { ...PICKS["stroke"], extra: pick.name };
  return pick;
}

const PICKS = {
  tiny: {
    id: "tiny",
    name: "Tiny Swans",
    age: "Ages 6–8",
    summary: "A gentle, sparkly first step into water ballet. Floats, smiles and starlight choreography.",
    cta: "Join Tiny Swans",
    color: "from-lavender/40 via-blossom/30 to-sparkle/20",
  },
  junior: {
    id: "junior",
    name: "Junior Mermaids",
    age: "Ages 9–11",
    summary: "Where grace truly begins — figures, eggbeater, music counts and a costumed showcase.",
    cta: "Join Junior Mermaids",
    color: "from-blossom/40 via-coral/30 to-lavender/30",
  },
  rising: {
    id: "rising",
    name: "Rising Stars",
    age: "Ages 12–14",
    summary: "Pre-competitive artistry with a real team identity, lifts and regional showcases.",
    cta: "Join Rising Stars",
    color: "from-coral/40 via-blossom/30 to-aqua/30",
  },
  elite: {
    id: "elite",
    name: "Elite Corps",
    age: "Ages 15–16",
    summary: "Competition-ready choreography, elite conditioning and leadership opportunities.",
    cta: "Join Elite Corps",
    color: "from-aqua/40 via-lavender/30 to-coral/30",
  },
  splash: {
    id: "splash",
    name: "Splash & Smile Lessons",
    age: "Beginner-friendly",
    summary: "A confidence-first foundation for swimmers new to the water. You can move into your tier whenever she's ready.",
    cta: "Start with Splash & Smile",
    color: "from-blossom/40 to-lavender/30",
  },
  stroke: {
    id: "stroke",
    name: "Stroke Stars Clinics",
    age: "Ages 10+",
    summary: "Refine technique, race smart and shine in friendly meets — built for rising swimmers.",
    cta: "Join Stroke Stars",
    color: "from-coral/40 to-sparkle/30",
  },
  "mom-me": {
    id: "mom-me",
    name: "Mom & Me Swim",
    age: "Ages 2–5 + parent",
    summary: "A gentle weekend session with songs, splashes and first floats — guided by a coach.",
    cta: "Join Mom & Me",
    color: "from-sparkle/40 via-blossom/20 to-aqua/20",
  },
  "adult-ballet": {
    id: "adult-ballet",
    name: "Adult Water Ballet",
    age: "Adults",
    summary: "Elegant artistry meets serious conditioning — no prior experience needed.",
    cta: "Join Adult Water Ballet",
    color: "from-blossom/40 via-lavender/30 to-coral/30",
  },
  "aqua-fit": {
    id: "aqua-fit",
    name: "Aqua Fitness",
    age: "Adults",
    summary: "Joint-friendly conditioning set to music — full-body workouts that feel like dancing.",
    cta: "Join Aqua Fitness",
    color: "from-aqua/40 via-lavender/30 to-blossom/30",
  },
  "adult-swim": {
    id: "adult-swim",
    name: "Adult Swim Lessons",
    age: "Adults",
    summary: "Small-group lessons for adults learning to swim or refining strokes — judgement-free and warm.",
    cta: "Join Adult Swim Lessons",
    color: "from-coral/40 via-sparkle/20 to-lavender/30",
  },
};

export default function LevelFinder() {
  const { levelFinderOpen, closeLevelFinder, openSignup } = useUI();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    if (!levelFinderOpen) {
      setStep(0);
      setAnswers({});
      return;
    }
    const onKey = (e) => e.key === "Escape" && closeLevelFinder();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [levelFinderOpen, closeLevelFinder]);

  const showResult = step >= QUESTIONS.length;
  const total = QUESTIONS.length;
  const progress = Math.min(100, ((showResult ? total : step) / total) * 100);

  const pick = (qid, oid) => {
    setAnswers((a) => ({ ...a, [qid]: oid }));
    setStep((s) => s + 1);
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  const result = showResult ? recommend(answers) : null;

  const claim = () => {
    closeLevelFinder();
    if (isAuthed) navigate("/portal");
    else openSignup();
  };

  return (
    <AnimatePresence>
      {levelFinderOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button onClick={closeLevelFinder} aria-label="Close" className="absolute inset-0 bg-navy/85 backdrop-blur-md" />
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-white/15 bg-navy-soft shadow-card"
          >
            <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-blossom/30 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-lavender/25 blur-3xl" />

            <button
              onClick={closeLevelFinder}
              className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative p-7 md:p-8">
              {/* Header + progress */}
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-blossom">
                <Sparkle className="h-3.5 w-3.5" /> Level Finder
              </div>
              <h2 className="mt-2 font-display text-3xl font-semibold text-white">
                {showResult ? "Your sparkle match" : "Find her perfect class"}
              </h2>
              {!showResult && (
                <p className="mt-1 text-sm text-white/65">
                  Three quick questions — about 90 seconds.
                </p>
              )}

              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-blossom via-coral to-sparkle"
                />
              </div>

              {/* Body */}
              <div className="mt-6 min-h-[260px]">
                <AnimatePresence mode="wait">
                  {!showResult ? (
                    <motion.div
                      key={`q-${step}`}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.25 }}
                    >
                      <p className="text-[11px] font-bold uppercase tracking-widest text-sparkle">
                        Question {step + 1} of {total}
                      </p>
                      <h3 className="mt-1 font-display text-xl font-semibold text-white">
                        {QUESTIONS[step].prompt}
                      </h3>
                      <div className="mt-5 grid gap-2.5">
                        {QUESTIONS[step].options.map((o) => (
                          <button
                            key={o.id}
                            onClick={() => pick(QUESTIONS[step].id, o.id)}
                            className="group flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-blossom/50 hover:bg-blossom/10"
                          >
                            <span>
                              <span className="block font-semibold text-white">{o.label}</span>
                              <span className="block text-xs text-white/60">{o.hint}</span>
                            </span>
                            <ChevronRight className="h-4 w-4 text-blossom transition group-hover:translate-x-1" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35 }}
                    >
                      <div className={`relative overflow-hidden rounded-3xl border border-white/15 p-6 bg-gradient-to-br ${result.color}`}>
                        <div className="pointer-events-none absolute -top-10 -right-6 text-3xl text-sparkle animate-twinkle">✦</div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-white">
                          We recommend
                        </p>
                        <h3 className="mt-1 font-display text-3xl font-semibold text-white">
                          {result.name}
                        </h3>
                        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-white/90">
                          {result.age}
                        </p>
                        <p className="mt-3 text-sm text-white/95">{result.summary}</p>
                        {result.extra && (
                          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                            <Check className="h-3.5 w-3.5" /> Smooth path up to {result.extra} when she's ready
                          </p>
                        )}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button onClick={claim} className="btn-primary">
                          <Heart className="h-4 w-4" /> {isAuthed ? "Book a free trial" : "Claim her free trial"}
                        </button>
                        <button
                          onClick={() => { setStep(0); setAnswers({}); }}
                          className="btn-outline"
                        >
                          Start over
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer nav */}
              <div className="mt-6 flex items-center justify-between text-xs text-white/55">
                {!showResult && step > 0 ? (
                  <button onClick={back} className="inline-flex items-center gap-1 hover:text-white">
                    <ChevronLeft className="h-3.5 w-3.5" /> Back
                  </button>
                ) : (
                  <span />
                )}
                <span>Your answer never leaves your browser.</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
