import { motion } from "framer-motion";
import SectionHeading from "../components/SectionHeading.jsx";
import { Check, Sparkle } from "../components/Icons.jsx";
import { TIERS } from "../data/content.js";
import { useUI } from "../context/UIContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

export default function Membership() {
  const { openSignup } = useUI();
  const { isAuthed, updateUser } = useAuth();
  const navigate = useNavigate();

  const choose = (tier) => {
    if (!isAuthed) return openSignup();
    updateUser({ tier: tier.name });
    navigate("/membership");
  };

  return (
    <section id="membership" className="relative py-24 md:py-32">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-ocean/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          eyebrow="Membership"
          title="Choose the rhythm that fits your goals"
          subtitle="Flexible monthly plans, no long-term contracts. Upgrade, pause or cancel any time."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {TIERS.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={`relative flex flex-col rounded-3xl border p-7 transition ${
                t.featured
                  ? "border-aqua/60 bg-gradient-to-b from-aqua/15 to-aqua/5 shadow-glow lg:-translate-y-3"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25"
              }`}
            >
              {t.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-navy shadow-md">
                  <Sparkle className="mr-1 inline h-3 w-3" /> Most Popular
                </span>
              )}

              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-2xl font-semibold text-white">{t.name}</h3>
                <span className="text-xs uppercase tracking-widest text-white/50">Plan</span>
              </div>
              <p className="mt-1 text-sm text-white/60">{t.blurb}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-5xl font-semibold text-white">${t.price}</span>
                <span className="text-white/60">{t.period}</span>
              </div>

              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-white/80">
                    <span className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full ${t.featured ? "bg-aqua text-navy" : "bg-white/10 text-aqua"}`}>
                      <Check className="h-3 w-3" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => choose(t)}
                className={`mt-8 w-full ${t.featured ? "btn-primary" : "btn-outline"}`}
              >
                {t.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
