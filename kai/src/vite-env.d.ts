/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/* Injected by vite.config — VERCEL_GIT_COMMIT_SHA at build time,
   "dev" locally. See vite.config.ts → define. */
declare const __BUILD_ID__: string;
