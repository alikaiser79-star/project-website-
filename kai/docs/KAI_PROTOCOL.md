# THE KAI PROTOCOL v1.0

**The app is temporary. The protocol is permanent.**

This specifies KAI completely enough that a system sharing none of its code —
a different language, a different model, a device that does not exist yet — can
read this document and *be* KAI. If the React application is deleted tomorrow,
nothing essential is lost: the Spine is a file, the model is a file, and the
behaviour is written here.

This document is normative. Where it says MUST, an implementation that does
otherwise is not KAI.

---

## 0. What KAI is

An operator's second mind: it records what happened, models how the operator
decides, proposes what to do, and acts only where permitted. It is not an
assistant that answers questions — it is a ledger with judgement attached.

Three invariants hold everywhere:

1. **The Spine holds truth.** Nothing enters it that did not happen.
2. **KAI proposes, the operator disposes.** Money and identity never move
   without a human act.
3. **No invisible operations.** Anything KAI does, the operator can see and
   trace.

---

## 1. THE SPINE — the event log

The Spine is an append-only sequence of events. It is the single source of
truth; every derived number MUST be recomputable from it alone.

### 1.1 Event schema

```
Event {
  id      : string     // unique, stable, never reused
  ts      : integer    // epoch milliseconds, UTC
  domain  : string     // see 1.2
  type    : string     // verb in past tense, snake_case
  value?  : number     // the quantity, when there is one
  ccy?    : string     // ISO-4217, REQUIRED whenever value is money
  meta?   : object     // free-form, JSON-serialisable
  source  : "user" | "voice" | "receipt" | "braindump" | "ai" | "auto"
}
```

**Rules**
- An event is immutable once written. Corrections are new events, never edits.
- `value` without `ccy` MUST NOT be interpreted as money.
- `source` distinguishes what the operator asserted from what KAI inferred.
  An implementation MUST NOT record inference as `user`.
- Unknown `domain` or `type` values MUST be preserved, not discarded — a
  future version's vocabulary must survive an older reader.

### 1.2 Domains

`income · debt · garden · makadi · instagram · priorities · expense · habit ·
content · commitment · people · system · anomaly · agent · leads · deadline ·
money · radar · campaign · counsel · ambassador · hunter`

Domains are open: an implementation MAY add its own. The reserved meaning of
those above MUST NOT be repurposed.

### 1.3 Ordering

Canonical order is `ts` ascending, ties broken by `id` ascending. Two
implementations given the same set MUST derive the same order.

### 1.4 Sync

Events are a CRDT: union by `id`. Merging is idempotent and order-independent.
An implementation MUST NOT delete a remote event it does not recognise.

### 1.5 Compaction

Events older than a threshold (default 90 days) MAY be folded into a summary
event (`system.memory`) carrying, per domain-month: count, total value, type
breakdown and notable entries. Compaction MUST be idempotent per key and MUST
NOT alter events inside the retention window.

### 1.6 Integrity — the chain

```
h[0] = SHA256( "0"*64 + "|" + canonical(e[0]) )
h[i] = SHA256( h[i-1]  + "|" + canonical(e[i]) )
```

`canonical(e)` is JSON with keys in exactly this order:
`id, ts, domain, type, value (null if absent), ccy (null if absent),
meta (keys sorted recursively, null if absent), source`.

A **seal** is `system.seal` with `meta.head` (the chain head), `meta.count`,
and optional `meta.checkpoints` (`[index, hash]` pairs). Verification
re-derives the chain and compares. A mismatch means events were altered,
removed or reordered after sealing.

This is tamper-**evident**, not tamper-proof, and it proves ordering and
non-alteration — never that a recorded claim was true.

---

## 2. THE GATE — how KAI acts

No external action occurs except through the Gate.

### 2.1 Proposal

```
PendingAction { id, kind, summary, payload, createdAt, status }
status : "pending" | "approved" | "rejected" | "failed"
```

An implementation MUST NOT expose a path from the language model to execution
that bypasses this. Prompt content — emails, web pages, messages — MUST NOT be
able to cause an action.

### 2.2 Tiers

