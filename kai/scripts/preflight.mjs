#!/usr/bin/env node
/* Preflight — the build tripwire. Blocks a push that would fail
   Vercel: raw U+2028/U+2029, >12 functions, tsc errors, esbuild
   per-route failure, vite failure. Exit non-zero on any. */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const ROOT = process.cwd();
let failed = 0;
const log = (m) => process.stdout.write(m + '\n');
const ok  = (m) => log('  \x1b[32mOK\x1b[0m   ' + m);
const bad = (m) => { log('  \x1b[31mFAIL\x1b[0m ' + m); failed++; };
const head = (m) => log('\n\x1b[1m' + m + '\x1b[0m');
function walk(dir, filter) {
  const out = []; let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const p = join(dir, name); let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) out.push(...walk(p, filter));
    else if (filter(p)) out.push(p);
  }
  return out;
}
head('1. Unicode LineTerminator sweep (src/ + api/)');
{
  const files = [...walk(join(ROOT,'src'),p=>/\.(ts|tsx|js|jsx|css)$/.test(p)),
                 ...walk(join(ROOT,'api'),p=>/\.(ts|tsx|js|jsx)$/.test(p))];
  const off = [];
  for (const f of files) { const b = readFileSync(f);
    for (let i=0;i<b.length-2;i++){ if(b[i]===0xe2&&b[i+1]===0x80&&(b[i+2]===0xa8||b[i+2]===0xa9)){off.push(relative(ROOT,f));break;} } }
  if (!off.length) ok(`${files.length} files, no raw U+2028/U+2029`);
  else off.forEach(f=>bad(`raw U+2028/U+2029 in ${f} — use \\u2028/\\u2029`));
}
head('2. Vercel function count (Hobby cap 12)');
{
  const routes = walk(join(ROOT,'api'),p=>/\.ts$/.test(p)&&!/(^|\/)_[^/]+\.ts$/.test(p));
  routes.forEach(r=>log('       · '+relative(ROOT,r)));
  if (routes.length<=12) ok(`${routes.length} function(s) — under the 12 cap`);
  else bad(`${routes.length} functions — OVER the Hobby 12 cap`);
}
head('3. tsc --noEmit');
try { execSync('npx tsc --noEmit',{cwd:ROOT,stdio:'pipe'}); ok('type-check clean'); }
catch(e){ bad('type errors:'); process.stdout.write((e.stdout?.toString()||e.message).slice(0,4000)+'\n'); }
head('4. esbuild compile (every api/ route)');
{
  for (const r of walk(join(ROOT,'api'),p=>/\.ts$/.test(p))) {
    try { execSync(`npx esbuild "${r}" --bundle --platform=node --target=node18 --format=cjs --outfile=/tmp/pf-esb.js`,{cwd:ROOT,stdio:'pipe'}); ok(relative(ROOT,r)); }
    catch(e){ bad(relative(ROOT,r)+' — '+((e.stderr?.toString()||e.message).split('\n').find(l=>/error/i.test(l))||'')); }
  }
}
head('5. vite build');
try { execSync('npx vite build',{cwd:ROOT,stdio:'pipe'}); ok('frontend build clean'); }
catch(e){ bad('vite build failed:'); process.stdout.write((e.stdout?.toString()||e.message).slice(0,4000)+'\n'); }
log('');
if (!failed){ log('\x1b[42m\x1b[30m PREFLIGHT PASSED \x1b[0m — safe to push'); process.exit(0); }
log(`\x1b[41m\x1b[37m PREFLIGHT FAILED \x1b[0m — ${failed} issue(s). Do not push.`); process.exit(1);
