/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#fbfbf9",
        surface: "#ffffff",
        ink: "#0f172a",
        "ink-soft": "#475569",
        "ink-muted": "#94a3b8",
        ocean: "#0e7490",
        "ocean-deep": "#155e75",
        aqua: "#06b6d4",
        "aqua-pale": "#cffafe",
        coral: "#fb7185",
        "coral-deep": "#e11d48",
        line: "#e5e7eb",
        whatsapp: "#25D366",
      },
      fontFamily: {
        display: ['"Manrope"', "system-ui", "sans-serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 8px 30px -12px rgba(15,23,42,0.10)",
        cta: "0 10px 25px -10px rgba(251,113,133,0.55)",
        ring: "0 0 0 4px rgba(14,116,144,0.10)",
      },
      keyframes: {
        wave: {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(-25%)" },
        },
      },
      animation: {
        wave: "wave 14s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
