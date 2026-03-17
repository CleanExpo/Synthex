# Synthex Full Site Redesign + Client Website Generator

**Design Spec — 2026-03-17**
**Approach:** A — "Craft & Code" (Notion/Framer meets local business warmth)

---

## Overview

Two interconnected sub-projects:

1. **Sub-project A:** Full redesign of the Synthex marketing site (landing + all sub-pages) using taste-skill principles, warm charcoal + amber design system, Satoshi typography, and an interactive live demo widget as the hero centrepiece.

2. **Sub-project B:** A new "Website Builder" product feature inside the Synthex dashboard — scrape a client URL, extract branding, generate a full taste-skill-quality website with Gemini images and optional Remotion video.

---

## Taste-Skill Configuration

```
DESIGN_VARIANCE:  8  (asymmetric layouts, overlapping elements, grid-breaking)
MOTION_INTENSITY: 6  (smooth CSS transitions, stagger reveals, Framer Motion spring physics)
VISUAL_DENSITY:   4  (generous whitespace — marketing page, not a dashboard)
```

---

## Design System

### Typography

| Role                | Font       | Tailwind                                                            |
| ------------------- | ---------- | ------------------------------------------------------------------- |
| Display / Headlines | Satoshi    | `font-display text-5xl–7xl tracking-tight leading-[1.02] font-bold` |
| Body                | Satoshi    | `text-base leading-relaxed text-stone-400 max-w-[65ch]`             |
| Monospace / Numbers | Geist Mono | `font-mono tabular-nums`                                            |

**Install:** `npm install @fontsource/satoshi` + register in `app/layout.tsx`. Geist Mono via `next/font/google`.

**Banned fonts:** Inter, Roboto, Arial, Open Sans.

### Colour Tokens

| Token            | Hex                      | Usage                                  |
| ---------------- | ------------------------ | -------------------------------------- |
| `bg-base`        | `#1a1612`                | Page background                        |
| `bg-surface`     | `#211e18`                | Cards, panels                          |
| `bg-raised`      | `#2a251e`                | Elevated / hover                       |
| `accent`         | `#f59e0b` (amber-500)    | Primary CTA, highlights, active states |
| `accent-warm`    | `#ea580c` (orange-600)   | Hover on CTAs                          |
| `text-primary`   | `#faf9f6`                | Headlines, nav                         |
| `text-secondary` | `#a8a29e` (stone-400)    | Body, subtext, nav links               |
| `border-subtle`  | `rgba(255,255,255,0.06)` | All dividers, card borders             |

**Single accent rule:** Amber (`#f59e0b`) is the ONLY accent. No cyan, no purple, no gradients across multiple hues.

### Surface Treatment

- **Grain texture:** Fixed `pointer-events-none` pseudo-element, `opacity-[0.03]`, `mix-blend-overlay` — breaks digital flatness
- **Tinted shadows:** `shadow-[0_20px_60px_-20px_rgba(245,158,11,0.12)]` on cards (amber-tinted, not black)
- **Inner borders on glass panels:** `border-white/[0.06]` + `shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]`
- **Ambient glow:** Single amber radial `bg-amber-500/[0.06] blur-[200px]` at hero — one per page, not repeated

### Spacing & Layout

- Container: `max-w-7xl mx-auto px-6`
- Section padding: `py-28` standard (VISUAL_DENSITY 4 = generous)
- Full-height sections: `min-h-[100dvh]` — never `h-screen`
- Radius: `rounded-2xl` containers · `rounded-xl` inner cards · `rounded-full` pills/buttons
- Grid over flex-math: CSS Grid throughout, no `calc()` percentages

### Motion Baseline (MOTION_INTENSITY 6)

- Transitions: `transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1)`
- Stagger: CSS `animation-delay: calc(var(--i, 0) * 80ms)` on list/grid items
- Spring physics: Framer Motion `{ type: "spring", stiffness: 120, damping: 20 }` on demo widget
- Only animate `transform` and `opacity` — never `top/left/width/height`
- New dependency: `npm install framer-motion`

### Icons

- Library: `@phosphor-icons/react`
- Weight: `"light"` for nav/body, `"regular"` for CTAs
- Standardised stroke: no mixing of icon libraries

---

## Sub-project A: Synthex Marketing Site Redesign

### Pages in Scope

| Page        | Status                   | Work                               |
| ----------- | ------------------------ | ---------------------------------- |
| `/`         | Exists — full redesign   | New hero, new sections, new layout |
| `/features` | Exists — incomplete      | New components wired               |
| `/pricing`  | Exists — old PricingGrid | Replace with new PricingSection    |
| `/about`    | Exists — inline only     | GlowCard components, animation     |
| `/demo`     | Stub                     | Full demo page                     |
| `/blog`     | Missing                  | Professional stub + email capture  |
| `/support`  | Missing                  | Warm stub + email capture          |
| `/careers`  | Missing                  | Warm stub, mailto CTA              |

