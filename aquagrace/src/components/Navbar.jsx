import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "./Logo.jsx";
import { ChevronDown, Menu, X, User, Logout, Star } from "./Icons.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../context/UIContext.jsx";

const PROGRAM_ITEMS = [
  { id: "programs", label: "Swim Lessons", desc: "Foundational technique for all ages" },
  { id: "programs-clinics", label: "Swim Clinics & Team Prep", desc: "Coaching for competitive athletes" },
  { id: "programs-family", label: "Family & Fun Events", desc: "Pool parties & open swim" },
  { id: "programs-finder", label: "Level Finder", desc: "Find the right level in 90 seconds" },
  { id: "safety", label: "S.A.F.E.R. Swimmer Promise", desc: "Our 5-pillar safety covenant" },
];

const NAV_LINKS = [
  { id: "ballet", label: "Water Ballet" },
  { id: "membership", label: "Membership" },
  { id: "booking", label: "Booking" },
  { id: "safety", label: "Safety" },
  { id: "about", label: "About" },
  { id: "careers", label: "Careers" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [progOpen, setProgOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const dropRef = useRef(null);
  const userRef = useRef(null);
  const { user, isAuthed, logout } = useAuth();
  const { openLogin, openSignup } = useUI();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setProgOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenu(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const goSection = (id) => {
    setProgOpen(false);
    setMobileOpen(false);
    if (window.location.pathname !== "/") navigate("/");
    requestAnimationFrame(() => {
      const target = id.startsWith("programs") ? "programs" : id;
      const el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const initials = user?.fullName
    ? user.fullName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()
    : "AG";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled ? "bg-navy/85 backdrop-blur-xl border-b border-white/10" : "bg-navy"
      }`}
    >
      <nav className="mx-auto flex h-16 md:h-20 max-w-7xl items-center justify-between px-4 md:px-8">
        <Logo />

        <ul className="hidden lg:flex items-center gap-1 text-sm">
          <li ref={dropRef} className="relative">
            <button
              onClick={() => setProgOpen((v) => !v)}
              className="flex items-center gap-1 rounded-full px-3 py-2 text-white/80 transition hover:text-white hover:bg-white/10"
              aria-haspopup="menu"
              aria-expanded={progOpen}
            >
              Swim Programs
              <ChevronDown className={`h-4 w-4 transition ${progOpen ? "rotate-180" : ""}`} />
            </button>
            {progOpen && (
              <div role="menu" className="absolute left-1/2 top-full z-50 mt-3 w-[460px] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-navy-soft/95 backdrop-blur-xl shadow-card">
                <div className="p-2">
                  {PROGRAM_ITEMS.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => goSection(it.id)}
                      className="group flex w-full items-start gap-3 rounded-xl p-3 text-left transition hover:bg-white/5"
                    >
                      <span className="mt-1 inline-flex h-2 w-2 flex-none rounded-full bg-aqua/70 group-hover:bg-aqua" />
                      <span>
                        <span className="block text-sm font-medium text-white">{it.label}</span>
                        <span className="block text-xs text-white/60">{it.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </li>
          {NAV_LINKS.map((l) => (
            <li key={l.id}>
              <button onClick={() => goSection(l.id)} className="rounded-full px-3 py-2 text-white/80 transition hover:text-white hover:bg-white/10">
                {l.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          {!isAuthed ? (
            <>
              <button onClick={openLogin} className="hidden sm:inline-flex btn-outline px-4 py-2 text-sm">
                Log In
              </button>
              <button onClick={openSignup} className="btn-primary px-4 py-2 text-sm">
                Sign Up
              </button>
            </>
          ) : (
            <div ref={userRef} className="relative">
              <button
                onClick={() => setUserMenu((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1.5 pl-1.5 pr-3 transition hover:bg-white/10"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-aqua to-ocean text-xs font-semibold text-navy">
                  {initials}
                </span>
                <span className="hidden sm:inline text-sm text-white">{user.fullName.split(" ")[0]}</span>
                <ChevronDown className={`h-4 w-4 text-white/70 transition ${userMenu ? "rotate-180" : ""}`} />
              </button>
              {userMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-navy-soft/95 backdrop-blur-xl shadow-card">
                  <button onClick={() => { setUserMenu(false); navigate("/portal"); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5">
                    <User className="h-4 w-4 text-aqua" /> Member Portal
                  </button>
                  <button onClick={() => { setUserMenu(false); navigate("/membership"); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5">
                    <Star className="h-4 w-4 text-gold" /> Check My Membership
                  </button>
                  <div className="my-1 border-t border-white/10" />
                  <button onClick={() => { setUserMenu(false); logout(); navigate("/"); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white">
                    <Logout className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden ml-1 grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/90 hover:bg-white/10"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="lg:hidden border-t border-white/10 bg-navy/95 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 py-4 space-y-1">
            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-white/90 hover:bg-white/5">
                Swim Programs <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <div className="ml-2 mt-1 space-y-0.5">
                {PROGRAM_ITEMS.map((it) => (
                  <button key={it.id} onClick={() => goSection(it.id)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/75 hover:bg-white/5 hover:text-white">
                    {it.label}
                  </button>
                ))}
              </div>
            </details>
            {NAV_LINKS.map((l) => (
              <button key={l.id} onClick={() => goSection(l.id)} className="block w-full rounded-lg px-3 py-2.5 text-left text-white/90 hover:bg-white/5">
                {l.label}
              </button>
            ))}
            {!isAuthed && (
              <button onClick={() => { setMobileOpen(false); openLogin(); }} className="block w-full rounded-lg px-3 py-2.5 text-left text-white/90 hover:bg-white/5">
                Log In
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

