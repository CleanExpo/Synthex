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

**Install:** `npm install @fontsource/satoshi` + register in `app/layout.tsx`. Geist Mono: `npm install geist`, then import via `import { GeistMono } from 'geist/font/mono'` in `app/layout.tsx` — do NOT use `next/font/google` (Geist is not a Google Font).

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
- Framer Motion is already installed at `^12.23.12` — no new install needed

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
| `/blog`     | Exists — reskin needed   | Warm redesign + email capture      |
| `/support`  | Exists — reskin needed   | Warm redesign + email capture      |
| `/careers`  | Exists — reskin needed   | Warm redesign, mailto CTA          |

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
- Preset buttons below input: "Cafe" · "Tradie" · "Salon" · "Gym" — one click populates and triggers (no emoji — complies with ANTI-EMOJI POLICY)

**API:** Two-step sequential fetch (not SSE — simpler to implement and test in Next.js App Router):

**Step 1 — Caption** `POST /api/demo/caption`

```typescript
// Request
{
  businessName: string;
  businessType: 'cafe' | 'tradie' | 'salon' | 'gym' | 'other';
}
// Response
{
  caption: string;
}
```

- Model: OpenRouter → `anthropic/claude-haiku-4-5` (verify exact slug in OpenRouter dashboard before shipping — no date suffix in the registered provider registry), ~300ms
- Called immediately on submit; caption renders first

**Step 2 — Image** `POST /api/demo/image`

```typescript
// Request
{
  businessName: string;
  businessType: 'cafe' | 'tradie' | 'salon' | 'gym' | 'other';
}
// Response
{
  imageDataUrl: string;
} // base64 data URI — e.g. "data:image/jpeg;base64,..."
```

- Gemini 2.0 Flash `generateContent` with `responseModalities: ['IMAGE']` via raw `fetch` against the Gemini REST API using `GEMINI_API_KEY` env var — **no `@google/generative-ai` SDK needed**
- Response is Gemini's base64 inline image, returned directly as a `data:image/jpeg;base64,...` URI (ephemeral — no Supabase Storage upload needed for the public demo)
- ~2–3s; skeleton shimmer shown until resolved

**LiveDemoWidget client flow:**

1. User submits → set `state = 'loading-caption'`
2. `fetch('/api/demo/caption')` → renders caption; set `state = 'loading-image'`
3. `fetch('/api/demo/image')` → replaces shimmer with image; set `state = 'done'`
4. Framer Motion spring animates card in on step 2 → populates image on step 3

**Rate limit:** Use the existing `aiGeneration` rate limiter preset (20 req/min per IP). Both routes share the single `ai-generation:<ip>` key that the preset hardcodes — they are not keyed separately. Because one full demo interaction consumes 2 slots (caption + image), the effective throughput is **10 demo completions/minute per IP**.

**No auth required** — both `/api/demo/caption` and `/api/demo/image` are fully public. Do NOT call `getUserIdFromRequestOrCookies` in these routes. The Technical Constraints section's auth rule is explicitly excepted for these two routes.

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

| Tile           | Size        | Content                                                                                                                                      |
| -------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform orbit | 2 cols wide | Existing `OrbitIntegrations`, copy "Write once, post everywhere"                                                                             |
| Voice          | 1 col       | Typewriter cycling real business examples                                                                                                    |
| Live counter   | 1 col       | `font-mono` post count ticking up, ambient pulse                                                                                             |
| Setup time     | 1 col       | "Ready in 10 minutes" 3-step mini-timeline                                                                                                   |
| Video          | 2 cols wide | Pre-rendered `.mp4` embed (`public/videos/demo-loop.mp4`), autoplay muted loop. If asset is not available, replace with static illustration. |

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

3 tiers (Starter/Pro/Agency). Pro highlighted.

**UI label → `Subscription.plan` mapping** (do not use UI labels as plan values in code):

| UI Label | `plan` value     | Price AUD |
| -------- | ---------------- | --------- |
| Starter  | `'free'`         | $49/mo    |
| Pro      | `'professional'` | $99/mo    |
| Agency   | `'business'`     | $249/mo   |

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

**`ContainerStagger` component** (new — `components/landing/container-stagger.tsx`):

Simple utility that applies CSS `animation-delay: calc(var(--i) * 80ms)` stagger to its children via a wrapper `div`. Children receive an index via CSS custom property. No Framer Motion — pure CSS animation, server-renderable.

```tsx
// Usage: wraps any list/grid of items
<ContainerStagger>
  {items.map((item, i) => (
    <div key={i} style={{ '--i': i } as React.CSSProperties}>{...}</div>
  ))}
</ContainerStagger>
```

