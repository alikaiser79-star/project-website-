import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* When building for GitHub Pages we serve from
   `<user>.github.io/<repo>/`. Override at build time with
   `VITE_BASE=/something/` if your repo path is different. */
const base = process.env.VITE_BASE || '/project-website-/';

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5173, host: true },
});
