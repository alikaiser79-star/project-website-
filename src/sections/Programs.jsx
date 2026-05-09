import { motion } from "framer-motion";
import SectionHeading from "../components/SectionHeading.jsx";
import { ChevronRight, Drop, Trophy, Heart, Sparkle } from "../components/Icons.jsx";
import { PROGRAMS } from "../data/content.js";

const ICON_MAP = { Drop, Trophy, Heart, Sparkle };

export default function Programs() {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  return (
    <section id="programs" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          eyebrow="Swim Programs"
          title="Programs designed for every stroke of progress"
          subtitle="From a child's first kick to a competitive finish, find the right path through the water."
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
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:border-aqua/40 hover:bg-white/[0.06]"
              >
                <div className={`absolute inset-x-0 -top-24 h-48 bg-gradient-to-b ${p.accent} opacity-0 blur-3xl transition group-hover:opacity-100`} />
                <div className="relative flex flex-col gap-5">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-aqua/20 to-ocean/20 text-aqua ring-1 ring-aqua/30">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div>
                    <span className="inline-block rounded-full border border-white/10 px-3 py-0.5 text-[10px] uppercase tracking-widest text-white/60">
                      {p.age}
                    </span>
                    <h3 className="mt-3 font-display text-xl font-semibold text-white">{p.title}</h3>
                    <p className="mt-2 text-sm text-white/60">{p.desc}</p>
                  </div>
                  <button onClick={() => scrollTo("booking")} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-aqua transition group-hover:gap-2">
                    Reserve a spot <ChevronRight className="h-4 w-4" />
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