**`/features`**

- Hero: left-aligned headline, `HandWrittenTitle` for accent word (`components/landing/handwriting-text.tsx`, exports `HandWrittenTitle`)
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

- Full-page `LiveDemoWidget` (hero-sized — `max-w-2xl mx-auto` centred, not constrained to a 45% column)
- The widget accepts a `size` prop: `'hero'` (column-constrained, 45%) and `'full'` (centred, `max-w-2xl`)
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
- Model: `claude-sonnet-4-6` — verify this exact slug is available on OpenRouter before shipping (registry lists `claude-sonnet-4-5` as the current balanced model; confirm with OpenRouter if 4-6 is listed)
- **Output contract:** LLM returns a JSON object:
  ```typescript
  {
    files: Array<{ filename: string; content: string }>;
    // e.g. [{ filename: "HeroSection.tsx", content: "..." }, ...]
  }
  ```
- Each file is a complete, self-contained React component — Tailwind-only styling, no external deps beyond `framer-motion` and `@phosphor-icons/react`
- `CodePanel` renders each file as a syntax-highlighted tab; "Download as zip" uses `jszip` to package the `files` array

**Image generation:**

- Gemini 2.0 Flash `generateContent` with `responseModalities: ['IMAGE']` via raw `fetch` (no SDK)
- Prompt constructed from brand niche + colour palette
- 3–5 images: hero background, feature section, team/lifestyle photos
- Base64 response from Gemini is uploaded to **Supabase Storage** (`website-builder` public bucket, `{organizationId}/{generationId}/{index}.jpg`) and the **permanent public URL** is returned to the client and persisted in `GeneratedWebsite.imageUrls`. Use a public bucket — signed URLs expire and are unsuitable for persisted records.

### Prisma Model

Add to `prisma/schema.prisma`:

```prisma
model GeneratedWebsite {
  id            String   @id @default(cuid())
  userId        String
  organizationId String
  clientUrl      String
  brandTokens    Json     // { name, colours, logo, tagline, niche }
  dialSettings   Json     // { designVariance, motionIntensity, visualDensity }
  sections       String[] // ["hero", "features", "pricing", ...]
  generatedFiles Json     // Array<{ filename: string, content: string }>
  imageUrls      String[] // Supabase Storage permanent public URLs
  status         String   @default("draft") // "draft" | "complete"
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user         User         @relation(fields: [userId], references: [id])
  organization Organization @relation(fields: [organizationId], references: [id])
  // Note: schema uses American spelling 'Organization' throughout — must match exactly

  @@index([userId])
  @@index([organizationId])
}
```

Add `generatedWebsites GeneratedWebsite[]` to both `User` and `Organization` models.

**Gating:** All `/api/website-builder/*` routes use the standard auth pattern — `getUserIdFromRequestOrCookies` from `lib/auth/jwt-utils.ts`, then a Prisma lookup on `Subscription.plan` (actual values: `'free' | 'professional' | 'business' | 'custom'`). There is no pre-built `requireSubscriptionTier` helper — the check is written inline per route:

```typescript
const userId = await getUserIdFromRequestOrCookies(req);
if (!userId)
  return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
const sub = await prisma.subscription.findUnique({ where: { userId } });
// Actual Subscription.plan values: 'free' | 'professional' | 'business' | 'custom'
// Also check status — cancelled subscriptions must not pass the gate
if (
  !sub ||
  !['professional', 'business', 'custom'].includes(sub.plan) ||
  !['active', 'trialing'].includes(sub.status)
) {
  return NextResponse.json(
    { error: 'Pro subscription required' },
    { status: 403 }
  );
}
```

---

## Implementation Order

### Phase A1 — Design System Foundation

1. Install Satoshi font (`@fontsource/satoshi`) + update `app/layout.tsx`
2. Install Phosphor icons (`framer-motion` already installed — skip)
3. Update `tailwind.config.ts`: add warm colour tokens, Satoshi/Geist Mono font families
4. Add grain texture overlay to root layout
5. Remove cyan global styles, replace with amber

### Phase A2 — Navigation

1. Rewrite `NavBar` as floating pill
2. Reskin `BottomMenu` to amber for mobile

### Phase A3 — Hero + Demo Widget

1. Build `LiveDemoWidget` component (two-step fetch: caption then image)
2. Build `POST /api/demo/caption` route (OpenRouter `claude-haiku-4-5-20251001`)
3. Build `POST /api/demo/image` route (Gemini 2.0 Flash raw fetch → base64 data URI)
4. Rewrite `HeroSection` with asymmetric layout + new widget

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

