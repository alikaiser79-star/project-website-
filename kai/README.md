# KAI — Personal Command Core

A dark, cinematic, voice-enabled personal command center. Ali's life and
business in one HUD: the **KAI Core** orb sits at the center as the AI's
presence; six glass panels report finance, debt, Hidden Garden, Makadi
Airbnb, Instagram and live priorities. A ⌘K command bar talks to KAI in
text (with optional Anthropic API hookup) and the Web Speech API gives
voice in / voice out.

Built with **React + Vite + TypeScript**, **Tailwind**,
`@react-three/fiber` + `drei` + `postprocessing` for the orb,
**Framer Motion** for UI motion, **GSAP** for the boot sequence and
counters, **Recharts** for the Instagram growth chart, **Howler.js**
for sound, and **lucide-react** for icons.

## Quick start

```bash
cd kai
npm install
npm run dev
```

Open <http://localhost:5173>. The boot sequence will play; click to skip.

## Editing your data

Everything lives in **`src/kaiConfig.ts`** — income streams, debt
balance, garden plant count, Makadi rate, Instagram followers, default
priorities, EGP/EUR rate, default voice, system prompt. Edit one file,
the whole HUD updates.

State that changes at runtime (priorities, debt paydown, settings,
chat history) is persisted to **`localStorage`** under
`kai.state.v1`. To wipe and start over, clear that key in DevTools
or run `localStorage.removeItem('kai.state.v1')`.

## Plug in Claude

The command bar tries built-in commands first (`status`, `debt`,
`income`, `tasks`, `garden`, `makadi`, `instagram`, etc). For anything
else it falls through to the Anthropic API if a key is set.

Two options for the key:

1. **`.env.local`** (recommended)

   ```bash
   cp .env.example .env.local
   # edit and add your sk-ant-… key
   npm run dev
   ```

2. **`src/kaiConfig.ts`** — set `claudeConfig.apiKey` directly.

The default model is `claude-sonnet-4-6` (Sonnet 4.6). Edit
`claudeConfig.model` or `claudeConfig.systemPrompt` to taste.

> ⚠ The API key ships to the browser. Fine for personal/local use; for
> anything you deploy publicly, proxy via your own backend so the key
> never reaches the client.

## Keyboard

| Key             | Action                              |
| --------------- | ----------------------------------- |
| `⌘K` / `Ctrl-K` | Open command bar                    |
| `⌘/` / `Ctrl-/` | Spotlight search (everything)       |
| `⌘J` / `Ctrl-J` | Journal · quick capture             |
| `S`             | Open settings drawer                |
| `V`             | Toggle voice                        |
| `M`             | Mute / unmute sound                 |
| `?`             | Keyboard cheatsheet                 |
| `Esc`           | Close any overlay                   |
| `Enter`         | Send command                        |

## Settings & live intel

Press `S` (or tap the gear in the top bar) to open the settings drawer.
From there: rename the operator, switch the KAI Core accent
(amber / cyan / emerald), pick a voice and tune rate/pitch (with a
"test voice" button), toggle sound + recognition, or reset all local
state.

The HUD pulls **live Cairo weather** from Open-Meteo and **live crypto
prices** from CoinGecko — both keyless, both refresh on a timer. They
render in the "intel strip" beneath the main grid, along with a session
uptime tile.

## Chat memory

The command bar remembers the last 30 turns and feeds the last 6 back
to Claude on each call, so KAI can carry context between questions. The
trash icon clears the history. All chat is persisted to
`localStorage` under `kai.state.v1`.

## Proactive notifications

KAI fires toast alerts on boot — welcome, count of open priorities,
the Makadi fix-lock reminder (driven by `kaiConfig.makadi.fixLock`),
voice acknowledgements when it hears a command. Toasts slide in
top-right and dismiss on click or after their TTL.

## Daily briefing

Once per calendar day, KAI generates a narrative briefing covering
projected monthly income, debt paydown %, open priorities, today's
garden tasks, the Makadi fix-lock state, and a countdown to the next
event. It surfaces as a toast and, if voice is on, is spoken aloud.
Trigger it any time by typing or saying **"briefing"** in the command
bar / voice channel.

## Focus / Pomodoro

A focus tile lives in the intel strip. Buttons start a 25-min focus
block, 5-min break, or 50-min deep-work block; running blocks survive
a page refresh. On completion KAI confirms with a toast and (if voice
is on) speaks. From the command bar / voice, say **"focus 45"**,
**"start a pomodoro"**, **"break"**, **"stop timer"**.

## Audio visualization

The KAI Core has a halo of vertical bars that respond to:

