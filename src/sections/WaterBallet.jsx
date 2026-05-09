import { motion } from "framer-motion";
import SectionHeading from "../components/SectionHeading.jsx";
import { Music, ChevronRight } from "../components/Icons.jsx";
import { BALLET } from "../data/content.js";

export default function WaterBallet() {
  return (
    <section id="ballet" className="relative overflow-hidden py-24 md:py-32 bg-navy">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,_#0e4d8c_0%,_#0a1628_70%)] opacity-90" />
      <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-aqua/10 blur-3xl -z-10" />
      <div className="absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-gold/10 blur-3xl -z-10" />

      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid items-end gap-10 md:grid-cols-2">
          <SectionHeading
            align="left"
            eyebrow="Water Ballet"
            title="Artistry, strength, synchrony — for girls and women"
            subtitle="A discipline of grace and precision. Our water ballet program celebrates expression and elite conditioning, set to music."
          />
          <p className="text-white/60 max-w-md md:justify-self-end">
            Designed for girls and adult women, our four-tier ballet curriculum rises from foundational
            sculling to full performance choreography.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {BALLET.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 transition hover:-translate-y-1 hover:border-gold/40"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold ring-1 ring-gold/30">
                  <Music className="h-5 w-5" />
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-white/70">
                  {b.level}
                </span>
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold text-white">{b.title}</h3>
              <p className="mt-2 min-h-[3.5rem] text-sm text-white/60">{b.desc}</p>
              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs">
                <span className="text-white/50">Duration</span>
                <span className="font-medium text-aqua-light">{b.duration}</span>
              </div>
              <button className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-gold transition group-hover:gap-2">
                Learn more <ChevronRight className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
