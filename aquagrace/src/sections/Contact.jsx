import SectionHeading from "../components/SectionHeading.jsx";
import { Whatsapp, Phone, Pin, Instagram } from "../components/Icons.jsx";
import {
  WHATSAPP_URL,
  PHONE_DISPLAY,
  PHONE_HREF,
  INSTAGRAM_URL,
} from "../data/content.js";

export default function Contact() {
  return (
    <section id="contact" className="bg-surface py-16 sm:py-20 md:py-24">
      <div className="section">
        <SectionHeading
          eyebrow="Get in touch"
          title="Book your free trial lesson"
          subtitle="Fastest way to reach Katie is WhatsApp — she replies personally, usually within the day."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-12">
          {/* Big WhatsApp card */}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative col-span-12 overflow-hidden rounded-3xl bg-whatsapp p-8 text-white shadow-cta transition hover:brightness-95 md:col-span-7 md:p-10"
          >
            <div className="pointer-events-none absolute -top-12 -right-10 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-44 w-44 rounded-full bg-black/10 blur-2xl" />

            <div className="relative flex flex-col gap-5">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                <Whatsapp className="h-7 w-7" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                  WhatsApp
                </p>
                <h3 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
                  Message Katie now
                </h3>
                <p className="mt-2 max-w-md text-white/90">
                  Tell her a little about who the lessons are for and what days suit you — she'll
                  reply with the next free trial slot.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-whatsapp shadow-card transition group-hover:scale-105">
                <Whatsapp className="h-4 w-4" /> Open WhatsApp
              </span>
            </div>
          </a>

          {/* Side info */}
          <div className="col-span-12 grid gap-4 md:col-span-5">
            <InfoCard icon={Phone} title="Call or text" href={PHONE_HREF}>
              {PHONE_DISPLAY}
            </InfoCard>
            <InfoCard icon={Pin} title="Location">
              Maadi, Cairo
              <span className="mt-1 block text-xs text-ink-muted">Exact pool address shared after booking</span>
            </InfoCard>
            <InfoCard icon={Instagram} title="Instagram" href={INSTAGRAM_URL}>
              See Katie in the water
            </InfoCard>
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoCard({ icon: Icon, title, href, children }) {
  const inner = (
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-aqua-pale text-ocean">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-ocean">{title}</p>
        <p className="mt-1 text-base font-medium text-ink">{children}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        className="card transition hover:-translate-y-0.5 hover:border-ocean/40"
      >
        {inner}
      </a>
    );
  }
  return <div className="card">{inner}</div>;
}
