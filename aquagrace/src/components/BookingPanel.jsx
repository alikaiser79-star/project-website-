import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Calendar from "./Calendar.jsx";
import { Calendar as CalIcon, Clock, Check, Send, Sparkle } from "./Icons.jsx";
import { useBooking } from "../context/BookingContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const PROGRAMS = [
  "Tiny Swans (ages 6–8)",
  "Junior Mermaids (ages 9–11)",
  "Rising Stars (ages 12–14)",
  "Elite Corps (ages 15–16)",
  "Splash & Smile Lessons",
  "Stroke Stars Clinics",
  "Family Pool Party",
];

const TUTORS = [
  "No preference",
  "Marina Voss",
  "Daniel Park",
  "Lena Aliyeva",
  "Omar Rashid",
  "Sofia Marin",
];

export default function BookingPanel({ onBooked }) {
  const { slots, isBooked, addReservation } = useBooking();
  const { user } = useAuth();

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [form, setForm] = useState({
    name: user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
    program: PROGRAMS[1],
    tutor: TUTORS[0],
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [confirmed, setConfirmed] = useState(null);

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
    onBooked?.();
  };

  return (
    <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-blossom/10 via-lavender/5 to-transparent p-6 md:p-8">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blossom">
        <Sparkle className="h-3.5 w-3.5" /> Book a session
      </div>
      <h3 className="mt-2 font-display text-3xl font-semibold text-white">
        Pick her next class
      </h3>
      <p className="mt-1 text-sm text-white/65">
        Choose a date, an open slot and the program — we'll confirm by email within minutes.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-6">
          <Calendar value={date} onChange={(d) => { setDate(d); setTime(""); setConfirmed(null); }} />

          <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
            <div className="flex items-center gap-2 text-sm text-white/75">
              <Clock className="h-4 w-4 text-blossom" />
              {date ? (
                <span>Slots for <strong className="text-white">{prettyDate(date)}</strong></span>
              ) : (
                <span>Select a day to see open slots</span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {!date && Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 rounded-xl border border-white/5 bg-white/[0.02]" />
              ))}
              {slotState.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  disabled={s.booked}
                  onClick={() => setTime(s.time)}
                  className={[
                    "h-10 rounded-xl text-sm font-semibold transition",
                    s.booked
                      ? "cursor-not-allowed border border-white/5 bg-white/[0.02] text-white/30 line-through"
                      : time === s.time
                      ? "bg-gradient-to-r from-blossom to-coral text-white shadow-glow"
                      : "border border-white/15 text-white hover:border-blossom hover:bg-blossom/10",
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

        <form onSubmit={submit} className="lg:col-span-7 rounded-2xl border border-white/15 bg-white/[0.04] p-6 md:p-7">
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
            <Field label="Preferred Coach">
              <select value={form.tutor} onChange={(e) => set("tutor", e.target.value)} className="input-field">
                {TUTORS.map((p) => <option key={p} className="bg-navy">{p}</option>)}
              </select>
            </Field>
            <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/55">When</p>
              <p className="mt-1 text-sm text-white">
                {date ? prettyDate(date) : "—"} {time && <span className="text-blossom">· {time}</span>}
              </p>
            </div>
            <div className="sm:col-span-2">
              <Field label="Notes (optional)">
                <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows="3" className="input-field resize-none" placeholder="Anything we should know? Allergies, goals or accessibility needs?" />
              </Field>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button type="submit" className="btn-primary">
              <Send className="h-4 w-4" /> Confirm Booking
            </button>
          </div>

          <AnimatePresence>
            {confirmed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 flex items-start gap-3 rounded-2xl border border-blossom/40 bg-gradient-to-r from-blossom/15 to-coral/10 p-4"
              >
                <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-gradient-to-br from-blossom to-coral text-white"><Check className="h-4 w-4" /></span>
                <div className="text-sm">
                  <p className="font-semibold text-white">Reservation confirmed ✨</p>
                  <p className="text-white/70">
                    {confirmed.program} · {prettyDate(confirmed.date)} at {confirmed.time}. It's saved to your portal below.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="label-field flex items-center gap-2">
        <CalIcon className="h-3 w-3 text-blossom/70" /> {label}
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
