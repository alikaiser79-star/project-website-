import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Hero from "../sections/Hero.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import { Drop, Trophy, Heart, Shield, Music, Briefcase, ChevronRight, Sparkle } from "../components/Icons.jsx";

const TILES = [
  { to: "/programs", icon: Drop, eyebrow: "Programs", title: "Swim lessons for every age", desc: "From a toddler's first kick to clinic-level training." },
  { to: "/water-ballet", icon: Music, eyebrow: "Water Ballet", title: "Artistry, strength, synchrony", desc: "Four tiers of choreography for girls and women." },
  { to: "/safety", icon: Shield, eyebrow: "Safety", title: "The S.A.F.E.R. Promise", desc: "Five non-negotiable pillars that protect every family." },
  { to: "/membership", icon: Trophy, eyebrow: "Membership", title: "Plans built around real life", desc: "Pause, upgrade or cancel any time. No long contracts." },
  { to: "/about", icon: Heart, eyebrow: "About", title: "Meet our coaches", desc: "Certified, kind and obsessive about technique." },
  { to: "/careers", icon: Briefcase, eyebrow: "Careers", title: "Teach the next generation", desc: "Open roles for coaches, choreographers and lifeguards." },
];

export default function Home() {
  return (
    <main>
      <Hero />
      <ExploreTiles />
      <FamilyCTA />
    </main>
  );
}

function ExploreTiles() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          eyebrow="Explore"
          title="Where would you like to dive in?"
          subtitle="Each section has its own page — quick to load, easy to share with family."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((t, i) => {
            const Icon = t.icon;
            return (
              <motion.div
                key={t.to}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
              >
                <Link
                  to={t.to}
                  className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:border-aqua/40 hover:bg-white/[0.06]"
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-aqua/20 to-ocean/20 text-aqua ring-1 ring-aqua/30">
                    <Icon className="h-6 w-6" />
                  </span>
                  <p className="eyebrow mt-5">{t.eyebrow}</p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-white">{t.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-white/60">{t.desc}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-aqua transition group-hover:gap-2">
                    Visit page <ChevronRight className="h-4 w-4" />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FamilyCTA() {
  return (
    <section className="relative py-20 md:py-24">
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="overflow-hidden rounded-3xl border border-aqua/20 bg-gradient-to-r from-aqua/10 via-ocean/15 to-transparent p-8 md:p-12">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-aqua">
                <Sparkle className="h-3.5 w-3.5" /> Family-friendly · trusted by 500+ parents
              </p>
              <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold text-white">
                Bring the whole family to the water.
              </h2>
              <p className="mt-2 max-w-xl text-white/70">
                Open swim weekends, sibling discounts and a coach-to-swimmer ratio you'll feel safe with.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/booking" className="btn-primary">Book a Trial</Link>
              <Link to="/contact" className="btn-outline">Talk to a coach</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
