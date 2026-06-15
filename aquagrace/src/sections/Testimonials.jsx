import { motion } from "framer-motion";
import SectionHeading from "../components/SectionHeading.jsx";
import { Heart, Star } from "../components/Icons.jsx";
import { TESTIMONIALS } from "../data/content.js";

export default function Testimonials() {
  return (
    <section id="testimonials" className="relative py-24 md:py-32">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-lavender/10 to-transparent" />
      <div className="absolute -top-20 right-10 text-3xl text-sparkle animate-twinkle">✦</div>
      <div className="absolute bottom-10 left-10 text-3xl text-blossom animate-twinkle" style={{ animationDelay: "1.2s" }}>★</div>

      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          eyebrow="From our families"
          title="Voices from the pool deck"
          subtitle="What girls and parents say after a season at AquaGrace — in their own words."
        />

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {TESTIMONIALS.map((t, i) => (
            <motion.figure
              key={t.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className="group relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04] p-7 transition hover:-translate-y-1 hover:border-blossom/40"
            >
              <div className={`absolute inset-x-0 -top-24 h-56 bg-gradient-to-b ${t.color} opacity-50 blur-3xl`} />

              <div className="relative">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blossom/20 to-coral/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blossom">
                    {t.voice === "Parent" ? <Heart className="h-3 w-3" /> : <Star className="h-3 w-3 text-sparkle" />}
                    {t.voice}
                  </span>
                </div>
                <blockquote
                  className="mt-5 font-display text-xl leading-snug text-white md:text-2xl"
                  dangerouslySetInnerHTML={{ __html: `"${t.quote}"` }}
                />
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blossom to-coral text-sm font-bold text-white shadow-glow">
                    {t.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                  </span>
                  <span>
                    <span
                      className="block text-sm font-semibold text-white"
                      dangerouslySetInnerHTML={{ __html: t.name }}
                    />
                    <span className="block text-xs text-white/65">{t.role}</span>
                  </span>
                </figcaption>
              </div>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
