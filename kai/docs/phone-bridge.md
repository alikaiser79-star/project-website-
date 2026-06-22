# KAI · Phone Bridge

Not control — **reach**. How to throw things into KAI from your phone.

There are two routes:

| Route | What it does | Latency |
|---|---|---|
| **OS Share Sheet** | Share text, a URL, or a photo into KAI from any other app | A few taps |
| **iOS Shortcut "Hey KAI"** | Dictate a thought, KAI sorts it and speaks the reply | One tap / "Hey Siri, Hey KAI" |

---

## 1. Install KAI as a PWA (one-time)

iOS Safari (16.4+) and Android Chrome:

1. Open your KAI URL in the browser.
2. **iOS:** Share icon → *Add to Home Screen*. Tap *Add*.
3. **Android:** Three-dot menu → *Install app* / *Add to Home Screen*.

KAI now lives as an installed app — same icon as the SVG in the manifest.
The PWA's service worker also registers KAI as a share target.

---

## 2. OS Share Sheet → Brain Dump / Receipts

Once KAI is installed, every Share menu shows **KAI** as a destination.

### Text / URL share

- In Notes / Safari / X / any app → Share → **KAI**
- KAI opens, the text (and URL if shared) lands prefilled in **Brain Dump**, ready to **Sort it**.
- Spine logs `system.phone_share { kind: 'text' }`.

### Receipt photo share

- In Photos / Camera roll → Share → **KAI**
- KAI's `/api/ingest` reads the image, runs Anthropic vision, and pre-fills the **ReceiptConfirm** modal with merchant / total / currency / date / category.
- Fix anything wrong → **Save**. Expense lands. Spine logs `expense.expense_logged` + `system.phone_share { kind: 'receipt' }`.

**What it looks like server-side:**

```
[your phone Photos] → Share → KAI
   ↓
POST /api/ingest (multipart/form-data)
   ↓
/api/ingest reads the image → Anthropic vision → JSON draft
   ↓
HTML response: sessionStorage.setItem('kai.pendingShare', draft); location='/'
   ↓
KAI's App.tsx reads sessionStorage → emits 'open-receipt' action
   ↓
ExpensesPanel listens → opens ReceiptConfirm prefilled
```

---

## 3. iOS Shortcut "Hey KAI"

The dictate-and-speak loop. One tap from the lock screen, or *"Hey Siri, Hey KAI."*

### Build it

Open the **Shortcuts** app on iPhone → tap **+** to create a new shortcut.

Actions in order:

1. **Dictate Text**
   - Stop Listening: *On Tap*
   - Language: English (or pick yours)

2. **Get Contents of URL**
   - URL: `https://YOUR-KAI-URL/api/claude`
   - Method: **POST**
   - Request Body: **JSON**
   - Form fields:
     ```
     model:        claude-sonnet-4-6
     max_tokens:   400
     messages:     [{"role":"user","content":"<Dictated Text>"}]
     ```
     For the `messages` value, use a **Dictionary** field with one item whose value is the **Dictated Text** variable from step 1.

3. **Get Dictionary Value**
   - Get: **Value** for **content.0.text** in **Contents of URL**

4. **Speak Text**
   - Text: the dictionary value from step 3
   - Rate / pitch as you like

### Save it

- Name it **Hey KAI**
- Tap the share icon → **Add to Home Screen** (one-tap lock-screen access)
- Long-press the shortcut → **Add to Siri** → record *"Hey KAI"*

Now: *"Hey Siri, Hey KAI"* → speak a question → Siri speaks KAI's reply.

### Why this and not the share-sheet route?

The share sheet routes through `/api/ingest` for **capture** (sort it, file it, save it). The Shortcut routes through `/api/claude` for **conversation** (just answer). Different jobs.

---

## 4. Web Push notifications (optional, fiddly — do last)

iOS 16.4+ and modern Android support Web Push for installed PWAs. Hooks into The Watchtower (batch-2 brief).

Status: **not yet wired**. When you want it:

- Server: `web-push` library, generate VAPID keys (`VAPID_PUBLIC` / `VAPID_PRIVATE` env), `POST /api/push/subscribe` to register a device, `POST /api/push/send` (gated) to push.
- Client: ask permission, register the SW push handler, send the subscription to the server on first install.
- Watchtower triggers (from batch-2): booking inquiry > 2h unanswered, reel stalling, Honda rent overdue, Enpal escalation, broken-token Spine event.

Defer until at least one Watchtower trigger is live.

---

## 5. Hard rule (worth restating)

Everything in this doc is **capture only**. Nothing the share sheet, ingest endpoint, or Shortcut does sends, posts, or commits anything externally. External actions still go through ⌘K → propose_* → ConfirmationGate → your tap. The phone bridge gives KAI an inbox from your phone; the gate stays.
