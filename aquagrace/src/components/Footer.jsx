import { useState } from "react";
import Logo from "./Logo.jsx";
import { Instagram, Facebook, VK, Telegram, Pin, Phone, Mail, Sparkle, Check, Send } from "./Icons.jsx";

const SOCIALS = [
  { name: "Instagram", href: "#", Icon: Instagram, hover: "hover:text-[#E1306C] hover:border-[#E1306C]/40" },
  { name: "Facebook", href: "#", Icon: Facebook, hover: "hover:text-[#1877F2] hover:border-[#1877F2]/40" },
  { name: "VK", href: "#", Icon: VK, hover: "hover:text-[#0077FF] hover:border-[#0077FF]/40" },
  { name: "Telegram", href: "#", Icon: Telegram, hover: "hover:text-[#26A5E4] hover:border-[#26A5E4]/40" },
];

export default function Footer() {
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  return (
    <footer className="relative mt-12 border-t border-white/10 bg-navy">
      <div className="absolute inset-x-0 top-0 -translate-y-px overflow-hidden">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="h-12 w-full text-navy">
          <path d="M0 60 C240 20 480 80 720 50 C960 20 1200 80 1440 50 L1440 0 L0 0 Z" fill="currentColor" />
        </svg>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <NewsletterStrip />

        <div className="mt-12 grid gap-10 md:grid-cols-3">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-white/65">
              AquaGrace Swimming Academy — a magical home for water ballet &amp; swim lessons. Built for girls ages 6–16, with caring classes for adults too.
            </p>
            <ul className="mt-6 flex items-center gap-2.5">
              {SOCIALS.map(({ name, href, Icon, hover }) => (
                <li key={name}>
                  <a
                    href={href}
                    aria-label={name}
                    className={`grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5 text-white/75 transition ${hover}`}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.28em] text-blossom">Quick Links</h4>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                ["ballet", "Water Ballet"],
                ["programs", "Programs"],
                ["adults", "For Adults"],
                ["schedule", "Weekly Schedule"],
                ["showcases", "Showcases"],
                ["membership", "Memberships"],
                ["gift", "Gift Cards"],
                ["faq", "Common Questions"],
              ].map(([id, label]) => (
                <li key={id}>
                  <button onClick={() => go(id)} className="text-white/75 transition hover:text-blossom">
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.28em] text-blossom">Contact</h4>
            <ul className="mt-4 space-y-3 text-sm text-white/75">
              <li className="flex items-start gap-2.5">
                <Pin className="mt-0.5 h-4 w-4 flex-none text-blossom/80" />
                42 Lakeshore Promenade, Aquatic District
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 flex-none text-blossom/80" />
                <a href="tel:+15550100123" className="hover:text-blossom">+1 (555) 010-0123</a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 flex-none text-blossom/80" />
                <a href="mailto:hello@aquagrace.test" className="hover:text-blossom">hello@aquagrace.test</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/55 md:flex-row">
          <p>© {new Date().getFullYear()} AquaGrace Swimming Academy. All rights reserved.</p>
          <p className="font-display text-white/70">"Where Every Girl Shines" ✨</p>
        </div>
      </div>
    </footer>
  );
}

function NewsletterStrip() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState({ status: "idle", msg: "" });

  const submit = (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setState({ status: "error", msg: "Please enter a valid email." });
      return;
    }
    setState({ status: "success", msg: "You're on the list — check your inbox for a sparkle." });
    setEmail("");
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-blossom/30 bg-gradient-to-r from-blossom/15 via-lavender/10 to-coral/10 p-6 md:p-8">
      <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-blossom/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-coral/15 blur-3xl" />

      <div className="relative grid items-center gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-blossom">
            <Sparkle className="h-3.5 w-3.5" /> Stay in the magic
          </div>
          <h3 className="mt-2 font-display text-2xl font-semibold text-white md:text-3xl">
            Get showcase invites &amp; new-class openings
          </h3>
          <p className="mt-1 text-sm text-white/70">
            One thoughtful email a month — never spam, easy to unsubscribe.
          </p>
        </div>

        <form onSubmit={submit} className="md:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (state.status !== "idle") setState({ status: "idle", msg: "" }); }}
              placeholder="you@example.com"
              className="input-field flex-1"
              aria-label="Email address"
            />
            <button type="submit" className="btn-primary whitespace-nowrap">
              <Send className="h-4 w-4" /> Subscribe
            </button>
          </div>
          {state.status !== "idle" && (
            <p
              className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold ${
                state.status === "success" ? "text-blossom" : "text-red-300"
              }`}
            >
              {state.status === "success" && <Check className="h-3.5 w-3.5" />}
              {state.msg}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
