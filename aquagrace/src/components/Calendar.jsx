import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "./Icons.jsx";
import { useBooking } from "../context/BookingContext.jsx";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const fmt = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function Calendar({ value, onChange }) {
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const { isBooked, slots } = useBooking();

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1).getDay();
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < first; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [view]);

  const todayIso = fmt(today.getFullYear(), today.getMonth(), today.getDate());

  const prev = () =>
    setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const next = () =>
    setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  const dayHasOpen = (d) => {
    const iso = fmt(view.y, view.m, d);
    return slots.some((t) => !isBooked(iso, t));
  };

  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-5">
      <div className="flex items-center justify-between">
        <button onClick={prev} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/80 hover:bg-white/10" aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="font-display text-lg font-semibold text-white">
            {MONTHS[view.m]} {view.y}
          </p>
          <p className="text-[11px] uppercase tracking-widest text-white/50">Tap an open day</p>
        </div>
        <button onClick={next} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/80 hover:bg-white/10" aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-widest text-white/40">
        {DAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="aspect-square" />;
          const iso = fmt(view.y, view.m, d);
          const past = iso < todayIso;
          const open = !past && dayHasOpen(d);
          const selected = value === iso;
          return (
            <button
              key={i}
              onClick={() => !past && onChange(iso)}
              disabled={past}
              className={[
                "relative aspect-square rounded-xl text-sm font-semibold transition",
                past ? "cursor-not-allowed text-white/20" : "text-white hover:bg-white/10",
                open && !selected ? "bg-blossom/15 ring-1 ring-blossom/30" : "",
                selected ? "bg-gradient-to-br from-blossom to-coral text-white ring-2 ring-sparkle shadow-glow" : "",
                iso === todayIso && !selected ? "ring-1 ring-white/30" : "",
              ].filter(Boolean).join(" ")}
              aria-pressed={selected}
            >
              {d}
              {open && !selected && (
                <span className="pointer-events-none absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blossom" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-end gap-4 text-[11px] text-white/55">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blossom" /> Available</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/30" /> Today</span>
      </div>
    </div>
  );
}
