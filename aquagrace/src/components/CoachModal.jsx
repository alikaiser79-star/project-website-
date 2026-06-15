import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkle, Check, Heart } from "./Icons.jsx";

export default function CoachModal({ coach, onClose }) {
  useEffect(() => {
    if (!coach) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [coach, onClose]);

  return (
    <AnimatePresence>
      {coach && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button onClick={onClose} aria-label="Close" className="absolute inset-0 bg-navy/85 backdrop-blur-md" />
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-navy-soft shadow-card"
          >
            <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-blossom/30 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-lavender/25 blur-3xl" />

            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative p-7 md:p-8">
              {/* Portrait + header */}
              <div className="flex items-start gap-5">
                <div className="relative h-24 w-24 flex-none overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-lavender/40 via-blossom/30 to-coral/30 shadow-glow">
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="font-display text-3xl font-bold text-white drop-shadow">
                      {coach.initials}
                    </span>
                  </div>
                  <Sparkle className="absolute right-1.5 top-1.5 h-4 w-4 text-sparkle animate-twinkle" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-blossom">
                    {coach.role}
                  </p>
                  <h2 className="mt-1 font-display text-3xl font-semibold text-white">
                    {coach.name}
                  </h2>
                  <p className="mt-0.5 text-sm text-white/65">{coach.spec}</p>
                </div>
              </div>

              {/* Bio */}
              <p className="mt-6 text-sm leading-relaxed text-white/80">
                {coach.bio}
              </p>

              {/* Years + favorite */}
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blossom">
                    Coaching
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold text-white">
                    {coach.years}
                    <span className="ml-1 text-sm font-normal text-white/65">years</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blossom">
                    Favorite moment
                  </p>
                  <p className="mt-1 inline-flex items-start gap-1.5 text-sm text-white/85">
                    <Heart className="mt-0.5 h-4 w-4 flex-none text-coral" />
                    <span>"{coach.favorite}"</span>
                  </p>
                </div>
              </div>

              {/* Certs */}
              {coach.certs?.length > 0 && (
                <div className="mt-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blossom">
                    Credentials
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {coach.certs.map((c) => (
                      <li
                        key={c}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/85"
                      >
                        <Check className="h-3 w-3 text-blossom" /> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