### Navigation

**Component:** `components/landing/nav-bar.tsx` — full rewrite

**Design:** Floating pill, not edge-to-edge sticky. Centred, `max-w-3xl`, `40px` from top.

```
bg-[#211e18]/80 backdrop-blur-xl border border-white/[0.08] rounded-full px-6 py-3
```

- Logo: Synthex wordmark in `text-primary`, Satoshi semi-bold
- Links: `text-stone-400 hover:text-white` — Features · Pricing · Blog · Docs
- CTAs: "Sign In" ghost pill + "Get Started →" amber filled pill
- On scroll > 100px: `shadow-[0_8px_40px_-8px_rgba(245,158,11,0.15)]` amber glow underneath
- Mobile: collapses to `BottomMenu` fixed tab bar (existing component, reskin to amber)

### Hero Section

**Component:** `components/landing/hero-section.tsx` — full rewrite + new `LiveDemoWidget`

**Layout:** Asymmetric 55/45, left content / right interactive demo widget

**Left column (55%):**

- Eyebrow pill: `bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs tracking-widest uppercase rounded-full px-3 py-1` — "10,000+ local businesses"
- Headline: `text-6xl lg:text-7xl font-bold tracking-tight leading-[1.02] text-primary` in Satoshi. Final word renders in `text-amber-400`. Stagger word-by-word reveal on load.
- Subheadline: `text-xl text-stone-400 max-w-xl leading-relaxed`
- Copy: "Your posts, written while you're making coffee." / "Synthex writes and schedules your social media so you can focus on running your business. No experience needed."
- CTAs: "Start Free →" amber pill + "Watch Demo" ghost pill with Phosphor `Play` icon
- Trust strip: `border-t border-white/[0.05] pt-6` — `10,247 businesses` · `14-day free trial` · `$49/mo AUD` in `font-mono tabular-nums text-amber-400`

**Right column (45%) — LiveDemoWidget:**

```
components/landing/live-demo-widget.tsx ('use client')
```

- Input field: "Type your business name..." with amber blinking cursor
- On submit: skeleton shimmer 2–3s → Instagram card materialises with Framer Motion spring
- Instagram card chrome: profile avatar (amber initials), business name, verified dot, image, caption, like/comment counts (organic messy numbers: `847 likes`, `23 comments`)
- Image: Gemini 2.0 Flash generated, matching business type
- Caption: OpenRouter claude-haiku-4-5 generated, 2–3 sentences, platform-appropriate
- Card: `bg-[#211e18] border border-white/[0.06] rounded-2xl shadow-[0_20px_60px_-20px_rgba(245,158,11,0.12)]`
- Preset buttons below input: "☕ Café" · "🔧 Tradie" · "💇 Salon" · "💪 Gym" — one click populates and triggers

**API:** `POST /api/demo/generate`

```typescript
// Request
{ businessName: string, businessType: 'cafe' | 'tradie' | 'salon' | 'gym' | 'other' }

// Response (SSE stream)
{ caption: string, imageUrl: string, imagePrompt: string }
```

- Caption: OpenRouter → `claude-haiku-4-5-20251001`, ~300ms
- Image: Gemini 2.0 Flash `generateContent` with `responseModalities: ['IMAGE']`, ~2–3s
- Stream caption first, then image URL — user sees text while image loads
- Rate limit: 10 requests/hour per IP (no auth required for demo)
- No auth required — public endpoint, rate limited

**Background:**

- Warm charcoal `#1a1612` base
- Single amber radial glow `top-1/3 right-1/4 w-[600px] h-[600px] bg-amber-500/[0.06] blur-[200px]`
- Subtle warm grid `opacity-[0.02]` (amber-tinted, replacing current cyan)
- Grain texture overlay `opacity-[0.025]`
- No floating particles (removed — adds noise, reduces warmth)

### Landing Page Body Sections

**Stats section:** Removed — merged into hero trust strip.

**Bento Features Grid**

Component: `components/landing/bento-features.tsx` (new)

Asymmetric `grid-cols-3` at `lg:`, single column mobile. 5 tiles:

| Tile           | Size        | Content                                                          |
| -------------- | ----------- | ---------------------------------------------------------------- |
| Platform orbit | 2 cols wide | Existing `OrbitIntegrations`, copy "Write once, post everywhere" |
| Voice          | 1 col       | Typewriter cycling real business examples                        |
| Live counter   | 1 col       | `font-mono` post count ticking up, ambient pulse                 |
| Setup time     | 1 col       | "Ready in 10 minutes" 3-step mini-timeline                       |
| Video          | 2 cols wide | Remotion video embed, autoplay muted loop                        |

