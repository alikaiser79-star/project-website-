import SectionHeading from "../components/SectionHeading.jsx";
import { Check, Star, Whatsapp } from "../components/Icons.jsx";
import { WHATSAPP_URL } from "../data/content.js";

const POINTS = [
  "Candidate Master of Sports (CMS) in synchronized swimming",
  "Experienced with children of all ages",
  "Personal approach to every student",
  "Builds skills, confidence and a love for the water",
];

export default function About() {
  return (
    <section id="about" className="py-16 sm:py-20 md:py-24">
      <div className="section grid gap-10 md:grid-cols-12 md:items-center">
        {/* Photo placeholder */}
        <div className="md:col-span-5">
          <div className="relative mx-auto w-full max-w-sm md:max-w-none">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-aqua-pale/50 blur-2xl" />
            <div className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
              <div className="relative aspect-[4/5] bg-gradient-to-br from-aqua-pale to-bg">
                <svg viewBox="0 0 400 500" className="absolute inset-0 h-full w-full">
                  <circle cx="200" cy="210" r="80" fill="#0e7490" opacity="0.18" />
                  <circle cx="200" cy="210" r="56" fill="#0e7490" opacity="0.32" />
                  <path d="M120 350 Q200 270 280 350 L280 420 Q200 380 120 420 Z" fill="#0e7490" opacity="0.42" />
                </svg>
                <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-ocean shadow-card backdrop-blur">
                  Coach Katie · photo placeholder
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="md:col-span-7">
          <SectionHeading
            eyebrow="About the coach"
            title="Meet Katie"
            subtitle="A calm, attentive coach who builds real swimmers — one careful lesson at a time."
          />

          <ul className="mt-6 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-ink">
                <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-aqua-pale text-ocean">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-base">{p}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              <Whatsapp className="h-5 w-5" /> Message Katie
            </a>
            <p className="inline-flex items-center gap-2 text-sm text-ink-soft">
              <Star className="h-4 w-4 fill-current text-coral" /> First trial lesson is free
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
