import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext.jsx";
import { useBooking } from "../context/BookingContext.jsx";
import { Calendar, Clock, Plus, Star, ChevronRight, X, Sparkle } from "../components/Icons.jsx";
import BookingPanel from "../components/BookingPanel.jsx";

export default function MemberPortal() {
  const { user, isAuthed } = useAuth();
  const { reservations, removeReservation } = useBooking();
  const navigate = useNavigate();
  const [showBooking, setShowBooking] = useState(false);
  const bookingRef = useRef(null);

  useEffect(() => {
    if (showBooking) {
      requestAnimationFrame(() => {
        bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [showBooking]);

  if (!isAuthed) return <Navigate to="/" replace />;

  const initials = user.fullName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const remaining = Math.max(0, user.sessionsTotal - user.sessionsUsed);

  const upcoming = [...reservations]
    .filter((r) => `${r.date}T${r.time || "00:00"}` >= new Date().toISOString().slice(0, 16))
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

  const next = upcoming[0];

  const openBooking = () => setShowBooking(true);

  return (
    <main className="pt-28 md:pt-32 pb-20">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-6 rounded-3xl border border-white/15 bg-gradient-to-r from-blossom/20 via-lavender/15 to-transparent p-6 md:flex-row md:items-center md:justify-between md:p-8"
        >
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-blossom to-coral font-display text-2xl font-semibold text-white shadow-glow">
              {initials}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blossom">Welcome back ✨</p>
              <h1 className="font-display text-3xl md:text-4xl font-semibold text-white">
                Hi, {user.fullName.split(" ")[0]}
              </h1>
              <p className="mt-1 text-sm text-white/65">{user.email} · {user.tier} member</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={openBooking} className="btn-primary">
              <Plus className="h-4 w-4" /> Book a Session
            </button>
            <button onClick={() => navigate("/membership")} className="btn-outline">
              <Star className="h-4 w-4" /> My Membership
            </button>
          </div>
        </motion.div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Stat label="Sessions This Month" value={user.sessionsUsed} hint={`of ${user.sessionsTotal} included`} />
          <Stat label="Sessions Remaining" value={remaining} hint="this billing cycle" />
          <Stat label="Membership Tier" value={user.tier} hint={`Renews ${user.renewal}`} />
          <Stat
            label="Next Session"
            value={next ? prettyDate(next.date) : "—"}
            hint={next ? `${next.time} · ${next.program}` : "No bookings yet"}
          />
        </div>

        <AnimatePresence initial={false}>
          {showBooking && (
            <motion.div
              ref={bookingRef}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="mt-10"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-blossom">
                  <Sparkle className="mr-1 inline h-3.5 w-3.5" /> Member booking calendar
                </p>
                <button
                  onClick={() => setShowBooking(false)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:border-coral/50 hover:text-coral"
                >
                  <X className="h-3.5 w-3.5" /> Close
                </button>
              </div>
              <BookingPanel />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-10 rounded-3xl border border-white/15 bg-white/[0.04] p-6 md:p-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-white">Upcoming reservations</h2>
            <button onClick={openBooking} className="text-sm font-semibold text-blossom hover:text-coral">+ Book another</button>
          </div>

          {upcoming.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-10 text-center">
              <p className="text-white/70">You have no upcoming sessions yet.</p>
              <button onClick={openBooking} className="btn-primary mt-4">
                Book your first session <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-white/10">
              {upcoming.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blossom to-coral text-white">
                      <Calendar className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-white">{r.program}</p>
                      <p className="mt-0.5 text-sm text-white/65">
                        {prettyDate(r.date)} · <Clock className="-mt-0.5 inline h-3.5 w-3.5 text-blossom" /> {r.time}
                        {r.tutor && r.tutor !== "No preference" ? ` · with ${r.tutor}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeReservation(r.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-red-400/40 hover:text-red-300"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-blossom/90">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-white/55">{hint}</p>}
    </div>
  );
}

function prettyDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
