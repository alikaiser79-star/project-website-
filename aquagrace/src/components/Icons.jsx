// Lightweight stroke icon set (no external icon library required)
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const ChevronDown = (p) => (
  <svg {...base} {...p}><path d="M6 9l6 6 6-6" /></svg>
);
export const ChevronRight = (p) => (
  <svg {...base} {...p}><path d="M9 6l6 6-6 6" /></svg>
);
export const ChevronLeft = (p) => (
  <svg {...base} {...p}><path d="M15 6l-6 6 6 6" /></svg>
);
export const X = (p) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const Menu = (p) => (
  <svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
export const Check = (p) => (
  <svg {...base} {...p}><path d="M5 12l4 4 10-10" /></svg>
);
export const Calendar = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" />
  </svg>
);
export const Clock = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const Wave = (p) => (
  <svg {...base} {...p}>
    <path d="M3 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    <path d="M3 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
  </svg>
);
export const Drop = (p) => (
  <svg {...base} {...p}><path d="M12 3l5 7a5.8 5.8 0 11-10 0z" /></svg>
);
export const Shield = (p) => (
  <svg {...base} {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>
);
export const User = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>
);
export const Users = (p) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2 20c1-3.5 3.5-5 7-5s6 1.5 7 5" /><path d="M16 11a3 3 0 100-6" /><path d="M22 20c-.5-2.5-2-4-5-4.5" /></svg>
);
export const Star = (p) => (
  <svg {...base} {...p}><path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z" /></svg>
);
export const Sparkle = (p) => (
  <svg {...base} {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="M12 8l1.5 2.5L16 12l-2.5 1.5L12 16l-1.5-2.5L8 12l2.5-1.5z" /></svg>
);
export const Music = (p) => (
  <svg {...base} {...p}><path d="M9 18V6l11-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>
);
export const Heart = (p) => (
  <svg {...base} {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" /></svg>
);
export const Flame = (p) => (
  <svg {...base} {...p}><path d="M12 3c2 4 6 5 6 10a6 6 0 11-12 0c0-3 2-4 3-6 0 2 1 3 2 3 0-3 0-5 1-7z" /></svg>
);
export const Trophy = (p) => (
  <svg {...base} {...p}><path d="M8 4h8v6a4 4 0 11-8 0z" /><path d="M5 6H3a3 3 0 003 4M19 6h2a3 3 0 01-3 4M9 20h6M12 14v6" /></svg>
);
export const LifeBuoy = (p) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4" /></svg>
);
export const Phone = (p) => (
  <svg {...base} {...p}><path d="M5 4h3l2 5-2 1a11 11 0 005 5l1-2 5 2v3a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /></svg>
);
export const Mail = (p) => (
  <svg {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
);
export const Pin = (p) => (
  <svg {...base} {...p}><path d="M12 22s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>
);
export const Briefcase = (p) => (
  <svg {...base} {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18" /></svg>
);
export const Logout = (p) => (
  <svg {...base} {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
);
export const Plus = (p) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const Eye = (p) => (
  <svg {...base} {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const Instagram = (p) => (
  <svg {...base} {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" /></svg>
);
export const Facebook = (p) => (
  <svg {...base} {...p}><path d="M14 9h3V5h-3a4 4 0 00-4 4v2H7v4h3v6h4v-6h3l1-4h-4V9a1 1 0 011-1z" /></svg>
);
export const Telegram = (p) => (
  <svg {...base} {...p}><path d="M3 12l18-7-3 16-6-4-3 4-1-6 13-9-15 6z" /></svg>
);
export const VK = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12.7 17.6c-5.6 0-9-4-9.1-10.6h2.8c.1 4.9 2.3 6.9 4 7.3V7h2.7v4.1c1.7-.2 3.5-2.1 4.1-4.1h2.7c-.5 2.5-2.4 4.4-3.7 5.2 1.3.6 3.5 2.3 4.3 5.4h-3c-.6-2-2.3-3.5-4.4-3.7v3.7h-.4z"/>
  </svg>
);
export const Whatsapp = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M20.5 3.5A10 10 0 003.7 16.4L2 22l5.7-1.7A10 10 0 1020.5 3.5zM12 20a8 8 0 01-4.1-1.1l-.3-.2-3.4 1 1-3.3-.2-.3A8 8 0 1112 20zm4.6-6c-.3-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1c-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.7-1.6c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.7 4.4 3.8 1.6.6 2.2.7 3 .6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.2-.2-.5-.3z"/>
  </svg>
);
export const Send = (p) => (
  <svg {...base} {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
);
export const CreditCard = (p) => (
  <svg {...base} {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></svg>
);
