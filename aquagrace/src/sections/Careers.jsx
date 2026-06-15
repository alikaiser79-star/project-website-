import { motion } from "framer-motion";
import SectionHeading from "../components/SectionHeading.jsx";
import { Briefcase, ChevronRight } from "../components/Icons.jsx";
import { CAREERS } from "../data/content.js";

export default function Careers() {
  return (
    <section id="careers" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          eyebrow="Careers"
          title="Help girls find their sparkle"
          subtitle="We hire coaches who teach with kindness, hold the highest professional standards and remember what it felt like to be a kid in a pool for the first time."
        />

        <div className="mt-12 divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04]">
          {CAREERS.map((j, i) => (
            <motion.div
              key={j.id}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group flex flex-col gap-4 p-6 transition hover:bg-white/[0.05] md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-gradient-to-br from-blossom to-coral text-white shadow-glow">
                  <Briefcase className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-white">{j.title}</h3>
                  <p className="mt-1 max-w-xl text-sm text-white/70">{j.desc}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 uppercase tracking-widest text-white/70">{j.type}</span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 uppercase tracking-widest text-white/70">{j.location}</span>
                  </div>
                </div>
              </div>
              <a href="#contact" className="btn-outline px-5 py-2 text-sm">
                Apply Now <ChevronRight className="h-4 w-4" />
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
