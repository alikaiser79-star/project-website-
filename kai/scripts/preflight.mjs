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
head('2b. vercel.json cron limits (Hobby)');
{
  /* Three waves of work sat unshipped because vercel.json asked for six
     crons on a plan that allows two. The build never ran, production
     silently stayed on the last valid deploy, and NOTHING said so. A config
     that blocks every future deploy is exactly the class of failure
     preflight exists to catch — same lesson as the U+2028 sweep. */
  const HOBBY_MAX_CRONS = 2;
  try {
    const cfg = JSON.parse(readFileSync(join(ROOT,'vercel.json'),'utf8'));
    const crons = Array.isArray(cfg.crons) ? cfg.crons : [];
    if (crons.length > HOBBY_MAX_CRONS) {
      bad(`${crons.length} cron entries — Hobby allows ${HOBBY_MAX_CRONS}. Vercel REJECTS the deployment, so production stays on the previous build with no error in the app.`);
      crons.forEach(c=>log('       · '+c.schedule+'  '+c.path));
    } else ok(`${crons.length} cron(s) — within the Hobby limit`);

    /* Hobby crons fire once per day. A field with a list, range or step is
       asking for more than that. */
    const subDaily = crons.filter(c => /[,/-]/.test(String(c.schedule).split(/\s+/)[1] || ''));
    if (subDaily.length) {
      bad(`${subDaily.length} cron(s) fire more than once a day — Hobby is daily-only:`);
      subDaily.forEach(c=>log('       · '+c.schedule+'  '+c.path));
    } else if (crons.length) ok('all crons are once-daily');
  } catch (e) {
    bad('could not read vercel.json — ' + String(e.message).slice(0,120));
  }
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
head('4b. §50 feature freeze');
{
  /* The only mechanism in §50 with real teeth, because preflight is the
     gate every push already goes through. It fails on a NEW section
     module in src/lib/kai while the freeze holds — not on edits, so
     fixing what exists stays free, which is the entire point of a
     freeze on BUILDING rather than a freeze on working.

     Deliberately overridable: blocking a genuine emergency fix would be
     worse than the freeze is good. The override is loud and the bypass
     is a visible act rather than a silent one. */
  try {
    const f = JSON.parse(readFileSync(join(ROOT,'FREEZE.json'),'utf8'));
    const start = Date.parse(f.startedAt + 'T00:00:00Z');
    const ends = start + (Number(f.days)||90) * 86400000;
    const left = Math.ceil((ends - Date.now()) / 86400000);
    if (left <= 0) {
      ok(`freeze lifted ${new Date(ends).toISOString().slice(0,10)} — build what you learned`);
    } else {
      const known = new Set(f.modules || []);
      const current = readdirSync(join(ROOT,'src/lib/kai')).filter(n=>n.endsWith('.ts'));
      const added = current.filter(n=>!known.has(n));
      if (!added.length) ok(`frozen, ${left} day(s) left — no new section modules`);
      else if (process.env.KAI_FREEZE_OVERRIDE === '1') {
        ok(`FREEZE OVERRIDDEN for ${added.length} new module(s): ${added.join(', ')}`);
        log('       \x1b[33mYou chose to build during the freeze. That is allowed and it is recorded here.\x1b[0m');
      } else {
        bad(`${added.length} new section module(s) with ${left} day(s) left on the §50 freeze:`);
        added.forEach(n=>log('       · src/lib/kai/'+n));
        log('       Fixes to existing modules are free — only NEW sections are blocked.');
        log('       Deliberate? KAI_FREEZE_OVERRIDE=1 node scripts/preflight.mjs');
        log('       Or open it properly: all three proof-gate conditions, checked in the app.');
      }
    }
  } catch (e) {
    /* No FREEZE.json is not a failure — it is the state before §50 and
       after the freeze is retired. */
    ok('no FREEZE.json — nothing frozen');
  }
}

head('5. vite build');
try { execSync('npx vite build',{cwd:ROOT,stdio:'pipe'}); ok('frontend build clean'); }
catch(e){ bad('vite build failed:'); process.stdout.write((e.stdout?.toString()||e.message).slice(0,4000)+'\n'); }
log('');
if (!failed){ log('\x1b[42m\x1b[30m PREFLIGHT PASSED \x1b[0m — safe to push'); process.exit(0); }
log(`\x1b[41m\x1b[37m PREFLIGHT FAILED \x1b[0m — ${failed} issue(s). Do not push.`); process.exit(1);
