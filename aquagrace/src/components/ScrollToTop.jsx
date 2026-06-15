import { useEffect, useState } from "react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <button
      onClick={go}
      aria-label="Back to top"
      className={`group fixed bottom-24 right-5 z-40 grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-navy-soft/80 text-white shadow-card backdrop-blur transition-all hover:bg-gradient-to-br hover:from-blossom hover:to-coral hover:border-transparent ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M6 15l6-6 6 6" />
      </svg>
      <span className="pointer-events-none absolute right-14 whitespace-nowrap rounded-full border border-white/15 bg-navy/90 px-3 py-1 text-xs font-medium text-white shadow-card opacity-0 transition group-hover:opacity-100">
        Back to top
      </span>
    </button>
  );
}
