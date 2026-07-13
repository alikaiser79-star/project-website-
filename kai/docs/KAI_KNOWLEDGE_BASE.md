# THE KAI KNOWLEDGE BASE & CTO HANDBOOK

*The official conceptual, architectural, and philosophical reference for the KAI project. Written to be read instead of the code — by a new CTO, or by another AI, who must own and evolve KAI for the next decade.*

> KAI is organised into numbered **sections (§)** that appear throughout the code as comment anchors (e.g. `§14.2`, `AI 7.3`, `Academy 8.2`). These are the project's own chapter markers; this handbook maps them to concepts. When you see `§N` in a file header, it is telling you which feature-epic that module belongs to.

---

# PART I — CORE PHILOSOPHY

## What is KAI?
KAI is a **single-operator personal command core**: a dark, cinematic, voice-enabled Progressive Web App that becomes one person's *exocortex*. It fuses that person's money, businesses, content, relationships, and an autonomous AI layer into a single heads-up display presided over by a living "Core" — an on-screen presence that is KAI itself. It is not a product for a market. It is a bespoke instrument for exactly one человек: **Ali Kaiser**, in Cairo.

## Why was it created?
To solve the problem of a high-agency operator running **too many parallel ventures** (a premium garden/event space "Hidden Garden", a Makadi Red-Sea Airbnb, a German solar day-job, a car-rental income stream, a nascent CX agency, a growing Instagram brand, and a credit card to clear) with **one nervous system and ADHD-shaped attention**. No off-the-shelf tool models *his* reality — his currencies, his organs, his deadlines, his story. KAI exists so that the operator holds one surface, and KAI holds everything else: it remembers, watches, warns, drafts, and rules — while never taking an irreversible action without a human tap.

## Who is it built for?
One user, deeply. The system prompt, the seed data (`seed.ts`), and the config (`kaiConfig.ts`) all encode Ali's real July truth — 59,000 EGP of an 89,000 EGP card at 38% APR, 85 garden plants, a Makadi listing pending Katie's photos, `@hiddengarden.eg` climbing toward 25k. Every design choice assumes *this* operator. Multi-tenancy is a future, not a premise.

## Design philosophy
- **Cinematic minimalism.** A deep "ink" near-black canvas, "bone" text, "steel" muted secondaries, and **amber used sparingly** as the single hero accent. One universal card primitive (`.glass`). Motion is meaningful, never decorative filler.
- **The HUD, not the form.** Information is presented as *organs that call* when they need attention, not as inboxes to fill. The operator reads a cockpit, not a CRM.
- **Keyboard- and voice-first.** ⌘K, ⌘/, ⌘J, 1–5 view jumps, wake-word voice. The mouse is optional.
- **Boot-from-empty is sacred.** A fresh, unseeded install must never throw. Every read path degrades to `[]` or `—`, never a crash. This is a hard, enforced guarantee.

## Architectural philosophy
**One idea, applied everywhere: an append-only event Spine is the single source of truth.** Every meaningful mutation fires an event; every "brain" reasons over those events rather than over self-reported state. On top of that: serverless-only (no long-lived server), Edge-first (a hard-won lesson — see The Pulse), and a hard **12-function Vercel Hobby cap** enforced by a preflight tripwire. Constraints are treated as design inputs, not obstacles.

## AI philosophy
KAI never invents. For anything fact-based it calls a tool to read the real Spine/state first, then answers from data. The model is **tiered** — a heavy model for synthesis/judgment, a cheap fast model for classification/chips — because *cost is a visible number, not a surprise* (`tokens.ts`). The AI is proactive but bounded: it may notice, propose, draft, and rule, but the **outside world is off-limits without a human tap**.

