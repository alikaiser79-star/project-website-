import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { Sparkle, Heart, ChevronRight, X } from "./Icons.jsx";
import { useUI } from "../context/UIContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const STORAGE_KEY = "aquagrace.trialBarDismissed";

export default function TrialBar() {
  const [dismissed, setDismissed] = useState(true);
  const [visible, setVisible] = useState(false);
  const { openSignup } = useUI();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Read dismissed flag from localStorage on mount
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  // Only on home, only after scrolling past hero, only for guests, only if not dismissed
  useEffect(() => {
    if (pathname !== "/") {
      setVisible(false);
      return;
    }
    const onScroll = () => setVisible(window.scrollY > 800);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  const handleClose = () => {
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
  };

  const handleClaim = () => {
    if (isAuthed) navigate("/portal");
    else openSignup();
  };

  const show = visible && !dismissed && !isAuthed && pathname === "/";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="fixed bottom-4 left-1/2 z-30 w-[min(96vw,640px)] -translate-x-1/2"
        >
          <div className="relative flex items-center gap-4 overflow-hidden rounded-full border border-blossom/40 bg-navy-soft/95 px-3 py-2.5 shadow-card backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-blossom/20 via-lavender/10 to-coral/20" />

            <span className="hidden sm:inline-grid h-9 w-9 flex-none place-items-center rounded-full bg-gradient-to-br from-blossom to-coral text-white shadow-glow">
              <Sparkle className="h-4 w-4" />
            </span>

            <p className="min-w-0 flex-1 truncate text-sm text-white">
              <span className="font-semibold text-sparkle">First class free</span>
              <span className="text-white/70"> — try any tier, no card required.</span>
            </p>

            <button
              onClick={handleClaim}
              className="inline-flex flex-none items-center gap-1.5 rounded-full bg-gradient-to-r from-blossom via-coral to-sparkle px-4 py-2 text-xs font-semibold text-navy transition hover:-translate-y-0.5 hover:shadow-glow"
            >
              <Heart className="h-3.5 w-3.5" /> Claim it <ChevronRight className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={handleClose}
              aria-label="Dismiss"
              className="grid h-7 w-7 flex-none place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
