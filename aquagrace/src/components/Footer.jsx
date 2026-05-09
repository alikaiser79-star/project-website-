import Logo from "./Logo.jsx";
import { Instagram, Facebook, VK, Telegram, Pin, Phone, Mail } from "./Icons.jsx";

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
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-white/55">
              AquaGrace Swimming Academy — premium swim coaching, water ballet and aquatic safety.
            </p>
            <ul className="mt-6 flex items-center gap-2.5">
              {SOCIALS.map(({ name, href, Icon, hover }) => (
                <li key={name}>
                  <a
                    href={href}
                    aria-label={name}
                    className={`grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5 text-white/70 transition ${hover}`}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-aqua">Quick Links</h4>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                ["programs", "Programs"],
                ["membership", "Membership"],
                ["booking", "Booking"],
                ["safety", "Safety"],
                ["careers", "Careers"],
              ].map(([id, label]) => (
                <li key={id}>
                  <button onClick={() => go(id)} className="text-white/70 transition hover:text-aqua">
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-aqua">Contact</h4>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li className="flex items-start gap-2.5">
                <Pin className="mt-0.5 h-4 w-4 flex-none text-aqua/70" />
                42 Lakeshore Promenade, Aquatic District
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 flex-none text-aqua/70" />
                <a href="tel:+15550100123" className="hover:text-aqua">+1 (555) 010-0123</a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 flex-none text-aqua/70" />
                <a href="mailto:hello@aquagrace.test" className="hover:text-aqua">hello@aquagrace.test</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/45 md:flex-row">
          <p>© {new Date().getFullYear()} AquaGrace Swimming Academy. All rights reserved.</p>
          <p className="font-display italic text-white/60">"Where Champions Begin"</p>
        </div>
      </div>
    </footer>
  );
}
