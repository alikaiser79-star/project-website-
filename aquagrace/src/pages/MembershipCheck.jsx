import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext.jsx";
import { TIERS } from "../data/content.js";
import { Check, CreditCard, Sparkle } from "../components/Icons.jsx";

export default function MembershipCheck() {
  const { user, isAuthed, updateUser } = useAuth();
  const navigate = useNavigate();
  if (!isAuthed) return <Navigate to="/" replace />;

  const remaining = Math.max(0, user.sessionsTotal - user.sessionsUsed);
  const usedPct = Math.min(100, Math.round((user.sessionsUsed / Math.max(1, user.sessionsTotal)) * 100));
  const currentTier = TIERS.find((t) => t.name === user.tier) || TIERS[0];

  const change = (tier) => {
    const sessionsTotal = tier.id === "basic" ? 8 : tier.id === "pro" ? 16 : 32;
    updateUser({ tier: tier.name, sessionsTotal });
  };

  return (
    <main className="pt-28 md:pt-32 pb-20">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Membership</p>
            <h1 className="mt-2 font-display text-4xl md:text-5xl font-semibold text-white">My Membership</h1>
            <p className="mt-2 max-w-xl text-white/60">Track your plan, see what's included and switch tiers any time.</p>
          </div>
          <button onClick={() => navigate("/portal")} className="btn-outline">Back to Portal</button>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-10 grid gap-6 lg:grid-cols-3"
        >
          <div className="lg:col-span-2 rounded-3xl border border-aqua/30 bg-gradient-to-br from-aqua/15 to-transparent p-6 md:p-8">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-aqua">
              <Sparkle className="h-3.5 w-3.5" /> Active plan
            </div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-semibold text-white">{currentTier.name}</h2>
                <p className="mt-1 text-sm text-white/60">${currentTier.price}{currentTier.period} · renews on {user.renewal}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-aqua/15 px-3 py-1 text-xs uppercase tracking-widest text-aqua">Auto-renew</span>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Sessions used</span>
                <span className="font-medium text-white">{user.sessionsUsed} / {user.sessionsTotal}</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${usedPct}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-aqua to-aqua-light"
                />
              </div>
              <p className="mt-2 text-xs text-white/50">{remaining} sessions remaining this cycle</p>
            </div>

            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {currentTier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                  <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-aqua text-navy"><Check className="h-3 w-3" /></span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
            <h3 className="font-display text-xl font-semibold text-white">Payment history</h3>
            {user.payments.length === 0 ? (
              <p className="mt-4 text-sm text-white/60">No invoices yet — your first charge will appear here.</p>
            ) : (
              <ul className="mt-4 divide-y divide-white/10 text-sm">
                {user.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-3">
                    <span className="flex items-center gap-2.5 text-white/80">
                      <CreditCard className="h-4 w-4 text-aqua" /> {p.id}
                    </span>
                    <span className="text-white/55">{p.date}</span>
                    <span className="font-medium text-white">${p.amount}</span>
                    <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-300">{p.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.section>

        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold text-white">Change your plan</h2>
          <p className="mt-1 text-sm text-white/60">Upgrades start immediately, downgrades start at next renewal.</p>
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {TIERS.map((t) => {
              const isCurrent = t.name === user.tier;
              return (
                <div
                  key={t.id}
                  className={`flex flex-col rounded-3xl border p-6 transition ${
                    isCurrent ? "border-aqua/50 bg-aqua/10" : "border-white/10 bg-white/[0.03] hover:border-white/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-semibold text-white">{t.name}</h3>
                    {isCurrent && <span className="rounded-full bg-aqua/20 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-aqua">Current</span>}
                  </div>
                  <p className="mt-3 font-display text-3xl font-semibold text-white">${t.price}<span className="text-sm font-normal text-white/60">{t.period}</span></p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-white/75">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 flex-none text-aqua" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => change(t)}
                    disabled={isCurrent}
                    className={`mt-6 w-full ${isCurrent ? "btn-outline opacity-60 cursor-not-allowed" : t.featured ? "btn-primary" : "btn-outline"}`}
                  >
                    {isCurrent ? "Current Plan" : t.id === "basic" ? "Downgrade to Basic" : t.id === "elite" ? "Upgrade to Elite" : "Switch to Pro"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
