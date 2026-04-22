# Von Kaiser Farms Website UI Kit

A clickable prototype of the Von Kaiser Farms marketing website. Built with React + Babel, no build step required.

## Screens
- **Homepage** (`farm`) — Hero, stats, featured produce, journal CTA, newsletter
- **Produce Listing** (`produce`) — Filterable grid of all current harvest items
- **Product Detail** (`product`) — Single product with tower metadata, quantity selector, add to order
- **Journal** (`journal`) — Video episode listing with featured latest episode
- **Our Story** (`story`) — Long-form brand narrative

## Components
| File | Exports |
|------|---------|
| `Components.jsx` | `VKNav`, `VKTag`, `VKButton`, `VKFooter`, `VKProductCard` |
| `HomePage.jsx` | `HomePage` |
| `ProduceScreens.jsx` | `ProducePage`, `ProductDetailPage` |
| `JournalScreens.jsx` | `JournalPage`, `StoryPage` |

## Usage
Open `index.html` in a browser. Navigation state persists in `localStorage`.

## Design Notes
- Fonts: Cormorant Garamond (display) + DM Sans (body) + DM Mono (data)
- Primary background: `#F5F0E8` (cream)
- Primary brand: `#1C3829` (forest green)
- Accent: `#C4714A` (terracotta)
- All product image areas are placeholders — replace with real photography
- Icon stroke weight: 1.5px (Lucide style)
