import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SectionHeading from "../components/SectionHeading.jsx";
import { ChevronDown, Sparkle } from "../components/Icons.jsx";
import { FAQ } from "../data/content.js";
import { useUI } from "../context/UIContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

export default function Faq() {
  const [openId, setOpenId] = useState(FAQ[0]?.id);
  const { openSignup } = useUI();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();

  const cta = () => {
    if (isAuthed) navigate("/portal");
    else openSignup();
  };

  return (
    <section id="faq" className="relative py-24 md:py-32">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-blossom/10 to-transparent" />
      <div className="absolute top-16 right-10 text-2xl text-sparkle animate-twinkle">✦</div>
      <div className="absolute bottom-20 left-12 text-2xl text-coral animate-twinkle" style={{ animationDelay: "1.1s" }}>★</div>

      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <SectionHeading
          eyebrow="Good Questions"
          title="The things parents & swimmers ask first"
          subtitle="If your question isn't here, send us a note — we answer every message within one business day."
        />

        <div className="mt-12 grid gap-3">
          {FAQ.map((item, i) => {
            const open = openId === item.id;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                className={`overflow-hidden rounded-2xl border transition ${
                  open
                    ? "border-blossom/40 bg-gradient-to-r from-blossom/10 via-lavender/5 to-transparent"
                    : "border-white/15 bg-white/[0.04] hover:border-blossom/30"
                }`}
              >
                <button
                  onClick={() => setOpenId(open ? null : item.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left md:px-6 md:py-5"
                  aria-expanded={open}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`grid h-8 w-8 flex-none place-items-center rounded-xl transition ${
                        open
                          ? "bg-gradient-to-br from-blossom to-coral text-white shadow-glow"
                          : "bg-white/5 text-blossom"
                      }`}
                    >
                      <Sparkle className="h-4 w-4" />
                    </span>
                    <span className="font-display text-base font-semibold text-white md:text-lg">
                      {item.q}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 flex-none text-white/70 transition-transform ${open ? "rotate-180 text-blossom" : ""}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                      <p className="px-5 pb-5 pl-16 pr-6 text-sm leading-relaxed text-white/75 md:px-6 md:pb-6 md:pl-20">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 rounded-3xl border border-blossom/30 bg-gradient-to-r from-blossom/15 via-lavender/10 to-transparent p-6 sm:flex-row md:p-8">
          <div>
            <p className="font-display text-xl font-semibold text-white">Still curious?</p>
            <p className="mt-1 text-sm text-white/70">
              Sign up for free and book a complimentary trial class from your portal.
            </p>
          </div>
          <button onClick={cta} className="btn-primary flex-none">
            <Sparkle className="h-4 w-4" /> {isAuthed ? "Book Free Trial" : "Get My Free Trial"}
          </button>
        </div>
      </div>
    </section>
  );
}
