import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const BookingContext = createContext(null);
const STORAGE_KEY = "aquagrace.bookings";

const SLOTS = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

const todayIso = () => new Date().toISOString().slice(0, 10);

function seedBooked() {
  const d = new Date();
  const fmt = (offset) => {
    const x = new Date(d);
    x.setDate(d.getDate() + offset);
    return x.toISOString().slice(0, 10);
  };
  return {
    [fmt(2)]: ["09:00", "10:00"],
    [fmt(4)]: ["14:00"],
    [fmt(6)]: ["08:00", "11:00", "17:00"],
    [fmt(9)]: ["15:00"],
  };
}

export function BookingProvider({ children }) {
  const [reservations, setReservations] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [booked] = useState(seedBooked);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
    } catch { /* ignore */ }
  }, [reservations]);

  const isBooked = useCallback(
    (date, time) => {
      if (booked[date]?.includes(time)) return true;
      return reservations.some((r) => r.date === date && r.time === time);
    },
    [booked, reservations]
  );

  const addReservation = useCallback((res) => {
    setReservations((prev) => [...prev, { ...res, id: `RES-${Date.now()}` }]);
  }, []);

  const removeReservation = useCallback((id) => {
    setReservations((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      reservations,
      addReservation,
      removeReservation,
      isBooked,
      slots: SLOTS,
      today: todayIso(),
    }),
    [reservations, addReservation, removeReservation, isBooked]
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used inside BookingProvider");
  return ctx;
}
