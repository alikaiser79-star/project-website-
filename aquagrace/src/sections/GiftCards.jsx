import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Sparkle, Heart, Star, ChevronRight, Check } from "../components/Icons.jsx";
import { useUI } from "../context/UIContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const AMOUNTS = [
  { value: 50, label: "One class" },
  { value: 150, label: "A month of sparkle", popular: true },
  { value: 400, label: "A full term" },
];

export default function GiftCards() {
  const [amount, setAmount] = useState(150);
  const { openSignup, fireConfetti } = useUI();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();

  const gift = () => {
    fireConfetti();
    if (isAuthed) navigate("/portal");
    else openSignup();
  };

  return (
    <section id="gift" className="relative overflow-hidden py-20 md:py-28">
      <div className="absolute inset-0 -z-20 bg-gradient-to-b from-navy via-plum/10 to-navy" />
      <div className="absolute top-12 left-12 text-3xl text-sparkle animate-twinkle">✦</div>
      <div className="absolute bottom-12 right-12 text-3xl text-blossom animate-twinkle" style={{ animationDelay: "1.2s" }}>★</div>

      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="relative grid items-center gap-10 overflow-hidden rounded-[2.5rem] border border-blossom/30 bg-gradient-to-br from-blossom/15 via-lavender/10 to-coral/15 p-8 md:grid-cols-2 md:p-12"
        >
          <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-blossom/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-coral/15 blur-3xl" />

          {/* Copy */}
          <div className="relative">
            <span className="eyebrow inline-flex items-center gap-2">
              <Sparkle className="h-3.5 w-3.5" /> Gift the magic
            </span>
            <h2 className="mt-3 font-display text-4xl md:text-5xl font-semibold leading-[1.05] text-white">
              Give someone <span className="gradient-text">their own sparkle</span>.
            </h2>
            <p className="mt-4 max-w-md text-white/80">
              Birthday? Adoption day? Just because? Gift a class, a month, or a full term — we'll
              send a beautiful card on the date you choose and the recipient picks the perfect class.
            </p>

            <ul className="mt-5 grid max-w-md gap-2 text-sm text-white/85 sm:grid-cols-2">
              {[
                "Choose any amount",
                "Schedule the send date",
                "Beautiful printable card",
                "Never expires",
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

          {/* Interactive card preview */}
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-girl-gradient opacity-30 blur-3xl" />

            <motion.div
              key={amount}
              initial={{ rotate: -3, opacity: 0, y: 8 }}
              animate={{ rotate: -2, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-blossom/40 via-coral/30 to-sparkle/30 p-6 shadow-card md:p-7"
            >
              <div className="pointer-events-none absolute -top-6 -right-6 text-3xl text-sparkle animate-twinkle">✦</div>
              <div className="pointer-events-none absolute bottom-4 left-6 text-2xl text-white/70 animate-twinkle" style={{ animationDelay: "0.8s" }}>✿</div>

              <div className="flex items-start justify-between">
                <div className="font-display text-lg font-bold text-white">
                  Aqua<span className="text-sparkle">Grace</span>
                </div>
                <span className="rounded-full bg-navy/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur">
                  Gift Card
                </span>
              </div>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-6xl font-bold text-white drop-shadow">${amount}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-white/90">
                {AMOUNTS.find((a) => a.value === amount)?.label}
              </p>

              <p className="mt-6 font-display text-sm italic text-white/95">
                "Made with sparkle, for someone you love."
              </p>
            </motion.div>

            {/* Amount picker */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {AMOUNTS.map((a) => {
                const active = amount === a.value;
                return (
                  <button
                    key={a.value}
                    onClick={() => setAmount(a.value)}
                    className={`relative rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                      active
                        ? "border-blossom/60 bg-gradient-to-br from-blossom/20 to-coral/15 text-white shadow-glow"
                        : "border-white/15 bg-white/[0.04] text-white/75 hover:border-blossom/30 hover:text-white"
                    }`}
                  >
                    {a.popular && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-sparkle px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-navy">
                        Loved
                      </span>
                    )}
                    <span className="block font-display text-xl">${a.value}</span>
                    <span className="block text-[10px] font-normal text-white/65">{a.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-white/65">
                <Heart className="mr-1 inline h-3.5 w-3.5 text-coral" />
                Personal note included free
              </p>
              <button onClick={gift} className="btn-primary">
                <Star className="h-4 w-4" /> Gift ${amount} <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
