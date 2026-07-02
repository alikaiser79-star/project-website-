# Part E (Phone Bridge) — Quarantine & Re-entry

**Status: REMOVED from production.** Cut on `main` (commit `be37f91`) so the
Living Command Core could ship. This document is the record of what broke, what's
still risky, and the exact bar Part E must clear before it comes back.

---

## What Part E was

The phone bridge — capture *into* KAI from a phone, three surfaces:

- `api/ingest.ts` — Edge function. OS share-sheet / iOS-Shortcut POST target.
  Routed shared **text → Brain Dump** and shared **image → receipt vision**, then
  stashed the result in `sessionStorage` and 302'd to `/`.
- `api/phone/{list,send,contacts}.ts` — Twilio SMS + WhatsApp read/send, gated
  through the ConfirmationGate (`sms_send` pending kind).
- `src/components/panels/PhonePanel.tsx` — Comms-view panel showing recent
  SMS/WhatsApp.
- PWA `share_target` in `vite.config.ts` manifest.
- Client tools: `read_sms`, `propose_sms`, `read_phone_contacts`; `sms_send`
  executor in `pending.ts`.

All of the above is recoverable from git history at or before `be37f91^`.

---

## What actually broke (three straight failed deploys)

Two distinct failures, both surfaced from the `api/` area, both hid from local
*incremental* builds:

### Failure 1 — Unterminated regular expression (`api/ingest.ts`)

`api/ingest.ts` contained two regex literals whose **patterns were raw U+2028
(LINE SEPARATOR) and U+2029 (PARAGRAPH SEPARATOR) bytes**:

```
.replace(/<U+2028>/g, ' ').replace(/<U+2029>/g, ' ')
```

Per the ECMAScript spec a `RegularExpressionLiteral` may not contain a
`LineTerminator`; both LSEP and PSEP qualify. esbuild bailed:

```
api/ingest.ts:167:75 ERROR: Unterminated regular expression
```

Every downstream error (TS1161, TS2304 "Cannot find name 'g'", TS2362) was
**fallout** — the parser read the rest of the file as a sequence of divisions.

Fixed by writing the ` ` / ` ` escape sequences instead of the raw
characters. **Root lesson: never paste raw bidi/separator Unicode into source.**

### Failure 2 — Vercel Hobby 12-function cap

After the regex fix, the build **compiled clean** and still failed — at the
*deploy* step, not the build step:

```
Build Failed
No more than 12 Serverless Functions can be added to a Deployment on the
Hobby plan.
```

Each `api/<dir>/<action>.ts` is one function. With Part E present the count was
**15** (calendar, claude, ingest, gmail×2, ig×4, phone×3, site×3). Over the cap.

Fixed by consolidating each domain into a single `[...path].ts` catch-all and
prefixing per-action files with `_` (Vercel doesn't count `_`-prefixed files as
routes). Count dropped 15 → 7, then → **5** once phone + ingest were cut.

### Why local checks lied

Local **incremental** `tsc`/`vite` runs reused a warm `node_modules` and never
re-ran the per-function esbuild compile Vercel does. The gap only showed under a
**clean checkout**: `rm -rf node_modules dist && npm ci && npm run build`. That
is now mandatory before any push (see the tripwire).

---

## What's still risky about Part E

1. **`api/ingest.ts` used `runtime: 'edge'`** while every other function is Node.
   Edge + `req.formData()` + base64 image encoding + a raw-string `sessionStorage`
   stash is the most fragile file in the repo. If it comes back it should be
   split: keep the Node default runtime unless Edge is genuinely required, and
   never inline HTML/JS with un-escaped separators.
2. **`googleapis` is a heavy dep** shared with the Gmail functions. Part E didn't
   use it, but any function that imports a barrel can balloon the bundle. Keep
   per-function imports narrow.
3. **Function-count headroom.** Production sits at 5 of 12. Part E adds back
   ingest (1) + phone catch-all (1) = 7. Fine — but any *new* connector must
   check the count first. The tripwire now enforces this.
4. **`sms_send` executor + `propose_sms`/`read_sms` tools remain in the codebase**
   but inert (their endpoints are gone). They compile clean and don't affect the
   build. Prune or reinstate them **with** the bridge, not separately.
5. **Twilio creds** (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   `TWILIO_FROM_NUMBER`, `KAI_PHONE_CONTACTS`) were never set in Vercel — so even
   when Part E built, `/api/phone/*` would 503. Re-entry needs those wired.

---

## Re-entry checklist (all must pass, on a dedicated branch)

Part E comes back **only** when, from a **fresh checkout**:

```
rm -rf node_modules dist
npm ci
npm run preflight        # the tripwire — must print PREFLIGHT PASSED
```

Specifically:

- [ ] **Deps declared.** Anything Part E imports is in `package.json`
      dependencies (not just present in a warm `node_modules`).
- [ ] **No raw Unicode.** `preflight` step 1 green — no U+2028/U+2029 in any
      source file. Inline HTML/JS strings escape separators.
- [ ] **Function count ≤ 12.** `preflight` step 2 green. `ingest` is one
      function; phone routes are consolidated behind one `phone/[...path].ts`.
- [ ] **`tsc --noEmit` clean.** Step 3.
- [ ] **esbuild green on every `api/` route.** Step 4 — this is the check that
      caught the regex bug; it must run per-function, Vercel-style.
- [ ] **`vite build` clean.** Step 5.
- [ ] **Vercel preview deploys GREEN** on the Part E branch *in isolation*
      before merging to `main`. The SHA must move and the function count must
      show ≤ 12 in the deploy summary.
- [ ] **Twilio env vars set** in Vercel, or the panel ships behind a clear
      "not connected" state (it already has one).

Do not merge Part E to `main` until every box is checked and a preview build is
green. It has cost three deploys; it earns its way back.

---

*Written 2026-07 during the Living Command Core ship. Phone code lives in git
history at `be37f91^`.*
