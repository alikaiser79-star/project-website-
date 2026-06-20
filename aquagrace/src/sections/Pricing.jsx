import SectionHeading from "../components/SectionHeading.jsx";
import { Check, Whatsapp, Star } from "../components/Icons.jsx";
import { PRICING, WHATSAPP_URL } from "../data/content.js";

export default function Pricing() {
  return (
    <section id="pricing" className="bg-surface py-16 sm:py-20 md:py-24">
      <div className="section">
        <SectionHeading
          eyebrow="Lessons & pricing"
          title="Simple, transparent rates"
          subtitle="Pay per session or save with a package. All prices in Egyptian Pounds (LE)."
          align="left"
        />

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PRICING.map((p) => (
            <article
              key={p.id}
              className={`relative flex flex-col rounded-3xl border p-6 transition ${
                p.featured
                  ? "border-ocean bg-aqua-pale/30 shadow-card md:-translate-y-2"
                  : "border-line bg-bg hover:border-ocean/40"
              }`}
            >
              {p.featured && (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-coral px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-cta">
                  <Star className="h-3 w-3" /> Most asked for
                </span>
              )}

              <header>
                <h3 className="font-display text-xl font-bold text-ink">{p.title}</h3>
                <p className="mt-0.5 text-sm font-medium text-ocean">{p.subtitle}</p>
                <p className="mt-3 text-sm text-ink-soft">{p.blurb}</p>
              </header>

              <ul className="mt-5 flex-1 divide-y divide-line">
                {p.rows.map((r) => (
                  <li key={r.label} className="flex items-center justify-between py-3 text-sm">
                    <span className="flex items-center gap-2 text-ink">
                      <Check className="h-4 w-4 text-ocean" /> {r.label}
                    </span>
                    <span className="font-display text-base font-bold text-ink">{r.price}</span>
                  </li>
                ))}
              </ul>

              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold transition ${
                  p.featured
                    ? "bg-coral text-white shadow-cta hover:bg-coral-deep"
                    : "border border-line text-ocean hover:border-ocean hover:bg-aqua-pale/40"
                }`}
              >
                <Whatsapp className="h-4 w-4" /> Book this package
              </a>
            </article>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-ink-soft">
          Not sure which fits? <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-ocean underline-offset-4 hover:underline">Message Katie on WhatsApp</a> — she'll help you pick.
        </p>
      </div>
    </section>
  );
}
