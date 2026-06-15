import { motion } from "framer-motion";
import SectionHeading from "../components/SectionHeading.jsx";
import { COACHES } from "../data/content.js";

export default function About() {
  return (
    <section id="about" className="relative py-24 md:py-32 bg-navy">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-5">
            <SectionHeading
              align="left"
              eyebrow="About AquaGrace"
              title="A magical home for girls who love the water"
              subtitle="Founded in 2013, AquaGrace was built around one simple idea — that every girl who steps into our pool should feel safe, seen and a little bit extraordinary. We pair caring coaches with modern training science to help her bloom."
            />
            <div className="mt-8 grid grid-cols-3 gap-4 text-sm">
              {[
                ["12 yrs", "Established"],
                ["3", "Pools on-site"],
                ["6", "Tournaments / yr"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-2xl border border-white/15 bg-white/[0.04] p-4">
                  <p className="font-display text-2xl font-semibold text-white">{v}</p>
                  <p className="mt-1 text-xs uppercase tracking-widest text-blossom/80">{l}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7">
            <p className="mb-6 text-xs font-bold uppercase tracking-[0.28em] text-blossom">Meet the team</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {COACHES.map((c, i) => (
                <motion.article
                  key={c.name}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.45, delay: i * 0.05 }}
                  className="group overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04] transition hover:border-blossom/40"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-lavender/40 via-blossom/30 to-navy">
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="font-display text-5xl font-semibold text-white/40 transition group-hover:scale-110 group-hover:text-blossom">
                        {c.initials}
                      </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-navy to-transparent" />
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-blossom">{c.role}</p>
                    <h4 className="mt-1 font-display text-lg font-semibold text-white">{c.name}</h4>
                    <p className="mt-0.5 text-sm text-white/60">{c.spec}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
