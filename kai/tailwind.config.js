/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:    '#0A0E14',
        ink2:   '#0E141C',
        ink3:   '#141B26',
        amber:  '#FFB300',
        amber2: '#FFC94A',
        cyan:   '#5FE3FF',
        cyan2:  '#9FF0FF',
        bone:   '#E8EAEE',
        steel:  '#7C8794',
        danger: '#FF5C5C',
        ok:     '#7AE6A8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-amber': '0 0 24px rgba(255,179,0,0.45), 0 0 56px rgba(255,179,0,0.18)',
        'glow-cyan':  '0 0 18px rgba(95,227,255,0.4), 0 0 36px rgba(95,227,255,0.15)',
        'panel':      '0 12px 36px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,179,0,0.10)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(255,179,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,179,0,0.06) 1px, transparent 1px)',
      },
      keyframes: {
        'grid-drift': { '0%': { backgroundPosition: '0 0' }, '100%': { backgroundPosition: '40px 40px' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.45' } },
        'scan':       { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100vh)' } },
      },
      animation: {
        'grid-drift': 'grid-drift 18s linear infinite',
        'pulse-soft': 'pulse-soft 2.2s ease-in-out infinite',
        'scan':       'scan 6s linear infinite',
      },
    },
  },
  plugins: [],
};
