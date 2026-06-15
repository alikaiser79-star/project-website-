import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import SectionHeading from "../components/SectionHeading.jsx";
import { ChevronRight, Drop, Trophy, Heart, Sparkle } from "../components/Icons.jsx";
import { PROGRAMS } from "../data/content.js";
import { useUI } from "../context/UIContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const ICON_MAP = { Drop, Trophy, Heart, Sparkle };

export default function Programs() {
  const { openSignup } = useUI();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();

  const reserve = () => {
    if (isAuthed) navigate("/portal");
    else openSignup();
  };

  return (
    <section id="programs" className="relative py-24 md:py-32">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-blossom/10 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          eyebrow="More to explore"
          title="Other ways to splash, learn & play"
          subtitle="Beyond water ballet, we run swim lessons, clinics and family events — every program built around kindness, confidence and lots of giggles."
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PROGRAMS.map((p, i) => {
            const Icon = ICON_MAP[p.icon] || Drop;
            return (
              <motion.article
                key={p.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.07, ease: "easeOut" }}
                className="group relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:border-blossom/50 hover:bg-white/[0.06]"
              >
                <div className={`absolute inset-x-0 -top-24 h-48 bg-gradient-to-b ${p.accent} opacity-0 blur-3xl transition group-hover:opacity-100`} />
                <div className="relative flex flex-col gap-5">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blossom to-lavender text-white shadow-glow">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div>
                    <span className="inline-block rounded-full border border-blossom/30 bg-blossom/10 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-blossom">
                      {p.age}
                    </span>
                    <h3 className="mt-3 font-display text-xl font-semibold text-white">{p.title}</h3>
                    <p className="mt-2 text-sm text-white/70">{p.desc}</p>
                  </div>
                  <button
                    onClick={reserve}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blossom transition group-hover:gap-2 group-hover:text-coral"
                  >
                    {isAuthed ? "Book in portal" : "Reserve a spot"} <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
