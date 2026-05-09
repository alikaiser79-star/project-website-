import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

const STORAGE_KEY = "aquagrace.auth";

const seedUser = {
  fullName: "Demo Member",
  email: "demo@aquagrace.test",
  phone: "+1 555 010 0123",
  program: "Kids Swim Lessons",
  tier: "Pro",
  joined: "2025-09-01",
  renewal: "2026-09-01",
  sessionsTotal: 16,
  sessionsUsed: 6,
  payments: [
    { id: "INV-1042", date: "2026-04-01", amount: 149, status: "Paid" },
    { id: "INV-1037", date: "2026-03-01", amount: 149, status: "Paid" },
    { id: "INV-1031", date: "2026-02-01", amount: 149, status: "Paid" },
  ],
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, [user]);

  const login = useCallback(({ email }) => {
    const next = { ...seedUser, email: email || seedUser.email };
    setUser(next);
    return next;
  }, []);

  const signup = useCallback((data) => {
    const next = {
      ...seedUser,
      fullName: data.fullName || seedUser.fullName,
      email: data.email || seedUser.email,
      phone: data.phone || seedUser.phone,
      program: data.program || seedUser.program,
      tier: "Basic",
      sessionsTotal: 8,
      sessionsUsed: 0,
      payments: [],
    };
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(() => setUser(null), []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo(
    () => ({ user, isAuthed: !!user, login, signup, logout, updateUser }),
    [user, login, signup, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