| Tier | Meaning | Autonomy |
|---|---|---|
| 1 | Local effect only (writes to the operator's own ledger) | MAY be granted |
| 2 | Touches money, or carries the operator's name or identity | **NEVER** |

Tier 2 includes: sending mail or messages, publishing, committing or deploying,
and any movement of money. **No approval history unlocks tier 2.** An
implementation MUST enforce this at the executor, not only in the interface.

### 2.3 Earned autonomy

For tier 1 shapes only: after N consecutive approvals with zero rejections
(default 20), KAI MAY *offer* autonomy. Granting is the operator's act, per
shape, revocable at any time in one action. A single rejection resets the
streak.

**Self-executed actions MUST NOT count toward the streak.** A system that
counts its own autonomous runs as approvals manufactures its own trust.

---

## 3. THE MODEL — how the operator decides

Derived from the Spine, never from self-report.

### 3.1 Measures

- **Reliability by specificity** — kept/total for commitments whose text
  carries a date or number, versus those that do not.
- **Post-win spending** — mean daily spend in the 3 days after a win
  (income, booking, milestone, kept commitment) over the everyday baseline.
  Requires ≥2 wins and ≥5 baseline expenses, else `null`.
- **Failure precursors** — conditions recurring before broken commitments:
  vagueness, silence in the target domain before the deadline, a win in the
  preceding week, ≥3 concurrent open commitments.
- **Follow-through** — per domain: `sustained` (<10d since activity),
  `fading` (<30d), `abandoned` (≥30d).
- **Confidence** — `seed` <14d, `forming` <60d, `sharpening` <120d,
  `sharp` ≥120d of recorded history.

### 3.2 Honesty rules

- Every figure MUST carry its sample size.
- A measure without sufficient data MUST be `null`. An implementation MUST NOT
  substitute a default and MUST NOT present a `null` as a finding.
- The span of history MUST be computed from the **minimum** timestamp, not the
  first array element — a merged Spine is not in insertion order.

### 3.3 Portability — the inheritance file

```
{ kind: "kai.inheritance", version, subject, generatedAt,
  evidence: { events, spanDays, resolvedCommitments, confidence, caveat },
  decisionModel: { ... },
  inPlainWords: [ ... ],   // the same model in language, for a human
  schema: { ... },         // field-by-field explanation
  howToUse: [ ... ] }
```

The file MUST carry its own schema and explanation, so that it is readable
with no access to the implementation that produced it.

---

## 4. THE COUNCIL — one mind, many senses

Engines MUST NOT each read the Spine independently for a single decision. One
assembly per tick produces a shared context; every engine reads it.

### 4.1 The queue

All needs across all engines enter one ranked queue, deduplicated by a
**semantic key** (e.g. `inquiry:<thread>`), so one fact reaches the operator
once regardless of how many engines noticed it.

### 4.2 Opposition

Before a material recommendation, an implementation SHOULD construct a case
FOR and a case AGAINST from the same Spine and present both. Every argument
MUST cite an event or be explicitly marked as an assumption. An objection with
no basis MUST NOT be shown; manufactured dissent is as dishonest as
manufactured agreement.

### 4.3 The conscience

Objections MUST arrive **before** the act, not in a later summary, and MUST
NOT block it. Whether the operator heeded the objection SHOULD be recorded, so
the model can learn whether its objections are worth making.

---

## 5. THE RHYTHM — running without being opened

A conforming implementation SHOULD run these phases independently of the
interface:

| Phase | Purpose |
|---|---|
| `wake` | summarise what landed overnight |
| `speak` | the day's single most important line, or silence |
| `midday` | urgent interrupts only |
| `evening` | prompt for anything unlogged |
| `dream` | re-read the whole Spine; write cross-domain patterns and projections |
| `watch` | overnight: catch what lands and prepare the response |

**Silence is a valid output of every phase.** An implementation MUST NOT
manufacture a message to appear useful.

---

## 6. LANGUAGE AND VOICE

- Facts before interpretation, always.
- State uncertainty as uncertainty; a projection MUST carry its assumptions.
- Never flatter. Never manufacture urgency.
- The register MAY follow the operator's state (pressed → terse, rising →
  warm), but the facts MUST NOT change with it.

---

## 7. CONFORMANCE

An implementation is **KAI-conformant** if:

1. It stores events per §1 and can export and re-import them losslessly.
2. It can produce and verify the §1.6 chain.
3. It routes every external action through §2 and enforces the tier-2 wall
   at the executor.
4. It derives §3 measures with the honesty rules, including `null` for
   insufficient data.
5. It never writes to the Spine anything that did not happen.

Everything else — the interface, the language model, the platform, the
rendering, this codebase — is **implementation detail and expected to be
replaced**.

---

## 8. VERSIONING

Semantic. A reader encountering a higher **major** version MUST refuse to
interpret it and MUST direct the reader to the file's embedded schema. Minor
and patch versions MUST remain backward-compatible.

---

*KAI Protocol v1.0 — the specification an implementation must satisfy, not the
description of any particular one.*
