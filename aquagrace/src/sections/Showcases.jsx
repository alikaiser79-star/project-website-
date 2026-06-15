import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import SectionHeading from "../components/SectionHeading.jsx";
import { Calendar, Clock, Sparkle, ChevronRight, Star } from "../components/Icons.jsx";
import { SHOWCASES } from "../data/content.js";
import { useUI } from "../context/UIContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso) {
  const d = new Date(iso + "T00:00:00");
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: MONTHS[d.getMonth()],
    weekday: d.toLocaleDateString(undefined, { weekday: "long" }),
  };
}

export default function Showcases() {
  const { openSignup } = useUI();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();

  const cta = () => {
    if (isAuthed) navigate("/portal");
    else openSignup();
  };

  return (
    <section id="showcases" className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 -z-20 bg-gradient-to-b from-navy via-plum/15 to-navy" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-[40rem] rounded-full bg-blossom/10 blur-3xl -z-10" />
      <div className="absolute top-10 right-10 text-3xl text-sparkle animate-twinkle">✦</div>
      <div className="absolute bottom-16 left-12 text-2xl text-coral animate-twinkle" style={{ animationDelay: "1.6s" }}>★</div>

      <div className="relative mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid items-end gap-10 md:grid-cols-2">
          <SectionHeading
            align="left"
            eyebrow="Coming Up"
            title="Showcases, competitions & celebrations"
            subtitle="The moments our girls and adults work toward — and the nights families don't forget. Every showcase is family-friendly and open to friends."
          />
          <p className="text-white/70 md:max-w-md md:justify-self-end">
            Members can RSVP from the portal. Not a member yet? Create a free account to be the
            first to know when tickets open.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {SHOWCASES.map((s, i) => {
            const { day, month, weekday } = parts(s.date);
            return (
              <motion.article
                key={s.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className="group relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:border-blossom/40"
              >
                <div className={`absolute inset-x-0 -top-32 h-64 bg-gradient-to-b ${s.accent} opacity-50 blur-3xl transition group-hover:opacity-80`} />

                <div className="relative flex gap-5">
                  <div className="flex flex-none flex-col items-center justify-center rounded-2xl border border-white/15 bg-navy-soft/60 px-4 py-3 text-center shadow-card backdrop-blur">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blossom">{month}</span>
                    <span className="font-display text-3xl font-bold leading-none text-white">{day}</span>
                    <span className="mt-0.5 text-[10px] text-white/55">{weekday}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blossom/20 to-coral/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blossom">
                      <Star className="h-3 w-3 text-sparkle" /> {s.badge}
                    </span>
                    <h3 className="mt-2 font-display text-xl font-semibold text-white">{s.title}</h3>
                    <p className="text-sm font-semibold uppercase tracking-wider text-sparkle/90">
                      {s.subtitle}
                    </p>
                    <p className="mt-2 text-sm text-white/75">{s.desc}</p>

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/65">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-blossom" /> {weekday}, {month} {day}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-blossom" /> {s.time}
                      </span>
                    </div>

                    <button
                      onClick={cta}
                      className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blossom transition group-hover:gap-2 group-hover:text-coral"
                    >
                      {isAuthed ? "RSVP in portal" : "Sign up to RSVP"} <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        {/* Moments / gallery strip */}
        <div className="mt-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Moments</p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-white md:text-3xl">
                A glimpse from past seasons
              </h3>
            </div>
            <span className="hidden sm:inline rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-widest text-white/65">
              Imagery placeholders
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { tone: "from-blossom/40 to-lavender/40", label: "Tiny Swans · first floats" },
              { tone: "from-coral/40 to-sparkle/30", label: "Junior Mermaids · costume night" },
              { tone: "from-lavender/40 to-aqua/40", label: "Rising Stars · group lift" },
              { tone: "from-sparkle/40 to-blossom/30", label: "Elite Corps · regional finals" },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/15"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${m.tone}`} />
                <div className="absolute inset-0 grid place-items-center">
                  <Sparkle className="h-10 w-10 text-white/80 drop-shadow group-hover:scale-110 transition" />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/90 to-transparent p-3">
                  <p className="text-[11px] font-semibold text-white/95">{m.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
