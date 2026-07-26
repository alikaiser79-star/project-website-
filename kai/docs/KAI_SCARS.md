# KAI — THE SCARS

**§37 DAS VERMÄCHTNIS.**

Every bug that cost something, its symptom, its root cause, and the rule it
created. The rules are the point. A rule with its scar attached survives; a
rule without one gets optimised away by the next mind that finds it
inconvenient.

Format is fixed: **SYMPTOM → ROOT CAUSE → THE RULE**. If a scar has no rule, it
has not finished being a scar.

---

## THE FIVE THAT MADE THE LAWS

### S1 — The stale PWA cache
**SYMPTOM.** A fix was deployed and verified green, and the device kept showing
the old build. Time was spent debugging code that was already correct.

**ROOT CAUSE.** A PWA service worker served the cached bundle. Nothing in the
UI distinguished "this build" from "some build", so there was no way to tell a
broken fix from a stale one.

**THE RULE — THE FOOTER SHA LAW.** The running build stamps its own commit SHA
into the UI. If you cannot see which build you are looking at, you are not
debugging — you are guessing. This law is why "verified on device" means
anything at all in this project.

---

### S2 — U+2028
**SYMPTOM.** A build that passed locally broke in production. The failure was
nowhere near the change.

**ROOT CAUSE.** A U+2028 line separator — invisible in every editor — inside a
string. Valid in JSON, fatal in JavaScript source, and undetectable by reading.

**THE RULE — PREFLIGHT.** Nothing is pushed without `scripts/preflight.mjs`:
typecheck, every API route compiled, and a full frontend build. The class of
bug that is invisible to a human reader is exactly the class a machine catches
for free. Running preflight is not optional and has never once been a waste.

---

### S3 — The 116MB bundle
**SYMPTOM.** Gmail functions failed to deploy. The error pointed at size, not
at anything written that day.

**ROOT CAUSE.** `googleapis` pulls in the entire Google API surface — 116MB —
to call three endpoints.

**THE RULE — EDGE ONLY, HAND-ROLLED CLIENTS.** API routes run on the Edge
runtime and talk to upstream services over plain `fetch`. No convenience SDK
gets to decide the deploy budget. The Gmail client is roughly a hundred lines
and does exactly three things, which is all it was ever asked to do.

Corollary discovered while fixing it: on Edge there is no `Buffer`. Base64url
is `TextEncoder` + `btoa`.

---

### S4 — localStorage full
**SYMPTOM.** A confirmed booking was recorded and then was not there. No error,
no warning. The Spine appeared to have simply forgotten.

**ROOT CAUSE.** The origin's localStorage was full. `setItem` threw
`QuotaExceededError`, and the write path swallowed it — so an event could be
"logged" and be gone on the next read. The first fix pruned `kai.events`, which
was wrong: the space was held by `kai.state.v1` snapshots. The bug came back,
and he reported it a second time.

**THE RULE — A WRITE THAT CANNOT FAIL SILENTLY.** `writeSafe` returns whether
the write actually landed. `logEvent` proves persistence and self-heals:
trim the tail, run `reclaimStorage()` across the whole origin, retry. Reclaim
never touches the Spine, commitments, or the sync key.

Second rule, learned the hard way: **when a bug is reported twice, the first
fix addressed a symptom.** Reproduce before fixing, and prove the fix against
the reproduction.

---

### S5 — Unnamed arousal
**SYMPTOM.** The interface reacted — a change in state the user could feel —
with no stated cause. It read as the machine having a mood.

**ROOT CAUSE.** A feeling was surfaced without the event that produced it.

**THE RULE — NO FEELING WITHOUT EXPLANATION.** Every reactive state names what
caused it. The system may have a pulse; it may not have a mood. Anything the
user can feel must be traceable to something that happened, or it is
theatre — and theatre in a tool that reports on money is a lie with a nice
animation.

---

## SCARS FROM THE BUILD ITSELF

Recorded because the discipline generalises, not because they were expensive.

