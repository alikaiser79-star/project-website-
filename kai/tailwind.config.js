/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Surfaces */
        ink:    '#0A0E14',     // page background — deep near-black
        ink2:   '#0E141C',     // card surface
        ink3:   '#141B26',     // elevated surface
        line:   'rgba(255,255,255,0.06)',

        /* Type */
        bone:   '#E8EAEE',     // primary text
        steel:  '#7C8794',     // muted secondary
        steel2: '#A0A8B2',     // slightly brighter quiet text

        /* Accents — used sparingly */
        amber:  '#FFB300',     // primary, hero numbers + key actions
        amber2: '#FFC94A',
        cyan:   '#7FCBFF',     // secondary cool
        cyan2:  '#9FE0FF',

        /* Semantic — only on errors and confirms */
        danger: '#FF6B6B',
        ok:     '#7AE6A8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
      },
      animation: {
        'pulse-soft': 'pulse-soft 3.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
