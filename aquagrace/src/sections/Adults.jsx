import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import SectionHeading from "../components/SectionHeading.jsx";
import { Music, Heart, Sparkle, Drop, ChevronRight, Check } from "../components/Icons.jsx";
import { ADULTS } from "../data/content.js";
import { useUI } from "../context/UIContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const ICONS = { Music, Heart, Sparkle, Drop };

export default function Adults() {
  const { openSignup } = useUI();
  const { isAuthed } = useAuth();
  const navigate = useNavigate();

  const reserve = () => {
    if (isAuthed) navigate("/portal");
    else openSignup();
  };

  return (
    <section id="adults" className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 -z-20 bg-gradient-to-b from-navy via-navy-soft/40 to-navy" />
      <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-lavender/15 blur-3xl -z-10" />
      <div className="absolute -bottom-24 left-0 h-96 w-96 rounded-full bg-aqua/10 blur-3xl -z-10" />
      <div className="absolute top-10 left-10 text-2xl text-sparkle animate-twinkle">✦</div>
      <div className="absolute bottom-20 right-12 text-3xl text-blossom animate-twinkle" style={{ animationDelay: "1.5s" }}>★</div>

      <div className="relative mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid items-end gap-10 md:grid-cols-2">
          <SectionHeading
            align="left"
            eyebrow="For Adults"
            title="Grown-ups deserve a little magic too"
            subtitle="A pool isn't just for the girls — it's for the moms, dads and grown-ups who want to move, breathe and find their own kind of grace."
          />
          <p className="text-white/70 md:max-w-md md:justify-self-end">
            Whether you're learning to swim for the first time, returning to fitness, or
            dreaming of your own water-ballet showcase — we have a class for you. Same caring
            coaches, same safety promise, designed for adult bodies and busy schedules.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {ADULTS.map((a, i) => {
            const Icon = ICONS[a.icon] || Music;
            return (
              <motion.article
                key={a.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04] p-7 transition hover:-translate-y-1 hover:border-blossom/40"
              >
                <div className={`absolute inset-x-0 -top-32 h-64 bg-gradient-to-b ${a.color} opacity-50 blur-3xl transition group-hover:opacity-80`} />

                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-lavender to-blossom text-white shadow-glow">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-blossom">
                      Adults
                    </span>
                  </div>

                  <h3 className="mt-5 font-display text-2xl font-semibold text-white">{a.title}</h3>
                  <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-sparkle/90">
                    {a.tagline}
                  </p>
                  <p className="mt-3 text-sm text-white/75">{a.description}</p>

                  <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                    <Meta label="Class duration" value={a.duration} />
                    <Meta label="Schedule" value={a.sessions} />
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-blossom">
                      What you'll do
                    </p>
                    <ul className="mt-2.5 grid gap-1.5 text-xs text-white/80 sm:grid-cols-2">
                      {a.learn.map((line) => (
                        <li key={line} className="flex items-start gap-1.5">
                          <span className="mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-full bg-blossom/20 text-blossom">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={reserve}
                    className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blossom transition group-hover:gap-2 group-hover:text-coral"
                  >
                    {isAuthed ? "Book in portal" : "Reserve your spot"} <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 rounded-3xl border border-blossom/30 bg-gradient-to-r from-blossom/15 via-lavender/10 to-transparent p-6 text-center sm:flex-row sm:text-left md:p-8">
          <div>
            <h3 className="font-display text-xl font-semibold text-white">
              Bring a friend, get 20% off your first month
            </h3>
            <p className="mt-1 text-sm text-white/70">
              Sign up with a friend for any adult class and you both save — because magic is
              better with company.
            </p>
          </div>
          <button onClick={reserve} className="btn-primary flex-none">
            <Heart className="h-4 w-4" /> Bring a Friend
          </button>
        </div>
      </div>
    </section>
  );
}

function Meta({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-white/55">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
