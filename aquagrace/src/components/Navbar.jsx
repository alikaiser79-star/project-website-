import { useEffect, useState } from "react";
import Logo from "./Logo.jsx";
import { Menu, X, Whatsapp } from "./Icons.jsx";
import { WHATSAPP_URL } from "../data/content.js";

const LINKS = [
  { id: "about", label: "About" },
  { id: "pricing", label: "Pricing" },
  { id: "how", label: "How it works" },
  { id: "contact", label: "Contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "bg-bg/90 backdrop-blur-md border-b border-line"
          : "bg-transparent"
      }`}
    >
      <nav className="section flex h-16 items-center justify-between">
        <Logo />

        <ul className="hidden md:flex items-center gap-1 text-sm">
          {LINKS.map((l) => (
            <li key={l.id}>
              <button
                onClick={() => go(l.id)}
                className="rounded-full px-3 py-2 font-medium text-ink-soft transition hover:text-ocean hover:bg-aqua-pale/40"
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white shadow-cta transition hover:bg-coral-deep"
          >
            <Whatsapp className="h-4 w-4" /> Book a free trial
          </a>

          <button
            onClick={() => setOpen((v) => !v)}
            className="md:hidden grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink-soft"
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="md:hidden border-t border-line bg-bg/95 backdrop-blur-md">
          <div className="section flex flex-col gap-1 py-3">
            {LINKS.map((l) => (
              <button
                key={l.id}
                onClick={() => go(l.id)}
                className="rounded-xl px-3 py-2.5 text-left font-medium text-ink-soft hover:bg-aqua-pale/40 hover:text-ocean"
              >
                {l.label}
              </button>
            ))}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-coral px-4 py-3 font-semibold text-white shadow-cta"
            >
              <Whatsapp className="h-4 w-4" /> Book a free trial
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
