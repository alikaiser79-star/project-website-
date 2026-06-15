import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import SectionHeading from "../components/SectionHeading.jsx";
import { Clock, Sparkle, ChevronRight } from "../components/Icons.jsx";
import { SCHEDULE_DAYS, SCHEDULE_TRACKS } from "../data/content.js";
import { useUI } from "../context/UIContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const AUDIENCE_FILTERS = [
  { id: "all", label: "All classes" },
  { id: "girls", label: "Girls (6–16)" },
  { id: "adults", label: "Adults" },
  { id: "family", label: "Family" },
];

const COLOR_DOT = {
  blossom: "bg-blossom",
  coral: "bg-coral",
  lavender: "bg-lavender",
  sparkle: "bg-sparkle",
  aqua: "bg-aqua",
};

const COLOR_PILL = {
  blossom: "bg-blossom/15 text-blossom border-blossom/30",
  coral: "bg-coral/15 text-coral border-coral/30",
  lavender: "bg-lavender/15 text-lavender border-lavender/30",
  sparkle: "bg-sparkle/15 text-sparkle border-sparkle/30",
  aqua: "bg-aqua/15 text-aqua border-aqua/30",
};

function matchesAudience(track, filter) {
  if (filter === "all") return true;
  if (filter === "adults") return track.audience === "Adults";
  if (filter === "girls") return /Ages (6|9|12|15)/.test(track.audience);
  if (filter === "family") return track.audience.includes("parent");
  return true;
}

export default function Schedule() {
  const [filter, setFilter] = useState("all");
  const { openSignup } = useUI();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();

  const tracks = useMemo(
    () => SCHEDULE_TRACKS.filter((t) => matchesAudience(t, filter)),
    [filter]
  );

  const cta = () => {
    if (isAuthed) navigate("/portal");
    else openSignup();
  };

  return (
    <section id="schedule" className="relative py-24 md:py-32">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-aqua/10 to-transparent" />
      <div className="absolute top-10 right-10 text-2xl text-sparkle animate-twinkle">✦</div>

      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          eyebrow="A Typical Week"
          title="When her class — and yours — happens"
          subtitle="A snapshot of our recurring weekly schedule. Exact times can shift seasonally; the booking calendar in your member portal is always the source of truth."
        />

        {/* Filter pills */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {AUDIENCE_FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-gradient-to-r from-blossom to-coral text-white shadow-glow"
                    : "border border-white/15 bg-white/5 text-white/75 hover:border-blossom/40 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Schedule table */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
          className="mt-10 overflow-x-auto rounded-3xl border border-white/15 bg-white/[0.03]"
        >
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="text-left">
                <th className="sticky left-0 z-10 bg-navy/95 px-5 py-4 text-[11px] font-bold uppercase tracking-widest text-blossom">
                  Class
                </th>
                {SCHEDULE_DAYS.map((d) => (
                  <th
                    key={d}
                    className="px-3 py-4 text-center text-[11px] font-bold uppercase tracking-widest text-white/65"
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tracks.length === 0 && (
                <tr>
                  <td colSpan={SCHEDULE_DAYS.length + 1} className="px-5 py-12 text-center text-white/55">
                    No classes match this filter.
                  </td>
                </tr>
              )}
              {tracks.map((t, i) => (
                <tr
                  key={t.id}
                  className={`border-t border-white/10 transition hover:bg-white/[0.04] ${
                    i % 2 === 0 ? "bg-white/[0.015]" : ""
                  }`}
                >
                  <td className="sticky left-0 z-10 bg-navy/95 px-5 py-4 align-top">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2.5 w-2.5 flex-none rounded-full ${COLOR_DOT[t.color]} shadow-sparkle`} />
                      <div>
                        <p className="font-display text-base font-semibold text-white">{t.name}</p>
                        <p className="text-[11px] text-white/55">{t.audience}</p>
                      </div>
                    </div>
                  </td>
                  {SCHEDULE_DAYS.map((d) => (
                    <td key={d} className="px-3 py-4 text-center align-top">
                      {t.slots[d] ? (
                        <button
                          onClick={cta}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition hover:scale-105 ${COLOR_PILL[t.color]}`}
                          title={`${t.name} · ${d} ${t.slots[d]}`}
                        >
                          <Clock className="h-3 w-3" /> {t.slots[d]}
                        </button>
                      ) : (
                        <span className="text-white/15">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Hint + CTA */}
        <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-3xl border border-white/15 bg-white/[0.04] p-5 sm:flex-row md:p-6">
          <p className="text-sm text-white/70">
            <Sparkle className="mr-1.5 inline h-3.5 w-3.5 text-sparkle" />
            Tap any time slot to book — guests will be invited to create a free account first.
          </p>
          <button onClick={cta} className="btn-outline px-5 py-2 text-sm">
            {isAuthed ? "Open portal" : "Get free trial"} <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
