import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Eye } from "./Icons.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../context/UIContext.jsx";

const PROGRAMS = [
  "Kids Swim Lessons",
  "Swim Clinics & Team Prep",
  "Family & Fun Events",
  "Water Ballet — Beginner",
  "Water Ballet — Advanced",
  "Adult Lessons",
];

export default function AuthModal() {
  const { authModal, closeAuth, openLogin, openSignup } = useUI();
  const open = !!authModal;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && closeAuth();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, closeAuth]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button onClick={closeAuth} aria-label="Close" className="absolute inset-0 bg-navy/80 backdrop-blur-md" />
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-navy-soft shadow-card"
          >
            <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-aqua/30 blur-3xl" />
            <button onClick={closeAuth} className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>

            <div className="relative p-7">
              <div className="mb-5 flex gap-1 rounded-full bg-white/5 p-1">
                <button onClick={openLogin} className={`flex-1 rounded-full py-2 text-sm font-medium transition ${authModal === "login" ? "bg-aqua text-navy" : "text-white/70 hover:text-white"}`}>
                  Log In
                </button>
                <button onClick={openSignup} className={`flex-1 rounded-full py-2 text-sm font-medium transition ${authModal === "signup" ? "bg-aqua text-navy" : "text-white/70 hover:text-white"}`}>
                  Sign Up
                </button>
              </div>
              {authModal === "login" ? <LoginForm /> : <SignupForm />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const { closeAuth } = useUI();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    login({ email });
    closeAuth();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="font-display text-3xl font-semibold text-white">Welcome back</h2>
        <p className="mt-1 text-sm text-white/60">Log in to manage your reservations and membership.</p>
      </div>

      <div>
        <label className="label-field">Email</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" className="input-field pl-10" autoComplete="email" />
        </div>
      </div>
      <div>
        <label className="label-field">Password</label>
        <div className="relative">
          <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPw ? "text" : "password"} placeholder="••••••••" className="input-field pr-10" autoComplete="current-password" />
          <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
            <Eye className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-white/60">
          <input type="checkbox" className="accent-aqua" /> Remember me
        </label>
        <button type="button" className="text-aqua hover:underline">Forgot password?</button>
      </div>

      <button type="submit" className="btn-primary w-full">Log In</button>
      <p className="text-center text-xs text-white/50">Demo only — any email/password lets you in.</p>
    </form>
  );
}

function SignupForm() {
  const { signup } = useAuth();
  const { closeAuth } = useUI();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
    program: PROGRAMS[0],
  });
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.fullName.trim()) next.fullName = "Your name is required.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email.";
    if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 7) next.phone = "Enter a valid phone.";
    if (form.password.length < 6) next.password = "At least 6 characters.";
    if (form.password !== form.confirm) next.confirm = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length) return;
    signup(form);
    closeAuth();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <h2 className="font-display text-3xl font-semibold text-white">Create your account</h2>
        <p className="mt-1 text-sm text-white/60">Begin your journey with AquaGrace.</p>
      </div>

      <Field label="Full Name" error={errors.fullName}>
        <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className="input-field" placeholder="Jane Doe" />
      </Field>
      <Field label="Email" error={errors.email}>
        <input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" className="input-field" placeholder="you@example.com" />
      </Field>
      <Field label="Phone" error={errors.phone}>
        <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="input-field" placeholder="+1 555 010 0123" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Password" error={errors.password}>
          <input value={form.password} onChange={(e) => set("password", e.target.value)} type="password" className="input-field" placeholder="••••••" />
        </Field>
        <Field label="Confirm" error={errors.confirm}>
          <input value={form.confirm} onChange={(e) => set("confirm", e.target.value)} type="password" className="input-field" placeholder="••••••" />
        </Field>
      </div>
      <Field label="Program of Interest">
        <select value={form.program} onChange={(e) => set("program", e.target.value)} className="input-field">
          {PROGRAMS.map((p) => <option key={p} className="bg-navy">{p}</option>)}
        </select>
      </Field>

      <button type="submit" className="btn-primary mt-2 w-full">Create Account</button>
    </form>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="label-field">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}
