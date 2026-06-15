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

| Key            | Action                |
| -------------- | --------------------- |
| `⌘K` / `Ctrl-K` | Open command bar     |
| `V`            | Toggle voice          |
| `M`            | Mute / unmute sound   |
| `Esc`          | Close command bar     |
| `Enter`        | Send command          |

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
