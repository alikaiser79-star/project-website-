# Von Kaiser Farms — Design System

> Premium Egyptian organic farming with European roots. Chemical-free vegetables grown in hydroponic tower systems, documenting the full journey from setup to harvest.

---

## Brand Overview

**Von Kaiser Farms** is a premium organic food brand operating in Egypt with deep European (primarily German) cultural roots. The name "Von Kaiser" evokes European aristocratic heritage and precision, while "Farms" grounds it in the earth. The brand grows fresh, chemical-free vegetables using hydroponic tower systems and is deeply content-driven — documenting every stage of the farming journey authentically for its audience.

**Brand Pillars:**
- **Precision** — German engineering applied to farming; every process documented and intentional
- **Purity** — Chemical-free, hydroponic, traceable from seed to table
- **Authenticity** — Real journey documented, personal voice, never corporate
- **Premium** — Fine-food sensibility; produce worthy of the finest tables

**Sources Provided:**
- Brand description provided by the client (text only; no Figma file, no codebase, no logo file)
- All visual identity has been derived from the brand description and created fresh

---

## CONTENT FUNDAMENTALS

### Voice & Tone
- **Premium but personal** — writes like a passionate founder, not a corporation
- **Authentic storytelling** — "we" voice, first-person, inviting the reader into the journey
- **German precision meets Egyptian warmth** — structured and clear, yet warm and human
- **Never boastful** — lets the produce and process speak for themselves

### Casing
- Headlines: Title Case for major headlines; sentence case for subheadings and body
- CTAs: Title Case ("Visit The Farm", "From Our Garden")
- Never ALL CAPS except for tight labels/tags

### Copy Style
- Short, confident sentences. No filler.
- Specific over generic: "28-day tower cycle" not "fast-growing"
- Use of "our", "we", "you" — direct relationship between farm and customer
- Evokes sensory experience: texture, taste, smell, light
- Dates and process details add credibility ("harvested this morning", "Day 14 of the tower cycle")

### Examples
> "From our towers to your table — no chemicals, no shortcuts, no compromise."
> "Every head of lettuce has a story. We document all of it."
> "Grown with German precision. Nourished by Egyptian sun."
> "This week's harvest: crisp romaine, baby arugula, and the first cherry tomatoes of the season."

### Emoji Usage
**Never used.** The brand is too refined for emoji. Use typographic accents (em dash, ellipsis) for rhythm instead.

---

## VISUAL FOUNDATIONS

### Color System
See `colors_and_type.css` for full token definitions.

**Palette:**
- **Forest Green** (`#1C3829`) — primary brand color; earthy, deep, premium
- **Moss Green** (`#2E5339`) — secondary green; slightly brighter, used for hover states and accents
- **Sage** (`#7A9E87`) — mid-tone green; used for supporting UI elements
- **Cream** (`#F5F0E8`) — primary background; warm white, not sterile
- **Parchment** (`#EDE6D6`) — secondary background; slightly darker cream for cards/sections
- **Soil Brown** (`#6B4E35`) — warm earth tone; used for warmth accents
- **Terracotta** (`#C4714A`) — accent; warm, harvest-inspired
- **Charcoal** (`#1A1A18`) — primary text; near-black with a warm undertone
- **Stone** (`#7A7870`) — secondary text / muted

### Typography
See `colors_and_type.css` for full token definitions.

**Display:** Cormorant Garamond (Google Fonts) — elegant European serif, long history, editorial quality. *Substitution: requested proprietary European serif; Cormorant is the closest freely available match.*
**Body:** DM Sans — clean, modern humanist sans-serif. Legible, neutral, contemporary.
**Mono:** DM Mono — used for data labels, timestamps, process metrics.

### Backgrounds
- Default: cream (`#F5F0E8`) — never pure white
- Sections alternate between cream and parchment
- Dark sections use Forest Green (`#1C3829`) with cream text — dramatic, premium feel
- No gradient backgrounds
- Subtle paper/grain texture overlay (5–8% opacity) on key hero sections
- Full-bleed photography encouraged — warm, natural light; slightly desaturated; "golden hour on the farm" color grade

