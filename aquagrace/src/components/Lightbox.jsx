import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Sparkle } from "./Icons.jsx";

export default function Lightbox({ items, index, onClose, onChange }) {
  const open = index !== null && index !== undefined && items?.[index];

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onChange((index + 1) % items.length);
      else if (e.key === "ArrowLeft") onChange((index - 1 + items.length) % items.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, index, items, onClose, onChange]);

  const item = open ? items[index] : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute inset-0 bg-navy/90 backdrop-blur-md"
          />

          {/* Prev */}
          <button
            onClick={(e) => { e.stopPropagation(); onChange((index - 1 + items.length) % items.length); }}
            aria-label="Previous"
            className="absolute left-3 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-navy-soft/80 text-white backdrop-blur transition hover:bg-blossom/30 hover:border-blossom/50 md:left-6"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Next */}
          <button
            onClick={(e) => { e.stopPropagation(); onChange((index + 1) % items.length); }}
            aria-label="Next"
            className="absolute right-3 z-10 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-navy-soft/80 text-white backdrop-blur transition hover:bg-blossom/30 hover:border-blossom/50 md:right-6"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <motion.div
            key={index}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-white/15 bg-navy-soft shadow-card"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/15 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className={`relative aspect-[16/10] bg-gradient-to-br ${item.tone}`}>
              <div className="absolute inset-0 grid place-items-center">
                <Sparkle className="h-20 w-20 text-white/85 drop-shadow animate-twinkle" />
              </div>

              {/* Decorative twinkles */}
              <span className="pointer-events-none absolute left-6 top-6 text-2xl text-sparkle animate-twinkle">✦</span>
              <span className="pointer-events-none absolute right-10 top-1/3 text-xl text-blossom animate-twinkle" style={{ animationDelay: "0.8s" }}>★</span>
              <span className="pointer-events-none absolute bottom-10 left-1/3 text-2xl text-coral animate-twinkle" style={{ animationDelay: "1.4s" }}>✿</span>

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/95 via-navy/40 to-transparent p-6 md:p-8">
                <p className="text-[11px] font-bold uppercase tracking-widest text-blossom">
                  {item.tag}
                </p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
                  {item.label}
                </h3>
                {item.caption && (
                  <p className="mt-1 text-sm text-white/75">{item.caption}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 text-xs text-white/55">
              <span>{index + 1} / {items.length}</span>
              <span className="hidden sm:inline">Use ← → to navigate · ESC to close</span>
              <span className="inline-flex items-center gap-1 text-blossom">
                <Sparkle className="h-3 w-3" /> Imagery placeholder
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
