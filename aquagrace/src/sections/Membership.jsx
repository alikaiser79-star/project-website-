import { useState } from "react";
import { motion } from "framer-motion";
import SectionHeading from "../components/SectionHeading.jsx";
import { Check, Sparkle, Heart, Users, Star } from "../components/Icons.jsx";
import { TIERS } from "../data/content.js";
import { useUI } from "../context/UIContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

export default function Membership() {
  const { openSignup } = useUI();
  const { isAuthed, updateUser } = useAuth();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState("monthly"); // 'monthly' | 'annual'

  const choose = (tier) => {
    if (!isAuthed) return openSignup();
    updateUser({ tier: tier.name });
    navigate("/membership");
  };

  const annual = cycle === "annual";

  return (
    <section id="membership" className="relative py-24 md:py-32">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-lavender/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          eyebrow="Memberships"
          title="Pick the plan that fits her sparkle"
          subtitle="Flexible plans, no long-term contracts. Upgrade, pause or cancel any time — we make it easy for parents."
        />

        {/* Monthly / annual toggle */}
        <div className="mt-10 flex items-center justify-center">
          <div className="relative inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1">
            <button
              onClick={() => setCycle("monthly")}
              className={`relative rounded-full px-5 py-2 text-sm font-semibold transition ${
                !annual ? "text-white" : "text-white/65 hover:text-white"
              }`}
              aria-pressed={!annual}
            >
              {!annual && (
                <motion.span
                  layoutId="cyclePill"
                  className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-blossom to-coral shadow-glow"
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                />
              )}
              Monthly
            </button>
            <button
              onClick={() => setCycle("annual")}
              className={`relative rounded-full px-5 py-2 text-sm font-semibold transition ${
                annual ? "text-white" : "text-white/65 hover:text-white"
              }`}
              aria-pressed={annual}
            >
              {annual && (
                <motion.span
                  layoutId="cyclePill"
                  className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-blossom to-coral shadow-glow"
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                />
              )}
              Annual
              <span className="ml-2 rounded-full bg-sparkle/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-sparkle">
                –2 mo free
              </span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {TIERS.map((t, i) => {
            const displayPrice = annual ? Math.round(t.annualPrice / 12) : t.price;
            const periodLabel = annual ? "/mo, billed yearly" : "/month";
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={`relative flex flex-col rounded-3xl border p-7 transition ${
                  t.featured
                    ? "border-blossom/60 bg-gradient-to-b from-blossom/15 via-lavender/10 to-transparent shadow-glow lg:-translate-y-3"
                    : "border-white/15 bg-white/[0.04] hover:border-blossom/30"
                }`}
              >
                {t.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blossom to-coral px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white shadow-md">
                    <Sparkle className="mr-1 inline h-3 w-3" /> Most Loved
                  </span>
                )}

                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-2xl font-semibold text-white">{t.name}</h3>
                  <span className="text-xs uppercase tracking-widest text-white/55">Plan</span>
                </div>
                <p className="mt-1 text-sm text-white/70">{t.blurb}</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <motion.span
                    key={`${t.id}-${cycle}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="font-display text-5xl font-semibold text-white"
                  >
                    ${displayPrice}
                  </motion.span>
                  <span className="text-white/65">{periodLabel}</span>
                </div>
                {annual && (
                  <p className="mt-1 text-xs text-blossom">
                    ${t.annualPrice}/year · save ${t.price * 12 - t.annualPrice}
                  </p>
                )}

                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-white/85">
                      <span className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full ${t.featured ? "bg-gradient-to-br from-blossom to-coral text-white" : "bg-white/10 text-blossom"}`}>
                        <Check className="h-3 w-3" />
                      </span>
                      {f}
                    </li>
                  ))}
                  {annual && (
                    <li className="flex items-start gap-2.5 text-sparkle">
                      <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-sparkle/20 text-sparkle">
                        <Heart className="h-3 w-3" />
                      </span>
                      Two months free with annual billing
                    </li>
                  )}
                </ul>

                <button
                  onClick={() => choose(t)}
                  className={`mt-8 w-full ${t.featured ? "btn-primary" : "btn-outline"}`}
                >
                  {t.cta}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Family Plan card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="mt-10 grid gap-6 overflow-hidden rounded-[2rem] border border-sparkle/30 bg-gradient-to-br from-sparkle/10 via-blossom/10 to-lavender/10 p-6 md:grid-cols-5 md:p-10"
        >
          <div className="md:col-span-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-sparkle/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-sparkle">
              <Star className="h-3.5 w-3.5" /> New · Family Plan
            </span>
            <h3 className="mt-4 font-display text-3xl font-semibold text-white md:text-4xl">
              All the sparkle, for the whole family
            </h3>
            <p className="mt-3 text-white/80">
              One plan covers up to <span className="font-semibold text-sparkle">four members</span> — any
              combination of girls and adults. Includes everything in Shimmer for each member, plus a
              shared family lounge pass and priority showcase seating.
            </p>

            <ul className="mt-5 grid gap-2 text-sm text-white/85 sm:grid-cols-2">
              {[
                "Up to 4 members (girls + adults)",
                "Each gets Shimmer-level access",
                "Shared family lounge pass",
                "Priority showcase seating",
                "Sibling skill-tracker view",
                "Cancel any time, no fees",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-gradient-to-br from-blossom to-coral text-white">
                    <Check className="h-3 w-3" />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2">
            <div className="rounded-3xl border border-white/15 bg-navy-soft/70 p-6 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blossom to-coral text-white shadow-glow">
                  <Users className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blossom">Family</p>
                  <p className="font-display text-lg font-semibold text-white">Plan</p>
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-5xl font-bold text-white">$429</span>
                <span className="text-white/65">/month</span>
              </div>
              <p className="mt-1 text-xs text-sparkle">
                Save up to ${149 * 4 - 429}/mo vs four individual Shimmer plans
              </p>

              <button onClick={() => choose({ name: "Family" })} className="btn-primary mt-5 w-full">
                <Heart className="h-4 w-4" /> Start Family Plan
              </button>
              <p className="mt-3 text-center text-[10px] text-white/55">
                Want more than 4 members? Email us — we'll build a custom plan.
              </p>
            </div>
          </div>
        </motion.div>

        <p className="mt-8 text-center text-xs text-white/55">
          Prices in USD. Sibling discounts also available on individual plans — ask at signup.
        </p>
      </div>
    </section>
  );
}
