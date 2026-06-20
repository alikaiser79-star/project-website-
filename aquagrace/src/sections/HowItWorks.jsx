import SectionHeading from "../components/SectionHeading.jsx";
import { Pin, Home, Trophy, Clock, Whatsapp } from "../components/Icons.jsx";
import { LOCATIONS, AVAILABILITY, WHATSAPP_URL } from "../data/content.js";

const ICONS = { Pin, Home, Trophy };

export default function HowItWorks() {
  return (
    <section id="how" className="py-16 sm:py-20 md:py-24">
      <div className="section">
        <SectionHeading
          eyebrow="How it works"
          title="Three ways to learn with Katie"
          subtitle="Wherever you are in Cairo, there's a way to fit lessons into your week."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {LOCATIONS.map((l) => {
            const Icon = ICONS[l.icon] || Pin;
            return (
              <article
                key={l.id}
                className="card flex flex-col gap-4 transition hover:-translate-y-0.5 hover:border-ocean/40"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-aqua-pale text-ocean">
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">{l.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{l.desc}</p>
                </div>
              </article>
            );
          })}
        </div>

        {/* Availability banner */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-ocean/20 bg-aqua-pale/40">
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-ocean text-white">
                <Clock className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-ocean">
                  Limited availability
                </p>
                <p className="mt-1 font-display text-lg font-bold text-ink">
                  {AVAILABILITY.weekdays}
                </p>
                <p className="text-sm text-ink-soft">{AVAILABILITY.weekends}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Slots fill quickly — message early to secure your preferred time.
                </p>
              </div>
            </div>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary self-start sm:self-auto"
            >
              <Whatsapp className="h-5 w-5" /> Check availability
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
