import { motion } from "framer-motion";
import SectionHeading from "../components/SectionHeading.jsx";
import { Shield, LifeBuoy, Users, Sparkle, Check } from "../components/Icons.jsx";
import { SAFER } from "../data/content.js";

const ICONS = [Shield, LifeBuoy, Users, Sparkle, Check];

export default function Safety() {
  return (
    <section id="safety" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          eyebrow="Safety"
          title="The S.A.F.E.R. Swimmer Promise"
          subtitle="Five non-negotiable pillars that protect every member of the AquaGrace community."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {SAFER.map((s, i) => {
            const Icon = ICONS[i] || Shield;
            return (
              <motion.div
                key={s.letter}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-aqua/40 hover:bg-white/[0.06]"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-aqua/10 ring-1 ring-aqua/30 text-aqua">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-4xl font-semibold text-aqua">{s.letter}</span>
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-white">{s.word}</h3>
                <p className="mt-2 text-sm text-white/60">{s.desc}</p>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-12 rounded-2xl border border-aqua/20 bg-gradient-to-r from-aqua/10 via-aqua/5 to-transparent p-6 md:p-8">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-display text-xl font-semibold text-white">Read the full safety covenant</h3>
              <p className="mt-1 text-sm text-white/60">
                The complete S.A.F.E.R. document outlines our incident protocols, audit cadence and
                family communication standards.
              </p>
            </div>
            <a href="#contact" className="btn-outline">Request the document</a>
          </div>
        </div>
      </div>
    </section>
  );
}
