import Logo from "./Logo.jsx";
import { Instagram, Whatsapp, Phone, Pin } from "./Icons.jsx";
import { INSTAGRAM_URL, WHATSAPP_URL, PHONE_DISPLAY, PHONE_HREF } from "../data/content.js";

export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="section py-10 md:py-12">
        <div className="grid gap-8 md:grid-cols-3 md:items-start">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-ink-soft">
              Swimming &amp; synchronized swimming lessons in Maadi — for kids and adults.
            </p>
          </div>

          <div className="text-sm text-ink-soft md:justify-self-center">
            <p className="font-semibold text-ink">Get in touch</p>
            <ul className="mt-3 space-y-2">
              <li className="flex items-center gap-2">
                <Pin className="h-4 w-4 text-ocean" /> Maadi, Cairo
              </li>
              <li>
                <a href={PHONE_HREF} className="inline-flex items-center gap-2 hover:text-ocean">
                  <Phone className="h-4 w-4 text-ocean" /> {PHONE_DISPLAY}
                </a>
              </li>
            </ul>
          </div>

          <div className="md:justify-self-end">
            <p className="text-sm font-semibold text-ink">Follow along</p>
            <div className="mt-3 flex items-center gap-2.5">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink-soft transition hover:border-coral hover:text-coral hover:bg-coral/5"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink-soft transition hover:border-whatsapp hover:text-whatsapp hover:bg-whatsapp/5"
              >
                <Whatsapp className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-line pt-6 text-xs text-ink-muted md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Coach Katie. Maadi, Cairo.</p>
          <p>Calm coaching, real progress.</p>
        </div>
      </div>
    </footer>
  );
}