Cards: `bg-[#211e18] border border-white/[0.06] rounded-2xl p-8` with amber tinted shadow.
Stagger reveal on scroll entry using `IntersectionObserver` + CSS animation delay.

**Sticky Scroll How It Works**

Component: `components/landing/how-it-works.tsx` — rewrite

3 cards that stick sequentially. Left panel (40%) sticks with step number + headline. Right panel (60%) scrolls through 3 illustrated steps:

1. "Tell us about your business" — form mockup screenshot
2. "AI writes your content" — generation animation (typewriter in a card)
3. "Posts go live automatically" — schedule view mockup

**Testimonials — Masonry Wall**

Component: `components/landing/testimonials.tsx` — rewrite

3-column masonry (not carousel). 9 cards minimum. Each:

- `bg-[#211e18] border border-white/[0.06] rounded-2xl p-6`
- Amber star rating (`★★★★★ text-amber-400 text-sm`)
- Quote in `text-stone-300`
- Business name + type in `text-stone-500 text-sm`
- Avatar: coloured initials circle (no broken stock photos)
- Business types: café, tradie, salon, gym, florist, bakery, yoga studio, mechanic, restaurant

**Pricing Section**

Component: `components/landing/pricing-section.tsx` — replace existing PricingGrid

3 tiers (Starter/Pro/Agency). Pro highlighted:

- `bg-amber-500/[0.08] border border-amber-500/30` — glows warmer, not just taller
- Annual/monthly toggle: Framer Motion spring between price states
- AUD pricing: Starter $49 · Pro $99 · Agency $249
- Features list: amber check icons (`CheckCircle` Phosphor)

**CTA Section**

- `py-40` whitespace — no card border
- Headline: "Your next post is already written."
- Single amber pill CTA
- Ambient amber glow behind

**Footer**

4 columns, simplified. No link farm.

- Col 1: Logo + one-liner + social icons (Phosphor `LinkedinLogo`, `InstagramLogo`, `TwitterLogo`)
- Col 2: Product links
- Col 3: Company links
- Col 4: Legal + language

Bottom bar: `Privacy · Terms · © 2026 Synthex` on `border-t border-white/[0.05]`

### Sub-pages

**`/features`**

- Hero: left-aligned headline, `HandWrittenTitle` for accent word
- Platform grid: `OrbitIntegrations`
- Feature cards: `GlowCard` components with amber glow variant
- Entry animations: `ContainerStagger`

**`/pricing`**

- Hero: `PricingInteraction` toggle
- Tiers: new `PricingSection`
- FAQ accordion below
- Single amber CTA

**`/about`**

- Stats: `GlowCard` components
- Values: `ContainerStagger` grid
- Team section: `ProjectCards`
- CTA: `/contact?subject=careers`

**`/demo`**

- Full-page `LiveDemoWidget` (hero-sized)
- Feature list below showing what Synthex does after the demo
- CTA to signup

**`/blog`, `/support`, `/careers`**

- `MarketingLayout` wrapper
- Warm "coming soon" hero section
- Email capture form (POST to existing `/api/contact` or inline `mailto:`)

---

## Sub-project B: Client Website Generator

### Location

`/dashboard/website-builder` — Pro tier and above

### User Flow

```
1. Paste client URL
   ↓
2. "Analyse" → brand extraction (logo, colours, name, tagline, niche)
   ↓
3. Adjust taste-skill dials (DESIGN_VARIANCE, MOTION_INTENSITY, VISUAL_DENSITY)
   ↓
4. Select sections to generate (hero / features / pricing / testimonials / footer)
   ↓
5. "Generate" → LLM produces React component code per taste-skill spec
   ↓
6. Gemini generates 3–5 brand-matched images
   ↓
7. Live preview iframe + copy code + download as zip
   ↓  (optional)
8. Remotion renders 15-second intro video
```

### Components

| Component                 | Path                                             |
| ------------------------- | ------------------------------------------------ |
| Main page                 | `app/dashboard/website-builder/page.tsx`         |
| URL input + brand preview | `components/website-builder/BrandExtractor.tsx`  |
| Taste-skill dial controls | `components/website-builder/TasteSkillDials.tsx` |
| Section selector          | `components/website-builder/SectionSelector.tsx` |
| Code output panel         | `components/website-builder/CodePanel.tsx`       |
| Preview iframe            | `components/website-builder/PreviewFrame.tsx`    |
| Video renderer            | `components/website-builder/VideoRenderer.tsx`   |

### API Routes