1. Add `GeneratedWebsite` Prisma model → `npx prisma db push`
2. Brand extractor lib + API route
3. Dashboard page + BrandExtractor component
4. TasteSkillDials + SectionSelector components
5. Code generator lib + API route (output: `{ files: Array<{ filename, content }> }`)
6. Gemini images route (base64 → Supabase Storage public bucket → permanent public URL)
7. CodePanel + PreviewFrame components + zip download (`jszip`)
8. Remotion video route + VideoRenderer component (optional, defer if schedule is tight)

**Remotion note:** `@remotion/renderer` (the server-side rendering package) is NOT in `package.json`. The video route (`step 8`) is **deferred** until it is explicitly installed. The `VideoRenderer` component may be scaffolded but the API route must not be enabled. For Phase A's "Bento Features" video tile, use a **pre-rendered `.mp4` file** at `public/videos/demo-loop.mp4` — do not render at runtime on a marketing page.

**PreviewFrame iframe security:** The `PreviewFrame` component renders LLM-generated React code in a preview iframe. Rendering strategy: the generated code is compiled server-side via the `/api/website-builder/generate` route and the resulting HTML is passed as an `srcdoc` attribute. The iframe MUST include:

```tsx
<iframe srcDoc={previewHtml} sandbox="allow-scripts" title="Website preview" />
```

**Sandbox rule:** `allow-scripts` only — do NOT add `allow-same-origin`. The combination of both flags allows the iframe to escape the sandbox and access the parent's cookies/localStorage via `document.domain`. With `allow-scripts` only, the iframe runs in an opaque unique origin, fully isolated from the parent.

**No `csp` attribute** — the `csp` attribute on `<iframe>` is non-standard HTML with no effect in Firefox or Safari. CSP for preview content is enforced by the sandbox origin isolation above. Do not use `eval()` or dynamic `import()` client-side. The preview is display-only — no form submissions, no navigation.

---

## Technical Constraints

- Stack: Next.js 15 App Router, TypeScript 5, Tailwind CSS v3, Prisma 6, Supabase Auth
- No new auth systems — Supabase only
- No `git add .` or `git add -A` — stage files individually
- All API routes: Zod validation + `getUserIdFromRequestOrCookies` auth (except `/api/demo/caption` and `/api/demo/image` which are public + rate-limited — do NOT call getUserIdFromRequestOrCookies in these two routes)
- Australian English throughout: colour, organise, licence
- No emojis in code or UI (taste-skill ANTI-EMOJI POLICY)
- Use Phosphor icons — not Lucide, not Heroicons
- `min-h-[100dvh]` not `h-screen`
- Framer Motion: perpetual animations isolated in dedicated `'use client'` leaf components

## New Dependencies Required

```bash
npm install @fontsource/satoshi      # Satoshi display font
npm install geist                    # Geist Mono font (import via geist/font/mono)
npm install @phosphor-icons/react    # Icon library (replaces Lucide/Heroicons in marketing)
npm install jszip                    # Website Builder zip download (jszip 3.10+ ships own TS types — do NOT install @types/jszip)
```

Already installed — **do not reinstall:**

- `framer-motion` — already at `^12.23.12`

**No Gemini SDK needed** — use raw `fetch` against the Gemini REST API with `GEMINI_API_KEY` (matches the existing integration pattern in the codebase)

---

## Success Criteria

- [ ] Hero demo widget: caption appears in < 1s, full card (caption + image) renders in < 4s P95
- [ ] All 8 marketing pages render without HTTP 500 (verify with `npm run build`)
- [ ] Mobile layout collapses correctly at 375px — navbar pill → BottomMenu, no horizontal overflow
- [ ] No Inter font anywhere in marketing components (`grep -r "Inter" components/landing app/`)
- [ ] No cyan colour tokens remaining in marketing components (`grep -r "cyan" components/landing app/`)
- [ ] Warm amber glow present in hero (visual check — `bg-amber-500/[0.06] blur-[200px]`)
- [ ] Website Builder: brand extraction succeeds for a real local business URL
- [ ] Website Builder: generated files JSON contains at least 3 named `.tsx` component files
- [ ] Website Builder: download zip contains all generated files
- [ ] Website Builder: gated behind Pro tier (403 returned for free-tier users)
- [ ] All new API routes have Zod request body validation
- [ ] `npm run type-check` passes (0 errors) after all changes
- [ ] `npm run lint` passes after all changes
