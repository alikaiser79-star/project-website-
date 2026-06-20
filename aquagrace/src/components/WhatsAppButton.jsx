import { Whatsapp } from "./Icons.jsx";
import { WHATSAPP_URL } from "../data/content.js";

export default function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-whatsapp text-white shadow-cta transition hover:scale-105 active:scale-95"
    >
      <Whatsapp className="h-7 w-7" />
    </a>
  );
}