- **Listening** — real microphone spectrum via Web Audio `AnalyserNode`
  (requires mic permission, granted alongside speech recognition)
- **Speaking** — a synthesised waveform timed to speech
- **Idle** — a slow ambient ripple

## News ticker

A marquee below the intel strip streams the Hacker News top stories
(keyless API). Hover pauses the scroll.

## Priorities — drag to reorder

The Priorities panel uses Framer Motion's `Reorder` — drag the grip
handle to reorder. Order persists to localStorage.

## Voice intents

Beyond the command-bar built-ins, the following phrasings work over
voice:

- `"status" / "vitals" / "summary"` — system status
- `"briefing" / "morning" / "daily"` — daily briefing
- `"focus 25" / "start a pomodoro" / "deep work 50"` — start a focus block
- `"break" / "take a break"` — start a 5-min break
- `"stop timer" / "cancel focus"` — stop running focus block
- `"convert 1000 eur" / "in euros"` — currency conversion
- `"note that …" / "remember …" / "log …" / "journal …"` — save to journal
- `"debt", "income", "tasks", "garden", "makadi", "instagram", "time"`

## Journal · quick capture

Press `⌘J` (or `J`, or say "Kai, note that…") to open the journal
drawer. Type a thought, `⌘↵` to save. Entries are persisted to
`localStorage`, listed newest-first, deletable on hover. The drawer
shows total entry count and timestamps each.

## Spotlight search

`⌘/` (or `Ctrl-/`) opens a unified search across priorities, journal
entries, habits, chat history, pending reminders, and built-in
commands. Arrow keys navigate, `↵` opens (commands run immediately
through the built-in resolver and KAI replies as a toast / voice).

## Reminders

Type or say **"remind me in 30 minutes to call Mira"** —
KAI schedules a future toast + voice ping. Reminders persist to
`localStorage` and are re-armed on the next boot, so closing the tab
won't lose them. Pending reminders surface in the Agenda tile in the
intel strip.

## Backup

`Settings → Backup` exports the entire KAI state as a JSON file
(`kai-state-YYYY-MM-DD.json`). Import the same shape back to restore.
A "danger zone" reset wipes everything.

## Insights, Habits, Map, Agenda

The intel strip below the main grid includes:

- **Insights** — KAI rotates through data-driven observations
  computed locally from your state.
- **Habits** — four daily habits, tap to check, streak counter on each.
- **Holdings map** — a hand-traced SVG of Egypt with animated pulsing
  pins on Cairo (Hidden Garden) and Makadi (Airbnb).
- **Agenda** — next few items (garden event, Makadi check-in, pending
  reminders), with relative day tags.

## Voice

Tap the mic chip in the top bar (or press `V`) to enable continuous
speech recognition. Say "status", "debt", "income", "tasks", "garden",
"makadi" — KAI runs the matching built-in and speaks the reply via
`speechSynthesis`. You can prefix with "Kai" or "Hey Kai" — it's
stripped automatically.

The voice picks a deep, calm English voice if one is available
(`Daniel`, `Google UK English Male`, `Microsoft Ryan`, otherwise the
first English voice).

## File layout

```
src/
  kaiConfig.ts         ← edit your numbers here
  App.tsx
  index.css
  main.tsx
  components/
    Background.tsx       grid + scanlines + cursor
    Boot.tsx             terminal boot sequence
    TopBar.tsx           clock, greeting, voice/sound/cmd controls
    KaiCore.tsx          R3F orb, bloom, particles, rings
    CommandBar.tsx       ⌘K overlay, typed output, Claude wiring
    Panel.tsx            shared glass panel shell
    panels/
      IncomePanel.tsx
      DebtPanel.tsx
      GardenPanel.tsx
      MakadiPanel.tsx
      InstagramPanel.tsx
      PrioritiesPanel.tsx
  lib/
    store.ts             localStorage persistence
    sound.ts             Howler tones (synthesised, no assets)
    speech.ts            Web Speech API wrapper
    commands.ts          built-in command logic
    claude.ts            Anthropic API caller (optional)
  hooks/
    useLocalStorage.ts
    useKaiPulse.ts       event bus for KAI's pulse / speak / listen
    useCounter.ts        GSAP-driven animated counters
```

## Notes

- The HUD is responsive. Below `lg`, the three columns stack.
- Sound is generated at runtime — no audio files needed.
- The KAI Core uses `MeshDistortMaterial` from `@react-three/drei`
  and `Bloom` from `@react-three/postprocessing`. Both are pure GPU.
- Boot is skippable — click anywhere.
