import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import PageShell from "../components/PageShell.jsx";
import Membership from "../sections/Membership.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { TIERS } from "../data/content.js";
import { Check, Sparkle, Star } from "../components/Icons.jsx";

export default function MembershipPage() {
  const { user, isAuthed } = useAuth();
  return (
    <PageShell>
      {isAuthed && <CurrentSubscription user={user} />}
      <Membership />
    </PageShell>
  );
}

function CurrentSubscription({ user }) {
  const currentTier = TIERS.find((t) => t.name === user.tier) || TIERS[0];
  const remaining = Math.max(0, user.sessionsTotal - user.sessionsUsed);
  const usedPct = Math.min(100, Math.round((user.sessionsUsed / Math.max(1, user.sessionsTotal)) * 100));

  return (
    <section className="relative pt-12 md:pt-16">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl border border-aqua/30 bg-gradient-to-br from-aqua/15 to-transparent p-6 md:p-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-aqua">
                <Sparkle className="h-3.5 w-3.5" /> Your active plan
              </p>
              <h2 className="mt-2 font-display text-3xl md:text-4xl font-semibold text-white">
                {currentTier.name} membership
              </h2>
              <p className="mt-1 text-sm text-white/60">
                Hi {user.fullName.split(" ")[0]} — you're on the <strong className="text-white">{currentTier.name}</strong> plan ·
                ${currentTier.price}{currentTier.period} · renews on {user.renewal}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/membership/status" className="btn-outline">
                <Star className="h-4 w-4" /> Manage plan
              </Link>
              <Link to="/portal" className="btn-primary">Go to Portal</Link>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Sessions used this cycle</span>
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
              <p className="mt-2 text-xs text-white/50">{remaining} sessions remaining</p>

              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {currentTier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                    <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-aqua text-navy">
                      <Check className="h-3 w-3" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-widest text-white/50">Billing</p>
              <p className="mt-2 font-display text-2xl font-semibold text-white">
                ${currentTier.price}<span className="text-sm font-normal text-white/60">{currentTier.period}</span>
              </p>
              <p className="mt-1 text-xs text-white/50">Auto-renew on {user.renewal}</p>
              <p className="mt-4 text-xs text-white/55">
                Need to upgrade, downgrade or cancel? Use{" "}
                <Link to="/membership/status" className="text-aqua hover:underline">Manage plan</Link>.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
