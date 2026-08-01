# KAI Scars — الندوب

*Things that went wrong, what they cost, and the law each one leaves behind. Not a changelog and not an apology log — a changelog says what changed, this says what it taught. An entry earns its place only if the mistake was paid for and the law would have prevented it.*

*Every entry cites something checkable. §48's ledger holds the same discipline for advice; this holds it for wounds.*

---

## 1. The lock with no key

**What happened.** The device lock was found to be decorative: with the PIN lock enabled, the dashboard rendered in full behind an overlay that was 92% opaque, faded in from transparent, and sat at `z-index: 500` — below `.wc-scrim` (540) and `.sheet-scrim` (600), so an open sheet drew the card balance straight over the top of it. A screenshot at 390px showed "FREED: 6,800 EGP/month" and "59,000 EGP left" with the lock on.

The fix was an early return: when locked, build nothing but the overlay. Verified — the page body went from six leaked strings to 35 characters.

**What the fix broke.** That early return also made Settings unreachable while locked. The lock screen's own recovery advice read *"Reset KAI state from Settings → Danger zone to recover"* — an instruction pointing at a door the fix had just sealed, printed at the exact moment it was the only thing on screen.

Worse, three states could reach the lock screen with no way through it at all:

- nothing registered — no credential, no PIN;
- a biometric registered but the browser could not do WebAuthn (a different browser, a PWA reinstall, an OS update). The unlock button only rendered when `webAuthnSupported()`, so the screen read `KAI Locked / AUTH REQUIRED / Waiting for authenticator…` and nothing else, forever;
- biometric failing repeatedly with no PIN to fall back on — `bumpFails()` only revealed the PIN input when `cfg.pinHash` existed.

`verifyCredential()` could also sit unresolved indefinitely, keeping the only button disabled. A hang was itself a lockout.

**Cost.** A production device reached the locked state with no route back in. Recovery required devtools.

**How it was found.** Not by a test. By the question *"if the lock screen appears but I never set a PIN — what PIN is it checking?"* The answer was: none. `verifyPin()` compares against `cfg.pinHash`; with no hash the PIN field is never rendered, so there is no code that works.

> ### The law
> **Every access control must be tested from the locked-out state, not just the unlocked one.**
>
> Testing an unlocked session proves the door opens. It says nothing about whether it can be opened *from outside*, which is the only state that matters when it fails. For any gate, enumerate the states in which the user cannot get in, and verify each one has a route out that does not depend on anything behind the gate.

**Corollaries earned the hard way:**

- A recovery instruction that points at something behind the lock is not a recovery instruction.
- An unopenable state costs nothing to make recoverable — no credential exists to bypass — so there is never a reason to leave one stranded.
- A capability that can hang is a capability that can lock you out. Race it against a timeout and count the timeout as a failure.
- **Warning about a dangerous state is not the same as making it unreachable.** The first version of this fix added an "Add a PIN backup" chip. The state was still reachable three ways: the setup sheet accepted a biometric with no PIN, Settings' "Require lock on launch" accepted the same, and "forget PIN" only disabled the lock when there was *no* biometric — so with one registered it cheerfully left the lock on with the PIN gone. Now `canEnable()` and `canClearPin()` in `src/lib/lock.ts` hold the invariant **lock enabled ⇒ a PIN exists**, in one place, and every mutation path asks them rather than re-deriving the condition. Three paths re-deriving the same rule is how they came to disagree.

**Where it lives:** `src/lib/lock.ts` (`canEnable`, `canClearPin`), `src/components/LockOverlay.tsx`, `src/components/SettingsDrawer.tsx`.
**Commits:** `0cb801e` (the fix that removed the escape), `f3fca19` (recovery restored), and the invariant that followed.

---

## 2. Measurement wrong before the code was

**What happened.** Three times in one session a probe reported a defect that did not exist, and each time the instinct was to change the code:

- A PIN-unlock test built the hash as `SHA-256(salt + "|" + pin)` from a header comment and reported that unlocking was broken. `pinKeyMaterial()` concatenates the *decoded salt bytes* with the pin bytes (`lock.ts:185`). The test was wrong.
- A search for the Settings "Security" section was scoped to a single `div` and reported the section missing. It renders fine.
- A check for the recovery button used a case-sensitive regex; CSS uppercases the label, and `innerText` returns rendered text. The button was there.

A fourth was the reverse and worse: a sweep for auto-opening modals hand-listed two selectors, reported *"modals that opened themselves: []"*, and missed a third that had taken the whole screen. Rewritten to look for anything `position: fixed` covering >60% of the viewport at `z-index >= 100`, it found two more immediately.

**Cost.** Time, and one near-miss where a correct implementation was almost "fixed".

> ### The law
> **When a probe disagrees with the code, suspect the probe first — and never write a check that can only find what you already thought of.**
>
> A checklist of known offenders finds only known offenders. Prefer a property that describes the *shape* of the failure (anything fixed and covering the screen; anything in the DOM while locked) over a list of the instances you happen to remember.

---

## 3. Six crons on a two-cron plan

**What happened.** `vercel.json` asked for six cron entries on a Hobby plan that allows two. Vercel rejects the entire deployment, so production silently kept serving the last valid build. Nothing in the app said so, and three waves of work sat unshipped while everything looked fine.

**Cost.** 24 commits and roughly five weeks stranded behind a config error with no error surface.

> ### The law
> **A config that can block every future deploy belongs in preflight, not in review.**
>
> The failure mode that matters is not "the build broke" — that is loud. It is "the build never ran", which is silent and looks identical to success from inside the app.

**Where it lives:** `scripts/preflight.mjs` §2b — fails on more than two crons, and on any cron firing more than once a day.

---

## 4. The open API

**What happened.** `/api/site/commit` and `/api/site/deploy` accepted a request from anyone on the internet and wrote to the GitHub repositories with a read+write PAT, then triggered a Vercel deploy. `/api/claude` and `/api/agent` spent the Anthropic balance for whoever asked, with `access-control-allow-origin: *`. None of the six routes checked anything.

**Cost.** Unknown, and unknowable — there is no log of who called them.

> ### The law
> **A security control that quietly does nothing when misconfigured is worse than no control, because it converts a known hole into a hole everybody believes is closed.**
>
> `api/_guard.ts` therefore fails *closed*: with no `KAI_API_SECRET` in the environment, every guarded route answers 503 and names the variable to set. The cost — deploying without the variable takes Gmail, Instagram, Claude, the agent, the calendar and site deploys offline — is stated in the response body rather than discovered.

**Corollary:** the shared secret is entered per device into `localStorage`, never a `VITE_*` value. Vite inlines those into the shipped bundle, where a "secret" is a public constant with a frightening name.

**Where it lives:** `api/_guard.ts`, `src/lib/apiAuth.ts`.
**Commit:** `10d51e8`.

---

## 5. Read the rendered output

**What happened.** Three separate bugs measured the wrong thing while passing their own assertions: a volume test that split by count rather than by volume, a rate whose denominator was months-*with*-income rather than months, and a listing included in its own comparison median. All three were found by printing the text a human would read. None was found by an assertion.

> ### The law
> **Assertions prove the code does what you wrote. Only the rendered output shows what it says.**
>
> Read it. Every section in this project that skipped that step shipped a sentence that was confidently wrong.

---

*Add to this file when something is paid for, not when something is merely noticed. A scar is a wound that healed into a rule.*
