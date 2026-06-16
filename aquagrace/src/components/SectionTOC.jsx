import { useLocation } from "react-router-dom";
import { useScrollSpy } from "../hooks/useScrollSpy.js";

const SECTIONS = [
  { id: "home", label: "Hero" },
  { id: "ballet", label: "Water Ballet" },
  { id: "programs", label: "Programs" },
  { id: "how", label: "How It Works" },
  { id: "adults", label: "For Adults" },
  { id: "schedule", label: "Schedule" },
  { id: "safety", label: "Safety" },
  { id: "membership", label: "Memberships" },
  { id: "testimonials", label: "Voices" },
  { id: "showcases", label: "Showcases" },
  { id: "gift", label: "Gift Cards" },
  { id: "about", label: "About" },
  { id: "faq", label: "FAQ" },
  { id: "contact", label: "Contact" },
];

const IDS = SECTIONS.map((s) => s.id);

export default function SectionTOC() {
  const { pathname } = useLocation();
  const active = useScrollSpy(IDS, 200);

  if (pathname !== "/") return null;

  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <aside
      aria-label="Section navigation"
      className="pointer-events-none fixed right-6 top-1/2 z-20 hidden -translate-y-1/2 xl:block"
    >
      <ul className="pointer-events-auto flex flex-col items-end gap-0.5">
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <button
                onClick={() => go(s.id)}
                className="group relative flex items-center gap-3 py-1.5 pr-0 pl-3 text-xs"
                aria-current={isActive ? "true" : undefined}
                aria-label={s.label}
              >
                <span
                  className={`whitespace-nowrap rounded-full border bg-navy-soft/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest backdrop-blur transition-all duration-300 ${
                    isActive
                      ? "border-blossom/50 text-white opacity-100 translate-x-0"
                      : "border-white/10 text-white/65 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                  }`}
                >
                  {s.label}
                </span>
                <span
                  className={`grid h-2.5 w-2.5 place-items-center rounded-full border transition-all ${
                    isActive
                      ? "border-blossom bg-gradient-to-br from-blossom to-coral scale-125 shadow-glow"
                      : "border-white/35 bg-transparent group-hover:border-blossom group-hover:scale-110"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
