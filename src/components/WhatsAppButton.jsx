import { useState } from "react";
import { Whatsapp } from "./Icons.jsx";

const NUMBER = "YOURNUMBER"; // replace with real client number
const HREF = `https://wa.me/${NUMBER}`;

export default function WhatsAppButton() {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={HREF}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group fixed bottom-5 right-5 z-40 inline-flex items-center"
    >
      <span
        className={`pointer-events-none absolute right-16 whitespace-nowrap rounded-full border border-white/15 bg-navy/90 px-3 py-1.5 text-xs font-medium text-white shadow-card backdrop-blur transition-all ${
          hovered ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0"
        }`}
      >
        Chat with us on WhatsApp
      </span>
      <span className="relative grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-card transition hover:scale-105">
        <span className="absolute inset-0 -z-10 animate-pulseRing rounded-full bg-[#25D366]" />
        <Whatsapp className="h-7 w-7" />
      </span>
    </a>
  );
}
