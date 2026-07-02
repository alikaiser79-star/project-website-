#!/usr/bin/env node
/* ============================================================
   Preflight — the build tripwire.

   Catches, before a push, every failure mode that broke the
   Vercel build this week:

     1. Raw U+2028 / U+2029 bytes in src/ or api/ — these are
        JS LineTerminators that silently break regex literals
        and JSON (the api/ingest.ts "unterminated regular
        expression" that killed three deploys).
     2. Serverless-function count over Vercel's Hobby 12-cap.
     3. tsc --noEmit type errors.
     4. esbuild compile failure on any api/ route (what Vercel
        runs per function).
     5. vite build failure (the frontend).

   Exit non-zero on any failure so a pre-push hook can block.

   Usage:
     node scripts/preflight.mjs         # full run
     npm run preflight
   ============================================================ */

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
let failed = 0;
const log = (m) => process.stdout.write(m + '\n');
const ok   = (m) => log('  \x1b[32mOK\x1b[0m   ' + m);
const bad  = (m) => { log('  \x1b[31mFAIL\x1b[0m ' + m); failed++; };
const head = (m) => log('\n\x1b[1m' + m + '\x1b[0m');

/* ── walk helper ──────────────────────────────────────── */
function walk(dir, filter) {
  const out = [];
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) out.push(...walk(p, filter));
    else if (filter(p)) out.push(p);
  }
  return out;
}

/* ── 1. raw U+2028 / U+2029 sweep ─────────────────────── */
head('1. Unicode LineTerminator sweep (src/ + api/)');
{
  const files = [
    ...walk(join(ROOT, 'src'), (p) => /\.(ts|tsx|js|jsx|css)$/.test(p)),
    ...walk(join(ROOT, 'api'), (p) => /\.(ts|tsx|js|jsx)$/.test(p)),
  ];
  const offenders = [];
  for (const f of files) {
    const buf = readFileSync(f);
    /* U+2028 = E2 80 A8, U+2029 = E2 80 A9 */
    for (let i = 0; i < buf.length - 2; i++) {
      if (buf[i] === 0xe2 && buf[i + 1] === 0x80 && (buf[i + 2] === 0xa8 || buf[i + 2] === 0xa9)) {
        offenders.push(relative(ROOT, f));
        break;
      }
    }
  }
  if (offenders.length === 0) ok(`${files.length} files, no raw U+2028/U+2029`);
  else offenders.forEach((f) => bad(`raw U+2028/U+2029 in ${f} — use \\u2028 / \\u2029 escapes`));
}

/* ── 2. serverless-function count ─────────────────────── */
head('2. Vercel serverless-function count (Hobby cap 12)');
{
  const routes = walk(join(ROOT, 'api'), (p) => /\.ts$/.test(p) && !/(^|\/)_[^/]+\.ts$/.test(p));
  const n = routes.length;
  routes.forEach((r) => log('       · ' + relative(ROOT, r)));
  if (n <= 12) ok(`${n} function(s) — under the 12 cap`);
  else bad(`${n} functions — OVER the Hobby 12 cap. Consolidate with [...path].ts catch-alls.`);
}

/* ── 3. tsc --noEmit ──────────────────────────────────── */
head('3. tsc --noEmit');
try {
  execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe' });
  ok('type-check clean');
} catch (e) {
  bad('type errors:');
  process.stdout.write((e.stdout?.toString() || e.message).slice(0, 4000) + '\n');
}

/* ── 4. esbuild every api route ───────────────────────── */
head('4. esbuild compile (every api/ route, Vercel-style)');
{
  const routes = walk(join(ROOT, 'api'), (p) => /\.ts$/.test(p));
  for (const r of routes) {
    try {
      execSync(
        `npx esbuild "${r}" --bundle --platform=node --target=node18 --format=cjs --outfile=/tmp/preflight-esb.js --external:googleapis`,
        { cwd: ROOT, stdio: 'pipe' },
      );
      ok(relative(ROOT, r));
    } catch (e) {
      bad(relative(ROOT, r) + ' — ' + (e.stderr?.toString() || e.message).split('\n').find((l) => /error/i.test(l)) || '');
    }
  }
}

/* ── 5. vite build ────────────────────────────────────── */
head('5. vite build');
try {
  execSync('npx vite build', { cwd: ROOT, stdio: 'pipe' });
  ok('frontend build clean');
} catch (e) {
  bad('vite build failed:');
  process.stdout.write((e.stdout?.toString() || e.message).slice(0, 4000) + '\n');
}

/* ── verdict ──────────────────────────────────────────── */
log('');
if (failed === 0) { log('\x1b[42m\x1b[30m PREFLIGHT PASSED \x1b[0m — safe to push'); process.exit(0); }
else { log(`\x1b[41m\x1b[37m PREFLIGHT FAILED \x1b[0m — ${failed} issue(s). Do not push.`); process.exit(1); }