### Imagery
- **Color grade:** Warm-toned, slightly desaturated, high contrast — think documentary film stills
- **Subject matter:** Plants in towers, soil, hands working, harvest close-ups, kitchen prep
- **No stock photography feel** — everything authentic and in-situ
- Images used full-bleed or in clean rectangular crops (no circles, no rounded-corner crops)

### Cards & Surfaces
- Background: Parchment (`#EDE6D6`) or White
- Border: 1px `#D8D0C0` (subtle warm gray)
- Border radius: **4px** — barely rounded; almost brutally square. European precision.
- Shadow: `0 2px 12px rgba(26,26,24,0.07)` — very subtle lift

### Spacing & Layout
- Base unit: **8px**
- Column grid: 12-column, max-width 1320px, 24px gutters
- Section padding: 96px vertical (desktop), 64px (mobile)
- Dense content areas: 48px padding
- Generous whitespace is part of the premium feel

### Corner Radii
- **4px** — default (cards, inputs, tags)
- **2px** — tight (table rows, inline chips)
- **50%** — only for avatar thumbnails
- Never large radii (no pill buttons unless specifically brand-approved)

### Borders
- `1px solid #D8D0C0` — default surface border (warm gray)
- `1px solid #2E5339` — active/focus state
- No colored left-border accent pattern

### Shadows
- **Lift (card):** `0 2px 12px rgba(26,26,24,0.07)`
- **Elevated (modal/dropdown):** `0 8px 32px rgba(26,26,24,0.14)`
- **Inset (inputs):** `inset 0 1px 3px rgba(26,26,24,0.08)`

### Animation & Motion
- **Easing:** `cubic-bezier(0.25, 0.46, 0.45, 0.94)` — smooth, natural deceleration
- **Duration:** 200ms for micro-interactions; 400ms for page transitions; 600ms for reveals
- **Fade + slight upward drift** for content reveals (translateY 12px → 0)
- No bounces, no spring, no elastic — too playful for this brand
- Hover states: subtle opacity shift (1.0 → 0.8) or color deepening

### Hover & Press States
- **Buttons:** Background darkens by one step; no scale transform
- **Links:** Color shifts from Forest Green to Moss; underline appears
- **Cards:** Shadow deepens slightly; very subtle lift (`translateY -2px`)
- **Press:** Slight opacity reduction (0.85)

### Iconography
See ICONOGRAPHY section below.

---

## ICONOGRAPHY

No proprietary icon set was provided. The brand uses **Lucide Icons** (CDN: `https://unpkg.com/lucide@latest`) — a clean, stroke-based icon set that matches the brand's precision aesthetic.

**Usage rules:**
- Stroke weight: **1.5px** — refined, not heavy
- Size: 16px inline, 20px for navigation/UI, 24px for feature icons
- Color: Always matches surrounding text or brand green — never decorative color
- No filled icons; stroke-only
- No emoji substitutes for icons

**Key icons in use:**
- Leaf / Plant — produce category
- Droplets — hydroponics / water systems
- Sun — growing conditions
- Package — harvest / delivery
- Camera / Video — content/documentation
- ChevronRight — navigation
- Check — quality indicators

Assets stored in `assets/icons/` (Lucide CDN referenced; no local copies needed).

---

## ASSET INDEX

| Path | Description |
|------|-------------|
| `README.md` | This file — brand overview and foundations |
| `colors_and_type.css` | CSS custom properties for all tokens |
| `assets/logo.svg` | Primary wordmark (SVG) |
| `assets/logo-light.svg` | Reversed wordmark for dark backgrounds |
| `assets/logo-mark.svg` | Icon-only mark |
| `preview/` | Design System card HTML files |
| `ui_kits/website/` | Marketing website UI kit |
| `SKILL.md` | Agent skill definition |

### UI Kits
- **`ui_kits/website/`** — Von Kaiser Farms marketing website. Core screens: Homepage hero, Product listing, Product detail, About/Story page, Video journal.

---

*Design System created April 2026. No Figma file or codebase was provided; all visual identity derived from brand description.*
