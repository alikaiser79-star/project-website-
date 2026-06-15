/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep magical twilight purple (kept under the legacy "navy" key
        // so existing utility classes keep working without churn)
        navy: "#1a0e2e",
        "navy-soft": "#2a1845",
        ocean: "#7c3aed",
        aqua: "#5ee0f0",
        "aqua-light": "#cffafe",
        gold: "#fb7185",
        // New explicit palette for girls 6–16
        lavender: "#c4b5fd",
        blossom: "#f9a8d4",
        coral: "#ff8a95",
        sparkle: "#fde68a",
        plum: "#5b21b6",
      },
      fontFamily: {
        display: ['"Fredoka"', '"Quicksand"', "system-ui", "sans-serif"],
        sans: ['"Quicksand"', '"DM Sans"', "system-ui", "sans-serif"],
      },
      keyframes: {
        wave: {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(-25%)" },
        },
        bubble: {
          "0%": { transform: "translateY(0) scale(1)", opacity: "0" },
          "20%": { opacity: "0.7" },
          "100%": { transform: "translateY(-110vh) scale(1.4)", opacity: "0" },
        },
        pulseRing: {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.2", transform: "scale(0.85)" },
          "50%": { opacity: "1", transform: "scale(1.1)" },
        },
        drift: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-14px) rotate(6deg)" },
        },
      },
      animation: {
        wave: "wave 12s ease-in-out infinite",
        "wave-slow": "wave 18s ease-in-out infinite",
        bubble: "bubble 9s linear infinite",
        pulseRing: "pulseRing 1.8s ease-out infinite",
        float: "float 4s ease-in-out infinite",
        shimmer: "shimmer 3s linear infinite",
        twinkle: "twinkle 2.6s ease-in-out infinite",
        drift: "drift 7s ease-in-out infinite",
      },
      boxShadow: {
        glow: "0 0 40px rgba(249,168,212,0.45)",
        card: "0 18px 50px -18px rgba(26,14,46,0.55)",
        sparkle: "0 0 30px rgba(253,230,138,0.6)",
      },
      backgroundImage: {
        "girl-gradient":
          "linear-gradient(135deg,#a78bfa 0%,#f9a8d4 45%,#fdba74 100%)",
        "dreamy-night":
          "radial-gradient(ellipse at top,#3b1768 0%,#1a0e2e 60%,#0e0820 100%)",
      },
    },
  },
  plugins: [],
};
