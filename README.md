# 🌍 CarbonMirror
### India's Carbon Footprint Awareness Platform

> *"Make the invisible viscerally real, emotionally urgent, and behaviorally actionable."*

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![No Backend](https://img.shields.io/badge/Backend-None-brightgreen)](.)
[![Privacy First](https://img.shields.io/badge/Privacy-100%25%20Local-blue)](.)
[![WCAG 2.1 AA](https://img.shields.io/badge/A11y-WCAG%202.1%20AA-purple)](.)

---

## 🚀 Quick Start

```bash
# No installation, no build step required.
# Just open the file in a modern browser:
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

Or serve locally (recommended for ES module support):
```bash
npx serve .            # Uses npx serve
# OR
python -m http.server  # Python 3
```

Then visit `http://localhost:3000` (or whichever port).

---

## ✨ Features

### 1. 🧮 Carbon Calculator
5-category onboarding wizard covering:
- **Transport** — Private vehicle, public transit, flights
- **Food** — Diet type, meat consumption, dairy, food delivery
- **Home Energy** — Electricity (grid), LPG/PNG cooking, AC usage, solar
- **Shopping** — Fast fashion, electronics, online orders
- **Digital** — Streaming, social media, cloud storage, video calls

Outputs personalized annual CO₂ in kg with tier classification and category breakdown.

### 2. 🌍 Dynamic Planet Visualization
- **Three.js 3D Earth** that visually degrades (smog, brown patches) as footprint increases
- Smooth transitions between tiers (Green → Yellow → Orange → Red)
- Interactive mouse/touch drag to rotate the planet
- Canvas 2D fallback for no-WebGL environments
- Real-time analogies: Delhi→Mumbai drives, trees needed, electricity months, flights

### 3. 🔍 AI Decision Scanner (Nudge Engine)
- Paste or type any impending action ("order mutton biryani on Swiggy", "book Delhi-Mumbai flight")
- **Gemini API mode**: AI-powered with emotional Indian analogies
- **Rule-based fallback**: 20+ keyword rules covering food, transport, shopping, energy, digital
- Returns: CO₂ estimate, 2 greener alternatives with savings %, visceral analogy

### 4. 🏆 Gamification System
- 6 eco challenges (7-day and 30-day formats)
- Daily check-in streak tracking with 🔥 🌿 🏆 indicators
- 8 earnable badges (Carbon Rookie → Climate Warrior)
- Community leaderboard with 8 seeded Indian city personas

### 5. 🗺️ Roadmap & Social Share
- 5-step personalized carbon reduction plan with CO₂ and ₹ savings
- Canvas-rendered share cards for LinkedIn (1200×628) and WhatsApp (1080×1080)
- Web Share API on mobile, download fallback on desktop

---

## 📁 File Structure

```
/
├── index.html              ← Single-page app entry point
├── style.css               ← Global design system (CSS custom properties)
├── app.js                  ← Core orchestration, navigation, all UI events
├── calculator.js           ← Pure emission calculation functions
├── visualization.js        ← Three.js planet + Canvas 2D fallback
├── nudge-engine.js         ← Gemini API + rule-based fallback
├── gamification.js         ← Challenges, badges, streaks, leaderboard
├── share.js                ← Canvas 2D card generation + Web Share API
├── data/
│   └── emission-factors.json  ← Indian CO₂ factors with sources
├── .env.example            ← API key documentation (runtime: sessionStorage only)
└── README.md
```

---

## 🔑 Gemini API Setup

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a free API key (60 req/min free tier)
3. In the app, paste the key in the **Home screen** input field
4. Click **Save Key**

> The key is stored **only in `sessionStorage`** — cleared when you close the tab. It is never sent anywhere except `generativelanguage.googleapis.com`.

The app works **fully without an API key** using the built-in rule-based engine.

---

## 📊 Indian Emission Factors

All factors are sourced from authoritative references:

| Category | Source |
|---|---|
| Grid electricity (0.708 kg CO₂/kWh) | IEA India Energy Outlook 2023 |
| Transport factors | Ministry of Petroleum & Natural Gas India |
| Metro/rail factors | DMRC GHG Report 2022, Indian Railways GHG Inventory |
| Food lifecycle | IPCC AR6 Working Group III (2022) |
| Domestic flight (0.255 kg/km) | ICAO Calculator / DGCA India |
| LPG (42.36 kg CO₂/cylinder) | IPCC default factors |
| Digital/cloud | IEA / Carbon Trust / Uptime Institute 2022-23 |
| Fashion lifecycle | Textile Exchange Fiber & Materials Benchmark 2022 |

---

## ♿ Accessibility

- WCAG 2.1 AA compliant
- All interactive elements have `aria-label` / `aria-describedby`
- Dynamic content uses `aria-live="polite"` regions
- Skip navigation link
- Full keyboard navigation support (`tabindex`, focus management)
- `prefers-reduced-motion` fully respected — all animations disabled
- `lang="en"` set on `<html>`
- Color contrast ratios ≥ 4.5:1 on all text

---

## 🎨 Design System

| Token | Value | Usage |
|---|---|---|
| `--color-forest` | `#1B4332` | Primary brand color |
| `--color-sand` | `#F4ECD8` | Background |
| `--color-red-tier` | `#C0392B` | High footprint |
| `--color-sky` | `#2980B9` | Improving state |
| `--color-green-tier` | `#27AE60` | Green tier |
| `--color-amber` | `#E67E22` | Orange tier |
| `--color-gold` | `#F39C12` | Yellow tier |

Fonts: **Outfit** (headings, 300–900) + **Inter** (body, 300–600) from Google Fonts.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     index.html (SPA)                    │
│  6 sections: Home, Calculator, Dashboard, Nudge,        │
│              Challenges, Roadmap                        │
└──────────────────────────┬──────────────────────────────┘
                           │ ES Modules
           ┌───────────────▼────────────────┐
           │           app.js               │
           │  AppState singleton            │
           │  Section routing (hash)        │
           │  Event orchestration           │
           └──┬──────┬──────┬──────┬────────┘
              │      │      │      │
    ┌─────────▼─┐ ┌──▼───┐ ┌▼────┐ ┌▼──────────┐ ┌▼──────┐
    │calculator │ │viz.js│ │nudge│ │gamific.js │ │share  │
    │.js        │ │Three │ │.js  │ │challenges │ │.js    │
    │Pure funcs │ │JS +  │ │Gem  │ │badges     │ │Canvas │
    │No DOM     │ │2D    │ │API  │ │leaderboard│ │2D     │
    └───────────┘ └──────┘ └─────┘ └───────────┘ └───────┘
                                        │
                              ┌─────────▼────────┐
                              │  localStorage    │
                              │  sessionStorage  │
                              │  (API key only)  │
                              └──────────────────┘
```

---

## 🔒 Privacy & Security

- **Zero server-side data collection.** The app is 100% static HTML/JS.
- **API key security:** Stored in `sessionStorage` only (not `localStorage`, not cookies). Cleared on tab close.
- **Input sanitization:** All user inputs are sanitized against XSS before display and before API calls.
- **No analytics, no trackers, no cookies.**
- All gamification data (challenges, badges, points) stored in `localStorage` on your device only.

---

## 🌐 Browser Support

| Browser | Support |
|---|---|
| Chrome / Edge 88+ | ✅ Full (Three.js WebGL) |
| Firefox 85+ | ✅ Full |
| Safari 15+ | ✅ Full (Web Share API for file-sharing requires iOS 15+) |
| Older browsers | ⚠️ Canvas 2D fallback (no Three.js) |

Requires ES2020+ for dynamic `import()`. No IE support.

---

## 🧪 Testing the Calculator

Open browser DevTools console and run:

```js
// Import and test (after page loads)
const { calculateTransport, getAnalogies, getTier } = await import('./calculator.js');

// Test transport calculation
calculateTransport({ vehicle: 'petrol_car', kmPerWeek: 80, flights: 4, flightKm: 800 });
// Expected: { kg: ~2500, breakdown: { vehicle: ~800, flights: ~816, ... } }

// Test tier detection
getTier(1200);  // 'green'
getTier(2500);  // 'yellow'
getTier(4000);  // 'orange'
getTier(8000);  // 'red'

// Test analogies
getAnalogies(2000);
// Expected: { delhiMumbaiDrives: ~5.4, treesNeeded: ~96, electricityMonths: ~29.4 }
```

---

## 📣 PromptWars Walkthrough

**Platform:** CarbonMirror — Carbon Footprint Awareness for Urban India  
**Stack:** Vanilla HTML/CSS/JS (ES Modules), Three.js (CDN), Gemini API  
**Built by:** Antigravity AI agent (Google DeepMind)

### What makes this production-grade:
1. **Real Indian emission factors** from IEA, IPCC AR6, Indian Railways, MoPNG
2. **Three.js planet** with 4-tier visual degradation + Canvas 2D fallback
3. **Gemini AI + 20+ rule fallback** with full error handling and graceful degradation
4. **WCAG 2.1 AA** throughout — `aria-live`, skip nav, full keyboard navigation
5. **`prefers-reduced-motion`** fully implemented
6. **XSS sanitization** on all user inputs
7. **sessionStorage** for API key (never localStorage, never cookies)
8. **CSS custom properties design system** with 50+ tokens, 6 CSS layers
9. **Responsive** down to 320px width
10. **Canvas 2D share cards** in both LinkedIn and WhatsApp formats

---

*Made with 💚 for India's climate generation.*