### S6 — The heart beat for organs that were not there
**SYMPTOM.** The heart showed 72 BPM with the Command view detached from NOW.
**ROOT CAUSE.** BPM was computed from a source the panel no longer read.
**THE RULE.** A displayed number and the thing it describes come from one call.
Two paths to one number will diverge, and the display is always the liar.

### S7 — iOS spoke nothing
**SYMPTOM.** TTS produced silence on device while working everywhere else.
**ROOT CAUSE.** iOS Safari locks `speechSynthesis` until a user gesture.
**THE RULE.** Prime audio inside the gesture, then verify it actually started.
Platform locks are not bugs to route around; they are conditions to satisfy.

### S8 — Auto-runs counted as approvals
**SYMPTOM.** The system's own automatic executions were being counted as Ali
approving something.
**ROOT CAUSE.** `approveAction` had no idea who called it.
**THE RULE — A MACHINE MAY NEVER SUPPLY ITS OWN CONSENT.** Approval carries an
`auto` flag and auto-runs never count toward earned trust. Without this, KAI
could cement its own autonomy by acting, which is the whole failure mode the
Gate exists to prevent. This rule now appears three times: here, in §33.5
(an advisor cannot judge its own advice), and in §31 (tier 2 can never be
automated, no matter the record).

### S9 — A live key walked through the filter
**SYMPTOM.** §33.2's handover package accepted `sk_live_51H…` — a real Stripe
key — into a file whose entire purpose is holding no secrets.
**ROOT CAUSE.** The token regex stopped matching at the second underscore.
**THE RULE.** A refusal filter is tested with the real thing it must refuse,
not with something shaped roughly like it. Every guard gets adversarial inputs
or it is decoration.

### S10 — `\b` cannot see Arabic
**SYMPTOM.** §36's listing parser read German condition words and silently
failed on Arabic ones.
**ROOT CAUSE.** JavaScript's `\b` is defined on `[A-Za-z0-9_]`. There is no
word boundary between a newline and an Arabic letter, so `/\bعطلان\b/` can
never match anything.
**THE RULE.** His languages are an asset in this project, not an encoding
problem. Anything that parses text gets tested in all three, because a silent
failure in Arabic removes the exact edge the feature was built to exploit.

### S11 — Measurements that measured the wrong thing
**SYMPTOM.** Three separate metrics passed their tests while being structurally
incapable of ever finding what they looked for:
- §35 split income history into halves *by count*, then required the later half
  to have more items — impossible by construction. Real compounding was
  demoted.
- §33.3 counted "months with a missed payment" from months that *had* income,
  making a month where nothing arrived invisible. It could only ever report
  zero misses.
- §36 included a listing in the median it was compared against, dragging the
  reference down and understating exactly the bargains it existed to find.

**ROOT CAUSE.** In all three, the denominator was drawn from the same set as
the thing being measured.

**THE RULE — READ THE RENDERED OUTPUT.** Assertions confirm what you thought
to check. Every one of these was found by looking at what the feature actually
printed, on a realistic fixture, and asking whether the sentence was true. Ship
nothing whose output you have not read as its reader.

### S12 — Inventing the number that does the ranking
**SYMPTOM.** §33.3 ranked a Gmail dependency #1 on `share × 30`, where 30 was a
constant with no source, and printed `damage: 0 days` for a risk it had just
described as unmeasurable.
**ROOT CAUSE.** Wanting a complete ranked list more than wanting a true one.
**THE RULE.** Where a quantity cannot be derived, it is `null` and it is
reported outside the ranking, saying so. Zero means "costs nothing", which is a
claim. Units are never mixed through an invented constant — days become money
only through a measured burn rate.

---

## THE SHAPE OF ALL OF THEM

Nine of these twelve are the same bug: **something was reported as known when
it was assumed.** A cached build reported as the current one. A write reported
as landed. A projection reported as a loss. A constant reported as a
measurement.

The discipline that falls out of it, and the reason preflight and repro-first
are non-negotiable here:

> State what is measured, state what is assumed, and never let the second
> wear the clothes of the first.
