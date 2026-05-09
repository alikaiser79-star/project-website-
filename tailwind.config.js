/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0a1628",
        ocean: "#0e4d8c",
        aqua: "#00b4d8",
        "aqua-light": "#caf0f8",
        gold: "#f4a261",
        "navy-soft": "#102a44",
      },
      fontFamily: {
        display: ['"Playfair Display"', "serif"],
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
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
      },
      animation: {
        wave: "wave 12s ease-in-out infinite",
        "wave-slow": "wave 18s ease-in-out infinite",
        bubble: "bubble 9s linear infinite",
        pulseRing: "pulseRing 1.8s ease-out infinite",
        float: "float 4s ease-in-out infinite",
        shimmer: "shimmer 3s linear infinite",
      },
      boxShadow: {
        glow: "0 0 40px rgba(0,180,216,0.35)",
        card: "0 12px 40px -12px rgba(10,22,40,0.35)",
      },
    },
  },
  plugins: [],
};