## Human-in-the-loop philosophy — "propose, Kaiser disposes"
This is KAI's spine of trust. The LLM's only path to the outside world is `proposeAction()`, which queues an intent at **The Gate** and waits for a real human tap. Email snippets, web pages, DMs — none of them can talk the brain into shipping anything. This is simultaneously the safety model and the prompt-injection firewall. The one deliberate exception (the Delegate's auto-approve lanes) is explicitly scoped and audit-logged.

---

# PART II — CORE CONCEPTS

*Each concept answers: why it exists · problem solved · how it works · files · APIs · events read/write · future vision · how it could evolve.*

## The Spine (`events.ts`)
- **Why / problem:** Self-reported dashboards lie and drift. The Spine gives KAI a *real history* to reason over, so derived numbers are auditable and commitments can resolve against evidence.
- **How:** An append-only log of `KaiEvent { id, ts, domain, type, value?, ccy?, meta?, source }`, FIFO-capped at 2000 in `localStorage['kai.events']`. `logEvent()` appends + fires the reactive bus; `getEvents(filter)` reads by domain/type/source/time.
- **Files:** `lib/kai/events.ts` (definition), `lib/kai/store.ts` (KV+bus), `lib/store.ts` (state mutators that also emit events).
- **APIs:** `/api/spine` (sync). **Reads/writes:** *everything* — 20 domains, ~80 types (see Part V).
- **Vision / evolution:** typed `meta` (discriminated union per `type`), schema versioning, compaction/archival beyond 2000, server-side event validation. The Spine is the substrate on which the Twin will one day think.

## The Mirror (`commitments.ts`, `mirror.tsx`)
- **Why / problem:** Promises evaporate. The Mirror makes the operator *accountable to his own word* by resolving commitments against reality.
- **How:** A commitment carries a `metric { domain, event, op, target }`. It becomes **kept** the moment a real matching Spine event lands (e.g. `makadi.rate_changed ≥ 55`), **broken** if the deadline passes with no such event. Status transitions emit their own `commitment_kept` / `commitment_broken` events.
- **Files:** `commitments.ts` (engine), `mirror.tsx` (hook + panel + resolver bootstrap), `ai.ts` (natural-language → commitment metric), `ledger.ts` (the Mirror pointed *outward* at other people's promises).
- **Reads:** all domains (to resolve metrics). **Writes:** `commitment.commitment_made|kept|broken`, `people.promised|flaked`.
- **Vision / evolution:** trend-grading over the Mirror itself (the future "Spar"/"Oracle"), streaks of kept promises feeding the Crown.

## The Twin *(unbuilt — the north star)*
- **Why / problem:** Today KAI advises on demand. The Twin is the envisioned end-state: an autonomous second self that reasons over the whole Spine continuously and acts within delegated lanes.
- **How (today):** Only *seeded*. `counsel.ts` calls itself "the seed of the Twin" — the first time KAI reads the entire Spine and issues a single independent ruling. There is no Twin module yet.
- **Files:** conceptually rooted in `counsel.ts`; will draw on `pending.ts` (Gate), `delegate.ts` (lanes), `radar.ts`/`watches.ts` (senses), `context.ts` (world-model).
- **Vision / evolution:** the Counsel's one-ruling-a-day grows into continuous judgment; the Delegate's narrow lanes widen under proven trust; the Twin proposes and, within audited bounds, disposes.

## The Gate (`pending.ts`, `ConfirmationGate.tsx`, `ConfirmationFloating.tsx`)
- **Why / problem:** An AI that can send email / post / deploy is a liability. The Gate makes *every* external action require a human tap — the safety model and the prompt-injection firewall in one.
- **How:** `proposeAction(kind, summary, payload)` queues a `PendingAction` (`kai.pending`) and fires `system.action_proposed`. Only `approveAction()` runs the real `fetch()` from the `EXECUTORS` map; `rejectAction()` discards. The LLM can *only* propose. The **Delegate** may auto-approve a proposal if a standing rule matches (logged as `delegate_auto_approved`).
- **Files:** `pending.ts` (the Hands), the two Confirmation components, `delegate.ts` (auto-lanes), `propose.ts` (Ask-KAI follow-up chips).
- **APIs consumed on approval:** `/api/gmail/send`, `/api/ig/publish`, `/api/site/commit`, `/api/site/deploy`, (`/api/phone/send` — *phantom, unbuilt*).
- **Reads/writes:** `system.action_proposed|action_rejected|email_sent|site_committed|site_deployed|sms_sent`, `instagram.reel_posted`, `system.delegate_auto_approved|rejected`.
- **Vision / evolution:** move the Gate *server-side* (signed action-intents the server verifies) so authorization stops depending on URL secrecy + a client tap. This is the #1 long-term security evolution.

## The Counsel (`counsel.ts`) — §15
- **Why / problem:** The operator needs judgment, not a chat — a single decisive ruling that weighs everything at once.
- **How:** Builds a compact digest of the *whole* Spine (runway, commitments, leads, deadlines, anomalies, radar, inquiries) → one heavy-model call → **one VERDICT + ≤4 cited reasoning lines, max 5 total**. Logs `counsel.ruling`. `/counsel` triggers it; `maybeAutoCounsel()` fires once on a "worthy" morning (an escalation/anomaly/big-radar/inquiry happened).
- **Files:** `counsel.ts`, `CommandBar.tsx` (the `/counsel` intercept), `NightLedger.tsx` (auto-surface).
- **APIs:** `/api/claude` (tier heavy). **Reads:** all domains. **Writes:** `counsel.ruling`.
- **Vision / evolution:** the seed of the Twin — from once-a-day to continuous; from advice to (delegated) action.

## The Voice (`_webpush.ts`, `pulse.ts`, `shadow.ts`, `push-sw.js`) — §14.2
- **Why / problem:** KAI must reach the operator when the app is closed — but only for things that truly matter.
- **How:** Edge-native Web Push, built from scratch: VAPID (RFC 8292 ES256 JWT) + aes128gcm payload encryption (RFC 8291 ECDH/HKDF/AES-GCM) in WebCrypto. The daily pulse sends ≤3 pushes/day (morning dispatch + true-alarm interrupts). A one-tap "Send test push" verifies delivery.
- **Files:** `api/_webpush.ts`, `api/pulse.ts`, `public/push-sw.js` (SW handler), `src/lib/kai/shadow.ts` (client opt-in + subscribe), `SettingsDrawer.tsx` (test button).
- **APIs:** `POST /api/pulse` (register/test), cron `GET /api/pulse`. **Reads (pulse core):** deadlines, income (cash), leads. **Writes:** `system.pulse`.
- **Vision / evolution:** richer notification actions (reply from the notification), per-category quiet hours, delivery receipts.

## The Pulse / Der Schatten (`_pulse-core.ts`, `pulse.ts`, `nightLedger.ts`) — §14
- **Why / problem:** "KAI works while I don't." A heartbeat that runs overnight so the operator wakes to a state already reasoned-over.
- **How:** A Vercel cron (07:30 Cairo) hits `/api/pulse`, which runs the **pure** `runPulseCore(events, now)` over each registered namespace's synced Spine: computes deadline **escalations**, **anomalies**, and ≤3 **push candidates**, writes results back as events, stores the day's dispatch, and speaks (Web Push). The **Night Ledger** shows "while you were away" on first open of the day.
- **Files:** `api/_pulse-core.ts` (pure brain, unit-tested), `api/pulse.ts` (I/O shell), `nightLedger.ts` + `NightLedger.tsx` (surface), `shadow.ts` (opt-in).
- **APIs:** `/api/pulse`, `/api/spine` (reads the synced log). **Writes:** `system.pulse`, `deadline.escalated`, `anomaly.detected`.
- **Vision / evolution:** midday sweeps, the Radar's server-side sweep folded in, smarter escalation ranking, the Twin's continuous loop.

## The Radar / Das Radar (`radar.ts`, `watches.ts`, `RadarPanel.tsx`) — §19
- **Why / problem:** The operator can't watch the world. The Radar gives KAI configurable, continuous, **read-only** eyes.
- **How:** A store of **Watches** (`{name, query, domain, cadence, extractRule, alertRule}`, 5 seeded: Makadi market, Expat pulse, Content radar, Competitor eye, FX+rates). **The Sweep** runs each *due* watch through ONE web search + ONE cheap distill (the **one-search-cap**), logging cited `radar.finding` events. **The Recommender** reads the day's *changed* findings against the Spine and issues ≤3 advisory `radar.recommendation`s — surfaced, never fired. Throttled (3h), foreground-driven.
- **Files:** `watches.ts` (framework), `radar.ts` (orchestrator + recommender + key-health), `RadarPanel.tsx`, `nightLedger.ts` (big moves + recs), `commands.ts` (`watch X for Y`), `api/agent/[...path].ts` (`/search`).
- **APIs:** `/api/agent/search` (sweep), `/api/agent/search?health` (key check), `/api/claude` (recommender). **Writes:** `radar.watch_added|finding|recommendation`.
- **Vision / evolution:** server-side sweep on the pulse, radar→action learning, per-watch confidence, the Recommender proposing through the Gate.

## The Watchers (`mailwatch.ts` + Makadi seed) — §14.3
- **Why / problem:** Some signals are personal, not public — a booking inquiry sitting unanswered costs money.
- **How:** The **Gmail lead-watcher** scans the inbox (one list + one cheap classify per scan, throttled) for genuine booking inquiries and logs `leads.booking_inquiry { thread, from, subject, … }`, which the pulse turns into a **>2h-unanswered alarm**; it also drops a FOUND lead. The **Makadi market-watcher** is a Radar seed watch. Silent when Gmail is unwired.
- **Files:** `mailwatch.ts`, `radar.ts` (runs it on the sweep beat), `api/gmail/_list.ts` (now returns `threadId` for per-conversation dedup), `_pulse-core.ts` (the alarm).
- **APIs:** `/api/gmail/list`, `/api/claude` (classify). **Writes:** `leads.booking_inquiry|booking_replied|found`.
- **Vision / evolution:** reply-tracking that auto-clears the alarm (`markInquiryReplied` is the forward hook), more source-watchers (WhatsApp, platform inboxes).

## The Brain / The Command Core (`commandCoreV6.ts`; dead `commandCore.ts`)
- **Why / problem:** KAI needs a *presence* — a living body the operator relates to, and a render surface for organ signals.
- **How:** `commandCoreV6.ts` (1513 lines, `CORE-V6`) is a bespoke canvas engine rendering the Core, its organs, and reactive states (listen/speak/idle). `commandSignals.ts` feeds it real signals. **`commandCore.ts` (V4, 1206 lines) is dead** — imported by nobody at runtime; survives only via a type-only import in `commandSignals.ts` + `rewind.ts`.
- **Files:** `commandCoreV6.ts`, `commandSignals.ts`, `CommandCorePanel.tsx`, `MobileCommand.tsx`, `KaiCore.tsx` (R3F orb variant).
- **Reads:** organ signals derived from the Spine + typed state. **Writes:** none (it's a view).
- **Vision / evolution:** delete the dead V4 (extract `OrganSignal`/`OrganDom` types first); consolidate the R3F and canvas paths.

## The Memory System (`context.ts`, `retrieval.ts`, `organCard.ts`, `rewind.ts`, `patterns.ts`)
- **Why / problem:** KAI must answer from Ali's real world and remember what happened, not just the last few events.
- **How:** `buildKaiContext()` packs a ~2.6k-char real-numbers block (live organ values with `[CALLING]` flags, deadline-ranked commitments, a 30-day Spine summary) before every AI call. `retrieval.ts` is a client-side keyword+recency index over the *whole* Spine (so "what did I decide about FRISCH in May" pulls the right events). `organCard.ts` gives each organ memory+foresight; `rewind.ts` reconstructs past dashboard states from the append-only log; `patterns.ts` compares this week to last.
- **APIs:** `/api/claude` (consumer of the context). **Reads:** all domains. **Writes:** none (pure read/derive).
- **Vision / evolution:** vector retrieval, longer horizons, the Twin's persistent world-model.

## Event Sourcing
- **Why / problem:** Truth and time-travel. Append-only events make the dashboard auditable, self-reconciling (see Integrity), and replayable (Rewind).
- **How:** see The Spine. Every mutation is an event; state is a projection. `integrity.ts` cross-checks derived numbers against raw events; `rewind.ts` replays history.
- **Vision / evolution:** the canonical CRDT is the event log — this is what makes multi-device sync conflict-free.

## Cross-device Sync / SPINE EVERYWHERE (`sync.ts`, `api/spine`) — §8.1
- **Why / problem:** One operator, many devices (phone, desktop, installed PWA). The Spine must be the same everywhere.
- **How:** A 256-bit client-minted **sync key** (base64url, `kai.sync.v1`) rides in `x-kai-sync-key`; the server SHA-256-hashes it to a private Redis namespace (raw key never stored). The client **pulls** remote events, **unions by id**, **pushes** what the server lacks — the event log is a CRDT-by-construction, so no merge conflicts. Settings sync separately, last-write-wins by timestamp. Foreground/focus/online + a 5s debounce after any Spine write trigger a sync.
- **Files:** `sync.ts`, `api/spine/[...path].ts`. **Storage:** Upstash `spine:ev:<ns>` (cap 5000, TTL 180d), `spine:set:<ns>`.
- **Vision / evolution:** per-event auth, real accounts (the namespace *is* a latent account), conflict-free settings via CRDT too.

## Missions (`agent.ts`, `api/agent`)
- **Why / problem:** Some tasks need multi-step autonomous research/drafting (find leads, write a landing page, market brief).
- **How:** The **client** holds the mission and posts it back each tick with a fresh Spine snapshot; the **server** advances ONE Anthropic tool-use round (tools: `web_search`, `fetch_url`, `read_spine`, `propose_action`) and returns the updated mission. ≤12 steps, token-budgeted, client kill-switch. Presets: PROSPECTOR, OUTREACH, SITEFORGE, MARKET EYE.
- **Files:** `agent.ts` (client engine), `api/agent/[...path].ts` (server runner), `MissionPanel.tsx`.
- **APIs:** `/api/agent/tick`, `ANTHROPIC_API_KEY` + `TAVILY_API_KEY`. **Writes:** `agent.mission_launched|step`.
- **Vision / evolution:** missions that spawn Radar watches, mission templates per organ, the Twin running missions unattended within lanes.

## Campaign Engine / Der Feldzug (`campaign.ts`, `FeldzugPanel.tsx`) — §18
- **Why / problem:** Growing Hidden Garden / Von Kaiser Farms needs disciplined outreach to a fixed target set (schools, clubs, cultural centres).
- **How:** **TARGETS** store (5 seeded: CAC, BCA, DEO, Wadi Degla, Russian Cultural Center) with contact/lang(de/en/ru/ar)/offer/status(scouted→contacted→replied→won/dead)/notes/lastDraft. **DRAFT ENGINE** writes a personalised email in the target's language from the Kaiser story templates, saves it, and — only if a recipient exists — queues `email_send` at **The Gate**. **PIPELINE** kanban. Stale (contacted, cold >5d) targets nudge via the Night Ledger.
- **Files:** `campaign.ts`, `FeldzugPanel.tsx`, `CommandBar.tsx` (`draft outreach for X`), `pending.ts`→`/api/gmail/send`, `api/gmail/_send.ts` (RFC 2047 subject encoding for non-ASCII langs).
- **Writes:** `campaign.target_added|status_changed|draft_queued`. **Reads:** its own store; Spine for context.
- **Vision / evolution:** follow-up cadence automation, reply detection closing the loop, per-target A/B of story angles.

## Growth Engine (Instagram + Content + Crown + Scribe)
- **Why / problem:** The brand (`@hiddengarden.eg` → 25k) is a growth asset; KAI plans, measures, and (gated) publishes.
- **How:** `content.ts`/`ContentQueuePanel` plan reels/carousels/stories (generated hooks/shotlists/captions/hashtags); `IgFeedPanel`/`api/ig` read metrics and (gated) publish; `scribe.ts` runs Spine analytics; `crown.ts` turns life into "legend"/milestones.
- **APIs:** `/api/ig/list|health|publish|derive-token`. **Writes:** `instagram.follower_synced|reel_posted`, `content.*`.
- **Vision / evolution:** content→radar (trending formats already a Radar seed), auto-scheduling behind the Gate, brand-voice consistency via the Envoy.

## Money Engine (Runway · Income · Debt · Expenses · Ledger of Wins · Escape Velocity · Integrity · War Chest)
- **Why / problem:** Clearing the card and building runway is *the* financial mission; every money number must be honest and currency-explicit.
- **How:** `money.ts` enforces currency discipline (`Currency = EGP|USD|EUR`, no bare numbers); `runway.ts` prices spend in **days of freedom** (liquidCash / dailyBurn); `escape.ts` computes THE single number (Escape Velocity); `integrity.ts` cross-checks derived vs raw events; `warchest.ts` gives *freed money marching orders* and scans milestones; `ledger.ts` tracks external promises.
- **APIs:** none server-side (all client brains over the Spine). **Reads:** debt, income, expense, money, makadi. **Writes:** `debt.payment_logged|balance_updated`, `income.cash_set|salary_logged`, `money.deployment|milestone`, `expense.expense_logged`.
- **Vision / evolution:** live FX/USD in the store, forecast curves, automated "deploy this freed cash" proposals through the Gate.

## Garden / Hidden Garden Engine / Der Gärtner (`garden.ts`, `vision.ts`, `photos.ts`) — §10
- **Why / problem:** The garden is Ali's signature venture and a living asset; each plant deserves a record and care.
- **How:** The **Garten Codex** is a per-plant registry (`Plant` with species/zone/heritage/health/photos/diagnoses/carePlan/waterEveryDays). **THE EYE** (`vision.ts`) compresses captured frames for AI plant ID/health reads; **photos.ts** is an on-device IndexedDB image locker (full-res on device, thumbnail dataURL in the record). §10.3 adds care masterplans + a water scheduler.
- **APIs:** `/api/claude` (vision reads). **Writes:** `garden.plant_registered|photographed|diagnosed|watered|health_set|masterplan_generated|plant_added`.
- **Vision / evolution:** heritage-tree provenance (legal evidence noted), watering reminders via the pulse, disease trend detection.

## Makadi Engine (`kaiConfig.makadi`, store mutators, Radar seed)
- **Why / problem:** The Red-Sea Airbnb is rentable but under-monetised (0 nights, listing pending photos); it must be watched and priced.
- **How:** Makadi state (rate in USD, occupancy, next booking, lock/rating) lives in the typed blob; changes emit `makadi.rate_changed|occupancy_set`. The Makadi market-watcher (Radar seed) tracks comparable nightly rates; booking inquiries flow through the Watchers.
- **Reads/writes:** `makadi.*`, `leads.booking_inquiry`. **Vision:** dynamic pricing suggestions, occupancy forecasting.

## Content Engine (`content.ts`, `ContentQueuePanel`, `braindump.ts`)
- **Why / problem:** Turn ideas into a shippable content pipeline without losing them.
- **How:** Brain Dump captures raw thought (voice/text) and Claude sorts it into buckets; the content queue holds planned items with status idea→shot→posted.
- **Writes:** `content.*`, `system.share_captured`. **Vision:** content calendar, auto-generation from Radar trends.

## Notification Engine
See **The Voice** (push) + **Toasts** (in-app, `useToasts`) + OS `Notification` for backgrounded reminders. Three tiers: toast (in-app), OS notification (tab backgrounded), Web Push (app closed). ≤3 pushes/day hard cap.

## Voice Pipeline (`speech.ts`, `tts.ts`, `useKaiPulse`)
- **Why / problem:** Hands-free operation; KAI as a presence you talk to.
- **How:** Web Speech recognition (continuous, wake-word "Kai/Hey Kai/Core") → same pipeline as typed input (`runBuiltin` → streaming Claude); `speechSynthesis` speaks replies **sentence-by-sentence** as the stream arrives; the orb pulses in sync via the Pulse bus.
- **Files:** `speech.ts`, `tts.ts`, `CommandBar.tsx`, `hooks/useKaiPulse.ts`. **Vision:** offline STT, richer barge-in, the iOS "Hey KAI" Shortcut (`docs/phone-bridge.md`).

## Intent / Command Pipeline (`commands.ts`, `CommandBar.tsx`)
- **Why / problem:** Instant, deterministic answers for common asks; graceful fall-through to the LLM.
- **How:** `runBuiltin(text)` matches scripted intents (status, debt, income, tasks, garden, makadi, instagram, runway, briefing, weekly, reminders, focus, convert, deadlines, `watch X for Y`). Async intents (`/counsel`, `draft outreach for X`, commitments) are intercepted in `CommandBar.submit()` before the sync built-ins; anything unmatched streams to Claude.
- **Vision / evolution:** a real intent classifier, more async commands, per-view command palettes.

## Planner
KAI has **no standalone planner module**; planning is distributed: `autopilot.ts` (the morning loop), missions (`agent.ts`), the pulse (server planning), and the Counsel (judgment). A unified planner is a natural future consolidation.

## Tool System (`tools.ts` client, mission tools server)
- **Why / problem:** Let Claude *do*, not just talk — safely.
- **How:** `tools.ts` (1014 lines) defines ~40 tools split into **reads** (run directly: `get_state_snapshot`, `get_calendar`, `get_runway`, `read_inbox`, `read_ig`, `query_events`, `get_ledger`, …) and **proposals** (route through the Gate: `propose_email`, `propose_ig_post`, `propose_site_commit|deploy`, `propose_sms`). Executed in a ≤4-round streaming loop.
- **APIs:** all read/write endpoints (reads direct, writes via Gate). **Vision:** server-verified tool intents, per-tool auth scopes.

## Autopilot (`autopilot.ts`)
- **Why / problem:** A proactive morning loop that assembles the day.
- **How:** Runs KAI's morning routine; logs `autopilot_run|autopilot_error`. **Vision:** merge with the pulse/planner into one autonomous loop.

## Delegate (`delegate.ts`, `DelegatePanel.tsx`)
- **Why / problem:** Some safe, repetitive proposals shouldn't need a tap.
- **How:** Standing rules (name, lane, optional summary regex) that **auto-approve or auto-reject** a matching proposal at the Gate, logged as `delegate_auto_approved|rejected`. Explicitly narrow; **`site_deploy` is never auto-approvable**; the panel warns "audit later in the Spine."
- **Security note:** this is the one sanctioned Gate bypass — see the audit. **Vision:** trust that widens as the Twin proves itself.

## Vault (`vault.ts`, `backup.ts`, `VaultPanel.tsx`) — §6.4 / §8.2
- **Why / problem:** An offline-first document/asset locker + full-state backup so nothing is lost.
- **How:** `vault.ts` stores documents offline in the PWA; `backup.ts` exports/imports the entire KAI state as JSON (danger-zone reset). **Vision:** encrypted vault, selective restore.

## Intel (`IntelStrip`, `external.ts`, `news.ts`, `insights.ts`)
- **Why / problem:** Ambient situational awareness beneath the main grid.
- **How:** live Cairo weather (Open-Meteo), crypto (CoinGecko), prayer times (Aladhan), Hacker News ticker, session uptime, locally-computed insights, holdings map, agenda — all keyless, SW-cached (SWR). **Vision:** operator-relevant feeds (FX already in Radar), configurable strip.

## Runway / Tollgate (`runway.ts`, `TollgatePanel.tsx`) — §6.1-adjacent
Prices any discretionary spend in **days of freedom** (`liquidCash / dailyBurn`), with a payday cushion. The gut-check before a purchase. Reads expense/income events; no writes beyond `income.cash_set`.

## Ledger (`ledger.ts`, `LedgerPanel.tsx`) + Ledger of Wins (`LedgerOfWinsPanel.tsx`)
The Mirror pointed **outward** — tracks other people's promises (Honda renter, court ally, contractor) via `people.promised|flaked`; the Ledger of Wins records deployments of freed money (`money.deployment`).

## War Chest (`warchest.ts`, `WarChestSession.tsx`) — §9
"Freed money gets marching orders." Scans milestones, runs sourced deployment-research sessions (a mission that fetches real EGP figures with source URLs), fires victory states. Writes `money.milestone|deployment`.

## Integrity (`integrity.ts`) — §13.2 TRUTH
The dashboard must never disagree with itself. Cross-checks debt vs payment history, income vs sources, Escape Velocity inputs, and currency tags on 100% of money events; any mismatch is a discrepancy card naming the exact events, with a reconcile flow. Pure read over the Spine.

## Escape Velocity (`escape.ts`) — §6.1
THE one number that rules everything — the single headline metric of financial escape. Reads income/debt/expense; feeds Integrity and the Money view.

## Priorities · Goals · Habits · Journal · Focus
- **Priorities** (`store.ts` blob + `PrioritiesPanel`): drag-to-reorder day list; `priorities.task_done`.
- **Goals** (`goals.ts`, `types.Goal`): four headline objectives, optionally bound to live sources (debt/plants/ig). Fully editable.
- **Habits** (`habits.ts`): four daily habits with 7-day heatmap streaks.
- **Journal** (`journal.ts`, `JournalDrawer`): ⌘J quick capture, searchable, timestamped.
- **Focus** (`focusTimer.ts`, `FocusTile`): 25/5/50-min blocks surviving refresh; `system.focus`.
All are localStorage-backed, Spine-emitting where meaningful, and boot-from-empty safe.

---

# PART III — EVERY VIEW

KAI has **five views** (no router — a `view` state string persisted to `kai.view`; 1–5 jump; swipe on mobile). Four are `React.lazy()` chunks; Command renders one organism.

| View | Purpose (why it exists) | Panels |
|---|---|---|
| **Command** | The daily cockpit — the Core, today's moves, the loop, the Gate. The home surface. | `CommandCorePanel` (desktop) / `MobileCommand` (mobile) around the shared render engine; ConfirmationFloating (the Gate). |
| **Money** | Runway, income, debt, spend — the financial mission in one place. | Analyst, EscapeVelocity, Tollgate, Income, Debt, Expenses, LedgerOfWins. |
| **Growth** | Content, Instagram, the legend — the brand engine. | ContentQueue, IgFeed, Instagram, GartenCodex, Crown, Lektion, Scribe. |
| **Ops** | Garden, Makadi, deadlines, leads, missions, radar — the operating businesses. | Deadlines, Mission, **Radar**, Leads, Garden, Makadi, Ledger, Mirror, Priorities. |
| **Comms** | Inbox, phone, sites, voice, campaign — the outward channels. | Autopilot, Inbox, Site, Watchtower, Envoy, **Feldzug**, Delegate, Vault. |

Each view exists to group organs by the operator's *mode of attention*: deciding (Command), surviving financially (Money), building the brand (Growth), running the ventures (Ops), reaching the world (Comms).

---

# PART IV — AI

## Claude integration
All model access is proxied through **`/api/claude`** (Edge, streams SSE) — the browser never sees the key. Client callers: `askClaude` (non-stream) and `askClaudeStream` (SSE, 4-round tool loop) in `lib/claude.ts`. Missions use a separate server runner (`/api/agent`).

## Tool calling
Two surfaces: the **command-bar tool loop** (`tools.ts`, ~40 tools; reads run locally, writes route through the Gate) and the **mission tools** (`web_search`, `fetch_url`, `read_spine`, `propose_action`) on the server. Tool calls are surfaced inline in italics so the operator sees what KAI did; each fires a toast badge.

## Streaming
`askClaudeStream` parses SSE frames tolerant of CRLF boundaries (a real bug once caused "frozen answers"), accumulates text + tool_use blocks, executes tools, and continues up to 4 rounds. Voice speaks each completed sentence as punctuation lands.

## Context generation
`buildKaiContext()` (`context.ts`) + `retrievalBlock()` (`retrieval.ts`) + `getCommandSignals()` assemble a real-numbers, deadline-ranked, 30-day-summarised, keyword-retrieved block so KAI answers from data. Boot-from-empty safe.

## Memory retrieval
`retrieval.ts` — client-side keyword+recency scoring over the entire Spine (stopword-filtered tokenisation), so old-but-relevant events surface, not just recent ones.

## Prompt structure
`kaiConfig.claudeConfig.systemPrompt` defines KAI's persona (calm, dry, British), the operator's full world (businesses, debt, Instagram), how to talk (direct, no fluff, name-occasionally), how to answer (never invent — call `get_state_snapshot`/`get_calendar` first), and when to act (the tool list).

## Model routing / heavy vs cheap
`claudeConfig`: `modelHeavy = claude-sonnet-4-6` (Council, Counsel, Debrief, masterplans, drafts, recommender), `modelCheap = claude-haiku-4-5` (Explain, chips, mail classify, watch distill). Callers pass `{tier}`; the proxy forwards whichever the client sends.

## Token strategy — §13.3d MODEL DISCIPLINE
`tokens.ts` logs `{feature, input, output, model}` as `system.tokens` events; `tokenTotals(days)` aggregates by feature. Cost is a *visible number* in the UI, never a surprise. Missions carry per-mission token budgets; the AI-tokens tile shows live spend.

---

# PART V — THE EVENT SPINE (event catalogue)

**Shape:** `KaiEvent { id, ts, domain, type, value?, ccy?, meta?, source }`. **Sources:** `user | voice | receipt | braindump | ai | auto`. **Domains (20):** income, debt, garden, makadi, instagram, priorities, expense, habit, content, commitment, people, system, anomaly, agent, leads, deadline, money, radar, campaign, counsel.

| Domain.type | Producer | Consumer(s) | Payload / meaning |
|---|---|---|---|
| `income.cash_set` | setLiquidCash | runway, integrity, counsel | value=EGP liquid cash on hand |
| `income.salary_logged` | money flows | ledger, analyst | value=income received |
| `debt.payment_logged` | applyDebtPayment | Mirror, warchest, integrity | value=EGP paid |
| `debt.balance_updated` | applyDebtPayment | Mirror, escape, integrity | value=new balance |
| `makadi.rate_changed` | updateMakadi | Mirror, radar (market), integrity | value=rate, ccy set |
| `makadi.occupancy_set` | updateMakadi | analyst, counsel | value=0..1 occupancy |
| `garden.plant_added` | updateGarden | goals (plants), Mirror | value=new absolute count |
| `garden.plant_registered/photographed/diagnosed/watered/health_set/masterplan_generated` | Der Gärtner | GartenCodex, vision | per-plant lifecycle in meta |
| `instagram.follower_synced` | upsertInstagram | goals (ig), Scribe, growth | value=followers, meta.handle |
| `instagram.reel_posted` | Gate (ig_publish) | Scribe, crown | value=1, meta.handle |
| `priorities.task_done` | priorities | analyst, debrief | task completion |
| `expense.expense_logged` | expenses/receipts | runway, integrity | value, ccy, category |
| `commitment.commitment_made/kept/broken` | Mirror | crown, debrief, counsel | promise lifecycle |
| `people.promised/flaked` | Ledger | ledger panel, trust | external promises |
| `leads.found/stage_changed` | leads/mailwatch | LeadsPanel, pulse | pipeline movement |
| `leads.booking_inquiry` | mailwatch | pulse (>2h alarm), leads | meta.thread/from/subject |
| `leads.booking_replied` | markInquiryReplied | pulse (clears alarm) | meta.thread |
| `deadline.set` | deadlines | pulse, Mirror | hard date |
| `deadline.escalated` | pulse core | Night Ledger, counsel | meta.tier/days/text |
| `anomaly.detected` | anomaly watch / pulse | Night Ledger, counsel | meta.detail |
| `agent.mission_launched/step` | agent.ts | MissionPanel | mission progress |
| `radar.watch_added` | addWatch | RadarPanel | new watch |
| `radar.finding` | logFinding (sweep) | RadarPanel, NightLedger, counsel | value=changed?1:0, meta.summary/source/big |
| `radar.recommendation` | recommend() | RadarPanel, NightLedger | meta.title/why/kind |
| `campaign.target_added/status_changed/draft_queued` | campaign.ts | FeldzugPanel, NightLedger(stale) | outreach lifecycle |
| `counsel.ruling` | counsel() | NightLedger, lastRuling | meta.verdict/lines |
| `money.deployment/milestone` | warchest | LedgerOfWins, crown | freed-money moves |
| `system.action_proposed/rejected` | Gate | Gate UI, audit | external-action lifecycle |
| `system.email_sent/site_committed/site_deployed/sms_sent` | executors | audit, Scribe | confirmed external actions |
| `system.delegate_auto_approved/rejected` | Delegate | audit | auto-lane fires |
| `system.pulse` | pulse core | Night Ledger, counsel | heartbeat ran |
| `system.focus` | focusTimer | analyst | focus block |
| `system.tokens` | logTokens | tokens tile | model spend |
| `system.share_captured` | share intake | inbox/braindump | OS-share payload |
| `system.lesson / shutdown_review` | Academy / protocol | drill, debrief | learning loop |

*(Additional seed-data types — `couch_installed`, `lock_replaced`, `arrears_paid`, `nights_booked`, `rent_paid`, `trip_makadi`, `gear_glasses` — are one-off historical facts written by `seed.ts` to encode Ali's real July truth.)*

**Lifecycle:** produced by a UI/voice/AI/auto action → appended (cap 2000) → fires the reactive bus → consumed by brains (derive numbers/verdicts) and panels (re-render) → synced by id-union across devices → read by the server pulse for overnight reasoning.

---

# PART VI — STORAGE

## localStorage (per-device — the primary store; ~50 `kai.*` keys)
| Key | Holds |
|---|---|
| `kai.state.v1` | the typed `KaiPersisted` blob (priorities, settings, debt, history, journal, habits, reminders, goals, income, snapshots, garden, makadi, instagram, fx, expenses, contentQueue, liquidCash) |
| `kai.events` | the Spine (append-only, cap 2000) |
| `kai.sync.v1` | sync config (key, status, settingsTs/Hash, lastSyncAt) |
| `kai.pending` | Gate queue of PendingActions |
| `kai.commitments` | Mirror commitments |
| `kai.leads` | agency pipeline |
| `kai.targets` / `kai.targets.seeded.v1` | Feldzug targets + seed flag |
| `kai.watches` / `kai.watches.seeded.v1` | Radar watches + seed flag |
| `kai.missions` | mission engine state |
| `kai.people` / `kai.promises` | Ledger contacts + external promises |
| `kai.delegate` | auto-approve rules |
| `kai.crown` / `kai.warchest.acked` / `kai.warchest.fired` | legend + war-chest state |
| `kai.content.v1` | content queue |
| `kai.deadlines` | Calendar of War |
| `kai.garden.codex` / `kai.garden.seeded.v1` | Garten Codex + seed |
| `kai.lock.v1` | Lock config (WebAuthn/PIN hash) |
| `kai.autopilot` / `kai.watchtower` / `kai.envoy.active` | loop/ambient/voice-register state |
| `kai.shadow.enabled` | Der Schatten opt-in |
| `kai.radar.lastSweep` / `kai.radar.lastReco` | Radar throttles |
| `kai.mailwatch.last` / `kai.mailwatch.seen` | mail-watch throttle + dedup |
| `kai.counsel.autoDay` | Counsel once-a-day gate |
| `kai.nightledger.seen` | Night Ledger day gate |
| `kai.drill.streak` / `kai.lektion.streak` / `kai.debrief.shown` | Academy learning loop |
| `kai.onething.*` / `kai.daycompile.*` / `kai.shutdown.*` / `kai.energy.*` | Protocol (ADHD OS) day-state |
| `kai.view` | active view | `kai.boot` / `kai.build.seen` / `kai.install.seen` | first-run flags |
| `kai.lastBriefing` / `kai.fixlock.lastShown` / `kai.focus.v1` | briefing/reminder/focus |
| `kai.share.pending` / `kai.pendingShare` | OS-share intake |
| `kai.seeded.v3` | Spine seed run-once guard |
| `kai.weather.tempC` | cached intel value |

## IndexedDB
Full-resolution **plant images** (Garten Codex), keyed by `PlantPhoto.id`. Only a small thumbnail dataURL rides in the localStorage record.

## Upstash Redis (shared, per sync-namespace `<ns> = sha256(syncKey)`) — via REST
`spine:ev:<ns>` (events HASH, dedup by id, cap 5000, TTL 180d) · `spine:set:<ns>` (settings STRING) · `kai:pulse:reg` (set of namespaces) · `kai:pulse:cfg|dispatch|sent:<ns>` (pulse config, day dispatch, push counters).

## Browser cache (Workbox)
Precache keyed `kai-<build-sha>` (new deploy evicts old) · `kai-fonts` (CacheFirst 30d) · `kai-data` (Open-Meteo/CoinGecko/Aladhan/HN, SWR 30min) · `navigateFallback: index.html`.

---

# PART VII — APIs

*8 functions (Hobby cap 12); KAI-authored ones are Edge, `googleapis` ones Node. `[...path].ts` dispatchers collapse multiple actions into one function.*

| Endpoint | Runtime | Does | Called by | Payload | Security | Future |
|---|---|---|---|---|---|---|
| `/api/claude` | edge | Anthropic Messages proxy (SSE) | CommandBar, every AI feature | `{model, system, messages, tools, stream}` | **none** (open proxy, `ACAO:*`) | add server auth; rate-limit |
| `/api/agent/tick` | edge | Mission tool-use round | `agent.ts` | `{mission, spine}` | **none** | auth; SSRF allowlist on fetch_url |
| `/api/agent/search[?health]` | edge | Radar sweep (1 search+distill) / key health | `radar.ts` | `{query, extractRule, alertRule, prior}` | none | fold into server pulse |
| `/api/spine/pull\|push\|settings\|health` | edge | Cross-device Spine sync | `sync.ts` | `{events}` / `{data, ts}` | **key** (`x-kai-sync-key` ≥16, hashed→ns) | per-event auth |
| `/api/pulse` (GET cron / POST) | edge | Heartbeat + Web Push; register/test | Vercel cron, `shadow.ts` | `{tz, subscription}` / `{action:'test'}` | cron: `Bearer CRON_SECRET`; POST: sync-key | — |
| `/api/gmail/list` | node | Inbox headers (read) | mailwatch, `read_inbox` | `?q=` | **none** (read leak) | auth |
| `/api/gmail/send` | node | **Send email as Ali** | Gate (`email_send`) | `{to, subject, body}` (RFC 2047 subj) | **none** (Gate is client-only) | server auth |
| `/api/ig/list\|health` | node | IG metrics (read) | `read_ig` | — | **none** | auth |
| `/api/ig/publish` | node | **Post to Instagram** | Gate (`ig_publish`) | media_type + https URL | **none** | auth |
| `/api/ig/derive-token` | node | One-time token dump | setup | — | **key** (`x-kai-setup-secret`) | — |
| `/api/calendar` | node | Read-only Google Calendar | `get_calendar` | — | **none** (read leak) | auth |
| `/api/site/commit` | node | **Commit to GitHub** | Gate (`site_commit`) | path (traversal-blocked, ≤256KiB) | **none** | auth |
| `/api/site/deploy` | node | **Trigger Vercel deploy** | Gate (`site_deploy`) | allowlisted deploy hook | **none** (never Delegate-auto) | auth |
| `/api/site/deploys` | node | Deploy status (read) | `read_site_deploys` | — | **none** | auth |
| `/api/phone/*` | — | **PHANTOM — referenced, not implemented** | `sms_send` executor, phone tools | — | — | build or remove |

**Overarching security model (today):** authorization for external actions lives in the *client* Gate; the server perimeter is essentially "the URL is secret" + `CRON_SECRET`/sync-key/setup-secret on three routes. **The #1 evolution:** a shared-secret/session header enforced server-side on all write/proxy/private-read endpoints, tightened CORS, and eventually a server-verified Gate.

---

# PART VIII — MODULES (`src/lib/kai/*`)

*Why each exists + how it talks to the rest. All communicate through the Spine (`logEvent`/`getEvents`) and the reactive bus (`emit`/`subscribe`); AI modules call `/api/claude`.*

| Module | § | Why it exists |
|---|---|---|
| `events.ts` | Spine | The append-only event log — the substrate everything reads/writes. |
| `store.ts` | — | Generic localStorage KV + the reactive version bus (`emit/subscribe`). |
| `sync.ts` | §8.1 | Client half of SPINE EVERYWHERE — pull-union-push across devices. |
| `commitments.ts` / `mirror.tsx` | Mirror | Resolve promises against Spine events; the accountability engine + its panel. |
| `ai.ts` | — | Map a spoken promise to a real Spine metric (or null). |
| `context.ts` / `retrieval.ts` | §13.3a | Build the real-numbers AI context + keyword-retrieve the whole Spine. |
| `pending.ts` | Gate | The Hands — the only path to external action; propose→approve→execute. |
| `propose.ts` | AI 7.5 | Ask-KAI follow-up chips (draft email / add commitment / task) → Gate. |
| `delegate.ts` | — | Standing auto-approve/reject lanes at the Gate. |
| `counsel.ts` | §15 | Read the whole Spine → one cited ruling (seed of the Twin). |
| `radar.ts` / `watches.ts` | §19 | The watch framework + sweep + recommender (KAI's read-only eyes). |
| `mailwatch.ts` | §14.3 | Gmail lead-watcher → booking-inquiry events. |
| `campaign.ts` | §18 | Der Feldzug — targets + multilingual draft engine → Gate. |
| `agent.ts` | — | Client mission engine (ticks against `/api/agent`). |
| `runway.ts` | §6.1 | Tollgate — spend priced in days of freedom. |
| `escape.ts` | §6.1 | Escape Velocity — the one number. |
| `money.ts` | §13 | Currency discipline (every value carries EGP/USD/EUR). |
| `ledger.ts` | — | The Mirror pointed outward — others' promises. |
| `warchest.ts` | §9 | Freed money gets marching orders + milestone scans. |
| `integrity.ts` | §13.2 | Self-reconciliation — dashboard never disagrees with itself. |
| `deadlines.ts` | §6.2 | Calendar of War — hard dates with escalation. |
| `anomaly.ts` | AI 7.4 | Client-side statistical anomaly detection. |
| `patterns.ts` | §13.3b | Week-over-week pattern memory. |
| `scribe.ts` | — | Spine analytics. |
| `analyst.ts` | AI 7.3 | The daily brief. |
| `debrief.ts` / `drill.ts` | Academy 8.2-8.3 | Weekly review + prove-yesterday's-lesson learning loop. |
| `protocol.ts` | §6.3 | The ADHD operating system — ONE THING, day-compile, shutdown. |
| `crown.ts` | — | Life becomes legend (milestones/identity). |
| `envoy.ts` | — | Three voice registers KAI can write in. |
| `autopilot.ts` | — | The morning loop. |
| `watchtower.ts` | — | Ambient triggers. |
| `garden.ts` / `vision.ts` / `photos.ts` | §10 | Der Gärtner — plant registry, plant vision, on-device photo locker. |
| `leads.ts` | — | Agency/booking pipeline store. |
| `organCard.ts` / `rewind.ts` | §7 | Organ memory+foresight; replay past dashboard states. |
| `commandSignals.ts` / `commandCoreV6.ts` | Core | Real signals → the living-body render engine. |
| `commandCore.ts` | — | **DEAD V4 engine** (type-only import survivor — delete after extracting types). |
| `nightLedger.ts` / `shadow.ts` | §14 | "While you were away" + Der Schatten opt-in. |
| `tokens.ts` | §13.3d | Model-cost accounting. |
| `vault.ts` / `backup.ts` | §6.4/§8.2 | Offline document locker + full-state export/import. |
| `seed.ts` | — | Run-once seed of Ali's real July truth into the Spine. |

---

# PART IX — COMPLETE FEATURE ENCYCLOPEDIA

*(purpose · workflow · dependencies · strengths · weaknesses · roadmap — condensed per feature)*

1. **Command Bar (⌘K)** — instant built-ins → streaming Claude w/ tools. Dep: `commands.ts`, `claude.ts`, `tools.ts`. + Fast, deterministic, tool-transparent. − Async intents hand-wired; no intent classifier. → intent model, per-view palettes.
2. **Voice I/O** — wake-word STT → same pipeline → sentence-wise TTS. Dep: `speech.ts`, `tts.ts`. + Hands-free, presence. − Browser STT variance; no barge-in. → offline STT, iOS Shortcut.
3. **KAI Core / HUD** — living-body render + organ signals. Dep: `commandCoreV6`, `commandSignals`. + Distinctive presence. − Dead V4 twin; 3D cost on mobile. → consolidate render paths.
4. **The Spine + Sync** — event truth, cross-device union. + Conflict-free CRDT. − 2000 cap silent loss; no schema version. → compaction, typed meta.
5. **The Mirror** — commitments resolve against events. + Real accountability. − metric vocab must stay aligned with emitters. → trend grading.
6. **The Gate + Delegate** — human-tap firewall + narrow auto-lanes. + Prompt-injection-safe (client). − client-only; delegate bypass. → server-verified intents.
7. **Missions** — client-held, server-ticked tool-use. + Bounded, killable. − serial ticks. → templated missions.
8. **Der Schatten / Pulse + Voice** — nightly cron + Web Push. + Works while away; Edge-native push. − no observability; 3/day cap. → midday sweep, actions on notifications.
9. **Das Radar + Watchers** — configurable read-only eyes; Gmail lead-watch. + one-search-cap discipline; cited findings. − foreground-driven; recs advisory only. → server sweep, recs→Gate.
10. **The Counsel** — one ruling over the whole Spine. + Decisive, cited. − once/day; read-only. → continuous, delegated.
11. **Der Feldzug** — multilingual outreach → Gate, pipeline. + Language-correct, gated, RFC-2047 subjects. − seeds lack emails; no reply loop. → follow-up cadence.
12. **Money Engine** (Runway, Escape, Integrity, War Chest, Ledger, Debt, Income, Expenses) — honest, currency-explicit finance. + Self-reconciling; days-of-freedom framing. − no live FX/USD. → forecasts, deploy proposals.
13. **Der Gärtner** (Codex, Eye, Photos) — per-plant registry + AI vision + on-device images. + Heritage-aware; offline photos. − manual capture. → watering via pulse, disease trends.
14. **Growth** (Content, Instagram, Crown, Scribe) — plan/measure/publish the brand. + Gated publish; analytics. − manual scheduling. → content from Radar trends.
15. **Protocol / Academy** (ONE THING, Drill, Debrief, Lektion) — ADHD OS + weekly learning loop. + Behaviour-shaping. − niche surfaces. → adaptive coaching.
16. **Intel Strip** — ambient weather/crypto/prayer/news/insights/map/agenda. + Keyless, cached. − fixed feeds. → configurable, operator-relevant.
17. **Lock / Vault / Backup** — on-device auth, document locker, full export. + Offline-first, WebAuthn. − vault unencrypted. → encrypted, selective restore.
18. **Onboarding / Tour / Spotlight / Journal / Focus / Habits / Goals / Priorities** — the personal-productivity substrate. + Cohesive, persisted, boot-safe. − scattered state. → unified store.

---

# PART X — HIDDEN IDEAS (unfinished / forward-looking)

The codebase contains **no `TODO`/`FIXME`/`HACK` markers** — it expresses intent in prose ("forward-compatible", "not yet", "the seed of…", "later reason over"). The real unfinished threads:

1. **The Twin** — named only as an aspiration in `counsel.ts` ("the seed of the Twin"). The whole autonomy stack (Counsel + Delegate + Radar + Gate) is scaffolding toward an autonomous second self. *Largest unbuilt idea.*
2. **Server-side Gate** — `pending.ts`/`_send.ts` comments admit "the Face ID / PIN gate is the current perimeter" and anticipate a shared-secret server check. Not built.
3. **Phantom `/api/phone/*`** — `sms_send` PendingKind + `read_sms`/`read_phone_contacts`/`propose_sms` tools + `/api/phone/send|list|contacts` fetches exist, but the endpoints don't. Either the SMS/phone-bridge is coming (`docs/phone-bridge.md` describes an iOS Shortcut route) or it should be removed.
4. **Reply-tracking loop** — `markInquiryReplied` + `booking_replied` exist as forward hooks; nothing yet auto-closes a booking alarm when Ali replies. `_pulse-core.ts` calls it "forward-compatible: silent until the watcher feeds it."
5. **Future analytics brains** — headers reference **"Oracle", "Web", "One", "Spar"** as future consumers that will "reason over the Mirror/Spine" — an envisioned analytics/coaching layer beyond today's Scribe/Analyst.
6. **Radar server sweep** — today foreground-driven; the design anticipates the pulse driving it nightly/midday.
7. **Delegate widening** — the narrow safe-lane model is explicitly a *starting* trust boundary meant to widen as confidence grows.
8. **Recommender → Gate** — Radar recs are deliberately advisory-only for now; the arrow to gate-proposed actions is drawn but not wired to auto-propose.
9. **Live FX/USD** — `kaiConfig` notes a live USD rate "can join the store later like egpPerEur."
10. **Sparkline/“building history” placeholders** — several tiles show honest "not yet" states awaiting data accrual.

---

# PART XI — ARCHITECTURE VISION (5–10 years)

If I were the original creator, here is what KAI is trying to become:

**A trustworthy autonomous second self — the Twin — that runs the operator's life and ventures within delegated bounds, and answers to him alone.**

The trajectory is legible in the code's own layering:

1. **Instrument → Advisor → Twin.** KAI began as a HUD (read your world), grew an advisor (the Counsel: judge your world), and is reaching toward a Twin (act in your world). Each new epic (§14 pulse, §15 counsel, §18 feldzug, §19 radar) adds either a *sense* (Radar/Watchers), a *judgment* (Counsel), or a *hand* (Feldzug/missions) — the anatomy of an autonomous agent, assembled deliberately.
2. **The Spine is the memory that makes autonomy safe.** Because everything is an auditable event, the Twin can be trusted incrementally: the Delegate widens lanes only as the Spine proves KAI's proposals were right. Trust is *earned in the log*.
3. **The Gate is the constitution.** Autonomy never means uncontrolled. Even at full Twin maturity, irreversible action passes a verifiable gate — moving server-side so trust no longer rests on URL secrecy. "Propose, Kaiser disposes" survives even when KAI does 95% of the disposing.
4. **From one operator to a household, then a template.** The sync namespace is a latent account; the config/system-prompt/seed pattern is a latent multi-tenant boundary. The 5–10 year path could open KAI to a small circle (family, then trusted others) — but only *after* the auth layer and test suite the audit calls for.
5. **The businesses become semi-autonomous.** Makadi prices itself, the garden schedules its own care and disease-watch, the Feldzug runs outreach cadences, the Radar turns findings into gated proposals, and the War Chest deploys freed cash — each an organ that increasingly runs itself and reports up.
6. **The operator's role inverts.** Today Ali drives KAI. The vision is that KAI drives the day and Ali *approves, overrides, and sets direction* — a cockpit that flies itself under supervision, freeing the highest-agency human attention for the few decisions only he can make.

The through-line, stated plainly: **KAI is an attempt to give one ambitious, over-extended, ADHD-shaped human a faithful digital self — one that never forgets, never lies about a number, watches while he sleeps, drafts in four languages, rules with one clear verdict, and never once acts behind his back.** Everything in the repository is a step toward that.

---
*End of Knowledge Base. No source was modified. This document is the intended replacement for reading the code — for a new CTO or a new AI inheriting KAI.*
