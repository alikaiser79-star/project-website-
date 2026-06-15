import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SectionHeading from "../components/SectionHeading.jsx";
import { Pin, Phone, Mail, Send, Check } from "../components/Icons.jsx";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Invalid email";
    if (form.message.trim().length < 8) next.message = "A bit more, please.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSent(true);
    setForm({ name: "", email: "", message: "" });
    setTimeout(() => setSent(false), 5000);
  };

  return (
    <section id="contact" className="relative py-24 md:py-32 bg-navy">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeading
          eyebrow="Say hi"
          title="Visit, call or message us"
          subtitle="We answer every parent message within one business day — promise."
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-4">
            <InfoCard icon={Pin} title="Visit">
              42 Lakeshore Promenade<br />Aquatic District, Floor 2<br />Open 7am – 9pm
            </InfoCard>
            <InfoCard icon={Phone} title="Call">
              <a href="tel:+15550100123" className="hover:text-aqua">+1 (555) 010-0123</a>
            </InfoCard>
            <InfoCard icon={Mail} title="Write">
              <a href="mailto:hello@aquagrace.test" className="hover:text-aqua">hello@aquagrace.test</a>
            </InfoCard>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <div className="relative h-64 w-full bg-[radial-gradient(circle_at_30%_30%,#0e4d8c_0%,#0a1628_70%)]">
                <svg viewBox="0 0 600 260" className="absolute inset-0 h-full w-full opacity-60">
                  <defs>
                    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                      <path d="M30 0L0 0 0 30" fill="none" stroke="#caf0f8" strokeOpacity="0.12" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="600" height="260" fill="url(#grid)" />
                  <path d="M-20 180 Q 150 100 300 160 T 620 140" fill="none" stroke="#00b4d8" strokeOpacity="0.6" strokeWidth="3" />
                  <circle cx="300" cy="148" r="10" fill="#f4a261" />
                  <circle cx="300" cy="148" r="22" fill="none" stroke="#f4a261" strokeOpacity="0.4" />
                </svg>
                <div className="absolute bottom-3 left-3 rounded-md bg-navy/80 px-2.5 py-1 text-[10px] uppercase tracking-widest text-white/70">
                  Map preview · Embed coming soon
                </div>
              </div>
            </div>

            <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name" error={errors.name}>
                  <input value={form.name} onChange={(e) => set("name", e.target.value)} className="input-field" placeholder="Jane Doe" />
                </Field>
                <Field label="Email" error={errors.email}>
                  <input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" className="input-field" placeholder="you@example.com" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Message" error={errors.message}>
                    <textarea rows="4" value={form.message} onChange={(e) => set("message", e.target.value)} className="input-field resize-none" placeholder="How can we help?" />
                  </Field>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button type="submit" className="btn-primary"><Send className="h-4 w-4" /> Send message</button>
              </div>
              <AnimatePresence>
                {sent && (
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 inline-flex items-center gap-2 text-sm text-aqua"
                  >
                    <Check className="h-4 w-4" /> Thanks — we'll be in touch shortly.
                  </motion.p>
                )}
              </AnimatePresence>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoCard({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-aqua/10 text-aqua ring-1 ring-aqua/20">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      </div>
      <div className="mt-3 text-sm text-white/70 leading-relaxed">{children}</div>
    </div>
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
