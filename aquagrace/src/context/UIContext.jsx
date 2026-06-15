import { createContext, useCallback, useContext, useMemo, useState } from "react";

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [authModal, setAuthModal] = useState(null); // 'login' | 'signup' | null
  const [bookingPrefill, setBookingPrefill] = useState(null);
  const [levelFinderOpen, setLevelFinderOpen] = useState(false);
  // Incrementing counter — each bump triggers a fresh confetti burst.
  const [confettiBurst, setConfettiBurst] = useState(0);

  const openLogin = useCallback(() => setAuthModal("login"), []);
  const openSignup = useCallback(() => setAuthModal("signup"), []);
  const closeAuth = useCallback(() => setAuthModal(null), []);

  const openLevelFinder = useCallback(() => setLevelFinderOpen(true), []);
  const closeLevelFinder = useCallback(() => setLevelFinderOpen(false), []);

  const fireConfetti = useCallback(() => setConfettiBurst((n) => n + 1), []);

  const value = useMemo(
    () => ({
      authModal,
      openLogin,
      openSignup,
      closeAuth,
      bookingPrefill,
      setBookingPrefill,
      levelFinderOpen,
      openLevelFinder,
      closeLevelFinder,
      confettiBurst,
      fireConfetti,
    }),
    [
      authModal,
      openLogin,
      openSignup,
      closeAuth,
      bookingPrefill,
      levelFinderOpen,
      openLevelFinder,
      closeLevelFinder,
      confettiBurst,
      fireConfetti,
    ]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside UIProvider");
  return ctx;
}
