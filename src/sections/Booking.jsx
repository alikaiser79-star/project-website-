import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SectionHeading from "../components/SectionHeading.jsx";
import Calendar from "../components/Calendar.jsx";
import { Calendar as CalIcon, Clock, Check, Send } from "../components/Icons.jsx";
import { useBooking } from "../context/BookingContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../context/UIContext.jsx";

const PROGRAMS = [
  "Kids Swim Lessons",
  "Swim Clinics & Team Prep",
  "Family & Fun Events",
  "Water Ballet — Beginner",
  "Water Ballet — Intermediate",
  "Water Ballet — Advanced",
  "Adult Lessons",
];

const TUTORS = [
  "No preference",
  "Marina Voss",
  "Daniel Park",
  "Lena Aliyeva",
  "Omar Rashid",
  "Sofia Marin",
];

export default function Booking() {
  const { slots, isBooked, addReservation } = useBooking();
  const { user, isAuthed } = useAuth();
  const { bookingPrefill, setBookingPrefill } = useUI();

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [form, setForm] = useState({
    name: user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    program: PROGRAMS[0],
    tutor: TUTORS[0],
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    if (bookingPrefill) {
      if (bookingPrefill.date) setDate(bookingPrefill.date);
      if (bookingPrefill.program) setForm((f) => ({ ...f, program: bookingPrefill.program }));
      setBookingPrefill(null);
    }
  }, [bookingPrefill, setBookingPrefill]);

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        name: f.name || user.fullName,
        email: f.email || user.email,
        phone: f.phone || user.phone,
      }));
    }
  }, [user]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const slotState = useMemo(() => {
    if (!date) return [];
    return slots.map((t) => ({ time: t, booked: isBooked(date, t) }));
  }, [date, slots, isBooked]);

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!date) next.date = "Pick a day on the calendar.";
    if (!time) next.time = "Choose a time slot.";
    if (!form.name.trim()) next.name = "Required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Invalid email";
    if (!form.phone.trim()) next.phone = "Required";
    setErrors(next);
    if (Object.keys(next).length) return;

    addReservation({
      date,
      time,
      program: form.program,
      tutor: form.tutor,
      name: form.name,
      email: form.email,
      phone: form.phone,
      notes: form.notes,
      memberEmail: user?.email || form.email,
    });
    setConfirmed({ date, time, program: form.program });
    setTime("");
    setForm((f) => ({ ...f, notes: "" }));
  };

  return (
    <section id="booking" className="relative py-24 md:py-32">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-aqua/10 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          eyebrow="Booking"
          title="Reserve your lane in seconds"
          subtitle="Pick a date, choose an open time slot, and we'll confirm by email within minutes."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-6">
            <Calendar value={date} onChange={(d) => { setDate(d); setTime(""); setConfirmed(null); }} />

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Clock className="h-4 w-4 text-aqua" />
                {date ? (
                  <span>Slots for <strong className="text-white">{prettyDate(date)}</strong></span>
                ) : (
                  <span>Select a day to see open slots</span>
                )}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {!date && Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg border border-white/5 bg-white/[0.02]" />
                ))}
                {slotState.map((s) => (
                  <button
                    key={s.time}
                    type="button"
                    disabled={s.booked}
                    onClick={() => setTime(s.time)}
                    className={[
                      "h-10 rounded-lg text-sm font-medium transition",
                      s.booked
                        ? "cursor-not-allowed border border-white/5 bg-white/[0.02] text-white/30 line-through"
                        : time === s.time
                        ? "bg-aqua text-navy shadow-glow"
                        : "border border-white/15 text-white hover:border-aqua hover:bg-aqua/10",
                    ].join(" ")}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
              {errors.date && <p className="mt-2 text-xs text-red-300">{errors.date}</p>}
              {errors.time && <p className="mt-2 text-xs text-red-300">{errors.time}</p>}
            </div>
          </div>

          <form onSubmit={submit} className="lg:col-span-7 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name" error={errors.name}>
                <input value={form.name} onChange={(e) => set("name", e.target.value)} className="input-field" placeholder="Jane Doe" />
              </Field>
              <Field label="Email" error={errors.email}>
                <input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" className="input-field" placeholder="you@example.com" />
              </Field>
              <Field label="Phone" error={errors.phone}>
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="input-field" placeholder="+1 555 010 0123" />
              </Field>
              <Field label="Program">
                <select value={form.program} onChange={(e) => set("program", e.target.value)} className="input-field">
                  {PROGRAMS.map((p) => <option key={p} className="bg-navy">{p}</option>)}
                </select>
              </Field>
              <Field label="Preferred Tutor">
                <select value={form.tutor} onChange={(e) => set("tutor", e.target.value)} className="input-field">
                  {TUTORS.map((p) => <option key={p} className="bg-navy">{p}</option>)}
                </select>
              </Field>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-white/50">When</p>
                <p className="mt-1 text-sm text-white">
                  {date ? prettyDate(date) : "—"} {time && <span className="text-aqua">· {time}</span>}
                </p>
              </div>
              <div className="sm:col-span-2">
                <Field label="Notes (optional)">
                  <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows="4" className="input-field resize-none" placeholder="Any goals, allergies or accessibility needs we should know about?" />
                </Field>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              {!isAuthed && (
                <p className="text-xs text-white/50">Tip: log in to keep all your bookings in one place.</p>
              )}
              <button type="submit" className="btn-primary ml-auto">
                <Send className="h-4 w-4" /> Confirm Booking
              </button>
            </div>

            <AnimatePresence>
              {confirmed && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 flex items-start gap-3 rounded-xl border border-aqua/40 bg-aqua/10 p-4"
                >
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-aqua text-navy"><Check className="h-4 w-4" /></span>
                  <div className="text-sm">
                    <p className="font-medium text-white">Reservation confirmed</p>
                    <p className="text-white/70">
                      {confirmed.program} · {prettyDate(confirmed.date)} at {confirmed.time}.
                      {isAuthed ? " Added to your member portal." : " A confirmation has been emailed to you."}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>
      </div>
    </section>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="label-field flex items-center gap-2">
        <CalIcon className="h-3 w-3 text-aqua/70" /> {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}

function prettyDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