| Route                           | Method | Purpose                          |
| ------------------------------- | ------ | -------------------------------- |
| `/api/website-builder/extract`  | POST   | Scrape URL, extract brand tokens |
| `/api/website-builder/generate` | POST   | LLM generates component code     |
| `/api/website-builder/images`   | POST   | Gemini image generation          |
| `/api/website-builder/video`    | POST   | Remotion render trigger          |

**Brand extraction** (`lib/website-builder/brand-extractor.ts`):

- Fetch URL with Cheerio/node-html-parser
- Extract: `<title>`, `<meta name="description">`, `og:image`, favicon, primary CSS colours (computed from inline styles + Tailwind classes), logo `<img>` src
- Classify niche via LLM: `{ niche: 'café' | 'tradie' | 'salon' | ... }`

**Code generation** (`lib/website-builder/code-generator.ts`):

- System prompt includes the full taste-skill SKILL.md content
- User prompt: brand tokens + dial settings + section list
- Model: `claude-sonnet-4-6` (highest quality code generation)
- Output: complete React/Next.js component files, Tailwind-only styling, no external deps beyond framer-motion + phosphor-icons

**Image generation:**

- Gemini 2.0 Flash `generateContent` with `responseModalities: ['IMAGE']`
- Prompt constructed from brand niche + colour palette
- 3–5 images: hero background, feature section, team/lifestyle photos

**Gating:** `requireSubscriptionTier('pro')` guard on all `/api/website-builder/*` routes.

---

## Implementation Order

### Phase A1 — Design System Foundation

1. Install Satoshi font (`@fontsource/satoshi`) + update `app/layout.tsx`
2. Install Framer Motion + Phosphor icons
3. Update `tailwind.config.ts`: add warm colour tokens, Satoshi/Geist Mono font families
4. Add grain texture overlay to root layout
5. Remove cyan global styles, replace with amber

### Phase A2 — Navigation

1. Rewrite `NavBar` as floating pill
2. Reskin `BottomMenu` to amber for mobile

### Phase A3 — Hero + Demo Widget

1. Build `LiveDemoWidget` component
2. Build `POST /api/demo/generate` route (OpenRouter caption + Gemini image)
3. Rewrite `HeroSection` with asymmetric layout + new widget

### Phase A4 — Body Sections

1. Build `BentoFeatures` grid (wire existing OrbitIntegrations)
2. Rewrite `HowItWorks` as sticky scroll
3. Rewrite `Testimonials` as masonry wall
4. Rewrite `PricingSection`
5. Rewrite `CTASection`
6. Rewrite `FooterSection`

### Phase A5 — Sub-pages

1. `/features` — wire GlowCard, OrbitIntegrations, HandWrittenTitle
2. `/pricing` — wire PricingSection + PricingInteraction
3. `/about` — wire GlowCard, ProjectCards, ContainerStagger
4. `/demo` — full-page LiveDemoWidget
5. `/blog`, `/support`, `/careers` — warm stubs

### Phase B — Website Builder

1. Brand extractor lib + API route
2. Dashboard page + BrandExtractor component
3. TasteSkillDials component
4. Code generator lib + API route
5. Gemini images route
6. CodePanel + PreviewFrame components
7. Remotion video route + VideoRenderer component

---

## Technical Constraints

- Stack: Next.js 15 App Router, TypeScript 5, Tailwind CSS v3, Prisma 6, Supabase Auth
- No new auth systems — Supabase only
- No `git add .` or `git add -A` — stage files individually
- All API routes: Zod validation + `getUserIdFromRequestOrCookies` auth (except `/api/demo/generate` which is public + rate-limited)
- Australian English throughout: colour, organise, licence
- No emojis in code or UI (taste-skill ANTI-EMOJI POLICY)
- Use Phosphor icons — not Lucide, not Heroicons
- `min-h-[100dvh]` not `h-screen`
- Framer Motion: perpetual animations isolated in dedicated `'use client'` leaf components

## New Dependencies Required

```bash
npm install @fontsource/satoshi
npm install framer-motion
npm install @phosphor-icons/react
```

(All others — Gemini SDK, Cheerio — check package.json first before installing)

---

## Success Criteria

- [ ] Synthex landing page scores ≥ 90 on taste-skill pre-flight checklist
- [ ] Hero demo widget returns result in < 4 seconds P95
- [ ] All 8 marketing pages render without HTTP 500
- [ ] Mobile layout collapses correctly on 375px viewport
- [ ] No Inter font anywhere in the codebase
- [ ] No cyan colour tokens remaining in marketing components
- [ ] Website Builder extracts brand from a real URL
- [ ] Website Builder generates copy-paste-ready React component code
- [ ] All new API routes have Zod validation
- [ ] `npm run type-check` passes (0 errors) after all changes
