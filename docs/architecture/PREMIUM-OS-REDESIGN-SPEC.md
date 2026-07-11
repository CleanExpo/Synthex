# Synthex Premium OS Redesign Spec

**Status:** Design & implementation blueprint  
**Issue:** SYN-57 (architecture wave)  
**Scope:** Landing + logged-in product — incremental refactor, not rewrite  
**Stack:** React 19 · Next.js App Router · Tailwind v4 · existing `components/` architecture

---

## 1. UX Audit (Current State)

### 1.1 Landing (`app/page.tsx` + `components/landing/public-v2.tsx`)

| Area               | Current                                                                                                            | Gap                                                                                                                                 | Severity |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **Hero**           | Editorial headline + static 3-card `HeroCommandVisual`                                                             | Cards are text-only mockups, not real UI; no sequential reveal; workflow stops at "Produce" (missing Approval → Publish → Insights) | High     |
| **Colour**         | Hardcoded `#08090b`, `#101216`, orange pills                                                                       | Diverges from token system in `globals.css` / `lib/design-tokens.ts`; 54 legacy landing components coexist                          | Medium   |
| **Trust**          | Pilot badge + `SafetyStrip`                                                                                        | No dedicated trust strip (Approval Gated, Evidence Backed, etc.); security not prominent above fold                                 | Medium   |
| **Workflow story** | `SimpleMarketingModel` (3 cards) + optional `WorkflowBand` on `/features`                                          | 7-stage pipeline (Capture → Insights) not unified; no scroll-driven product walkthrough                                             | High     |
| **Feature proof**  | `featurePillars` text cards on `/features`                                                                         | No bento grid with real UI crops; reads as marketing copy not product                                                               | High     |
| **Social proof**   | Limited / pilot framing                                                                                            | No structured testimonial schema; EEAT weak on homepage                                                                             | Medium   |
| **SEO**            | Inline metadata on homepage; `lib/seo/metadata.ts` default description says "fully autonomous AI marketing agency" | Misaligned with approval-gated positioning; keyword strategy not applied to H1/H2 hierarchy                                         | High     |
| **Motion**         | Static; legacy `LandingAnimations.tsx`, `floating-particles.tsx`, `aurora-background.tsx` unused on current page   | Risk of reintroducing flashy patterns; Lenis smooth scroll global                                                                   | Low      |
| **Performance**    | Server Component page — good                                                                                       | Hero visual could be RSC + one lazy client island for card sequence                                                                 | Low      |

**Strengths to preserve**

- `SiteShell` / `PublicNav` / `PublicFooter` shell is clean and shippable
- Evidence-first copy in `workflowStages`, `commandCenterLanes`
- Dark editorial tone fits premium B2B
- Primary CTA path (`/contact` pilot access) is clear
- Homepage is mostly Server Components

### 1.2 Logged-in Product (`app/dashboard/`)

| Area                    | Current                                                                                                                   | Gap                                                                                          | Severity |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------- |
| **Dashboard home**      | Widget soup: `AICommandCentre`, `HealthScoreWidget`, `RevenueProjectionWidget`, `BrandIQCard`, etc. (10+ dynamic imports) | No single "Today" narrative; cognitive overload; fails workflow question test                | Critical |
| **Navigation**          | `Sidebar` in `dashboard/layout.tsx` (~1000 lines) with 40+ nav icons                                                      | Deep flat list; no pinned/recent; collapse state exists but not Linear-grade                 | High     |
| **Command palette**     | `components/command-palette/` — ⌘K, `cmdk`, route navigation                                                              | Exists but not product-wide (campaigns, approvals, assets search); styling not token-unified | Medium   |
| **Approvals**           | `/dashboard/approvals` separate from content preview                                                                      | No split-pane approval experience spec'd in UI                                               | High     |
| **Brand scope**         | `BusinessSwitcher` present                                                                                                | Good foundation; needs prominence + org visual identity                                      | Medium   |
| **Design tokens**       | `globals.css` v3 + `lib/design-tokens.ts` (indigo-primary legacy)                                                         | Product uses shadcn semantic tokens; landing uses raw hex — two systems                      | High     |
| **Empty states**        | Inconsistent across modules                                                                                               | No shared `GhostLayout` pattern                                                              | Medium   |
| **Evidence / research** | Scattered across SEO, intelligence, agency modules                                                                        | No unified `ResearchPanel` side sheet                                                        | High     |

### 1.3 Technical Debt Blocking Premium Feel

1. **Dual design systems:** `public-v2.tsx` hex vs `globals.css` CSS variables vs `lib/design-tokens.ts` indigo palette
2. **Landing component graveyard:** 54 files in `components/landing/` — only ~6 used on live homepage
3. **SEO copy drift:** `DEFAULT_DESCRIPTION` in `lib/seo/metadata.ts` contradicts approval-gated product truth
4. **Dashboard client bundle:** Heavy dynamic imports on first paint for `/dashboard`
5. **No shared `StatusPill` contract** across calendar, approvals, publish queue

---

## 2. Before vs After (Measurable Targets)

| Metric                           | Before (est.)           | After (target) | How measured                             |
| -------------------------------- | ----------------------- | -------------- | ---------------------------------------- |
| Landing LCP                      | ~2.8s mobile            | <2.0s          | Lighthouse CI, Vercel Speed Insights     |
| Landing CLS                      | ~0.05                   | <0.02          | Reserve hero mock dimensions             |
| Dashboard JS (first load)        | ~450KB+ parsed          | <280KB         | `@next/bundle-analyzer`                  |
| Lighthouse Accessibility         | ~88                     | ≥95            | axe + manual keyboard pass               |
| Lighthouse SEO                   | ~92                     | ≥98            | Structured data + meta alignment         |
| Time-to-first-action (dashboard) | ~8s scan                | <3s            | Pending approvals visible without scroll |
| Component token compliance       | ~40% raw hex on landing | 100% CSS vars  | ESLint/style audit                       |
| Nav items to primary task        | 2–4 clicks              | 1 click or ⌘K  | UX task test                             |

---

## 3. Wireframes (ASCII)

### 3.1 Landing — Desktop (1440px)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Logo SYNTHEX]   Features  Platform  Security  Pilot    [Request Access]  │ ← sticky, blur, h-14→h-12
├─────────────────────────────────────────────────────────────────────────────┤
│ HERO (gradient #050608)                                                     │
│ ┌──────────────────────────────┐  ┌──────────────────────────────────────┐  │
│ │ Eyebrow: Controlled pilot    │  │ ┌─ Voice Transcript ──── [Intake] ─┐ │  │
│ │ H1: Marketing plans teams    │  │ ├─ Research Bundle ─── [Verified]─┤ │  │
│ │     actually approve.          │  │ ├─ Campaign Plan ───── [Draft] ───┤ │  │
│ │ Sub: one-sentence workflow     │  │ ├─ Creative Assets ─── [Staged] ─┤ │  │
│ │ [Request Pilot] [Explore]      │  │ ├─ Awaiting Approval ─ [Gate] ────┤ │  │
│ │ ✓ Approval ✓ Evidence ✓ AU     │  │ └─ Scheduled ───────── [Queued] ──┘ │  │
│ └──────────────────────────────┘  └──────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│ TRUST STRIP (monochrome icons, border-y white/4)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ HOW IT WORKS — interactive timeline (scroll or click)                       │
│ Capture → Research → Strategy → Creative → Approval → Publish → Insights  │
│ [UI screenshot per stage — horizontal on desktop]                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ BENTO FEATURE GRID (2×4) — real UI thumbnails + StatusPill                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ PRODUCT WALKTHROUGH — scroll story (Stripe-docs style)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ ENTERPRISE CARDS — governance, audit, permissions                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ SOCIAL PROOF — 2–3 quotes, schema-ready                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ SECURITY CONFIDENCE — link /security                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ FINAL CTA — single button, gradient band                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ FOOTER — Product / Company / Legal clusters                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Landing — Mobile (390px)

```
┌──────────────────────┐
│ ☰  SYNTHEX    [CTA]  │
├──────────────────────┤
│ H1 (text-4xl)        │
│ Sub + dual CTAs      │
│ Trust chips (wrap)   │
├──────────────────────┤
│ Swipeable card stack │ ← HeroProductMock
│ (workflow stages)    │
├──────────────────────┤
│ Timeline (vertical)  │
├──────────────────────┤
│ Bento (1 col)        │
├──────────────────────┤
│ Walkthrough sections │
├──────────────────────┤
│ FAQ accordion        │
├──────────────────────┤
│ Final CTA            │
└──────────────────────┘
```

### 3.3 Dashboard — Today View

```
┌──┬──────────────────────────────────────────────────────────────────────────┐
│≡ │ SYNTHEX  [Brand ▾]  [Workspace ▾]              🔍 ⌘K  🔔  [Avatar ▾]   │
├──┼──────────────────────────────────────────────────────────────────────────┤
│  │ Good morning, {name} · {brand} · {date}                                  │
│N │──────────────────────────────────────────────────────────────────────────│
│a │ TODAY                                                                     │
│v │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ │ Pending     │ │ Upcoming    │ │ Blocked     │ │ Recent      │          │
│  │ │ Approvals 3 │ │ Posts 5     │ │ Campaigns 1 │ │ Research 2  │          │
│  │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘          │
│  │ Morning Brief (collapsible evidence summary)                              │
│  │ Activity Feed · Quick Actions [New plan] [Review queue] [Calendar]       │
└──┴──────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Campaign Workspace

```
┌──────────┬───────────────────────────────┬──────────────────┐
│ Timeline │ Editor / Plan cards           │ Evidence Panel   │
│ stages   │                               │ Sources          │
│ ● Intake │ ┌─────────────────────────┐   │ Confidence       │
│ ● Research│ │ Campaign card content  │   │ Citations        │
│ ○ Draft  │ └─────────────────────────┘   │ Comments         │
│ ○ Review │                               │ Approval actions │
└──────────┴───────────────────────────────┴──────────────────┘
│ Sticky: [Request changes] [Approve] [Schedule]               │
└──────────────────────────────────────────────────────────────┘
```

### 3.5 Approval Split Pane

```
┌─────────────────────────┬─────────────────────────┐
│ Asset preview           │ Version · Comments      │
│ (post / video / email)  │ Diff highlights         │
│                         │ Approver list           │
├─────────────────────────┴─────────────────────────┤
│ ⌘↵ Approve   ⌘⇧R Reject   · Role: {role}        │
└───────────────────────────────────────────────────┘
```

---

## 4. Design Tokens

Add to `app/globals.css` under `:root` and `.dark` (canonical — deprecate raw hex in landing):

```css
/* Premium OS v4 — dark-first */
--sx-bg-primary: #050608;
--sx-bg-secondary: #0c0e12;
--sx-bg-panel: #12151b;
--sx-bg-elevated: #181c23;
--sx-bg-subtle: #20252e;

--sx-border: rgba(255, 255, 255, 0.08);
--sx-border-soft: rgba(255, 255, 255, 0.04);

--sx-text-primary: #f5f7fa;
--sx-text-secondary: #b6bcc7;
--sx-text-muted: #7d8694;

--sx-accent: #ff7a18;
--sx-accent-hover: #ff933c;
--sx-success: #22c55e;
--sx-info: #38bdf8;
--sx-warning: #f59e0b;
--sx-danger: #ef4444;
--sx-intelligence: #8b5cf6;

--sx-gradient-hero: linear-gradient(
  180deg,
  #050608 0%,
  #090b10 55%,
  #050608 100%
);
--sx-gradient-accent: linear-gradient(135deg, #ff7a18, #ffb15e);
--sx-gradient-intelligence: linear-gradient(135deg, #5b8cff, #8b5cf6);

--sx-glow-max-opacity: 0.15;

--sx-radius-card: 18px;
--sx-radius-button: 14px;
--sx-radius-input: 16px;

--sx-section-py: 8rem; /* py-32 */
--sx-container-max: 90rem; /* 1440px */
--sx-content-max: 77.5rem; /* 1240px */

--sx-ease-premium: cubic-bezier(0.2, 0.8, 0.2, 1);
--sx-duration-fast: 100ms;
--sx-duration-base: 160ms;
--sx-duration-slow: 220ms;

--sx-shadow-elevated:
  0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 8px 32px rgba(0, 0, 0, 0.4);
--sx-shadow-glow-accent: 0 0 24px rgba(255, 122, 24, 0.12); /* ≤15% effective */
```

### Tailwind extension (`tailwind.config.cjs`)

```js
theme: {
  extend: {
    colors: {
      sx: {
        bg: { primary: 'var(--sx-bg-primary)', secondary: 'var(--sx-bg-secondary)', panel: 'var(--sx-bg-panel)', elevated: 'var(--sx-bg-elevated)', subtle: 'var(--sx-bg-subtle)' },
        text: { primary: 'var(--sx-text-primary)', secondary: 'var(--sx-text-secondary)', muted: 'var(--sx-text-muted)' },
        accent: { DEFAULT: 'var(--sx-accent)', hover: 'var(--sx-accent-hover)' },
        intelligence: 'var(--sx-intelligence)',
      },
    },
    borderRadius: { card: 'var(--sx-radius-card)', 'btn': 'var(--sx-radius-button)', input: 'var(--sx-radius-input)' },
    maxWidth: { container: 'var(--sx-container-max)', content: 'var(--sx-content-max)' },
    transitionTimingFunction: { premium: 'var(--sx-ease-premium)' },
  },
}
```

### Typography

| Token        | Font                | Size          | Weight | Tracking | Use                  |
| ------------ | ------------------- | ------------- | ------ | -------- | -------------------- |
| `display-xl` | Geist / Inter Tight | 4.5rem / 72px | 600    | -0.03em  | Hero H1 desktop      |
| `display-lg` | Geist               | 3rem / 48px   | 600    | -0.02em  | Section H2           |
| `heading-md` | Inter               | 1.5rem        | 600    | -0.01em  | Card titles          |
| `body-lg`    | Inter               | 1.125rem      | 400    | 0        | Hero sub             |
| `body-md`    | Inter               | 1rem          | 400    | 0        | Body                 |
| `label-sm`   | Inter               | 0.75rem       | 600    | 0.22em   | Eyebrows (uppercase) |
| `mono-sm`    | Geist Mono          | 0.8125rem     | 400    | 0        | Evidence refs        |

**Implementation:** extend existing `next/font` in `app/layout.tsx`; map `--font-display` and `--font-sans`.

### Status colours (shared product-wide)

| Status            | Background | Text      | Border       |
| ----------------- | ---------- | --------- | ------------ |
| draft             | `#20252E`  | `#B6BCC7` | `white/8`    |
| staged            | `#181C23`  | `#38BDF8` | `#38BDF8/30` |
| awaiting_approval | `#181C23`  | `#F59E0B` | `#F59E0B/30` |
| approved          | `#181C23`  | `#22C55E` | `#22C55E/30` |
| scheduled         | `#181C23`  | `#8B5CF6` | `#8B5CF6/30` |
| published         | `#181C23`  | `#F5F7FA` | `white/8`    |
| failed            | `#181C23`  | `#EF4444` | `#EF4444/30` |

---

## 5. Component Specifications

### 5.1 `HeroProductMock`

**Purpose:** Hero right column — sequential workflow cards using real product chrome.  
**Location:** `components/landing/premium/HeroProductMock.tsx` (client island)  
**Variants:** `static` (RSC fallback), `animated` (default)  
**States:** loading skeleton → cards 1–6 reveal (stagger 80ms, opacity + translateY 8px)  
**A11y:** `aria-live="polite"` on active card; `prefers-reduced-motion` → all cards visible instantly  
**Responsive:** Desktop grid; mobile horizontal scroll-snap  
**Tailwind:** `bg-sx-bg-elevated border border-white/8 rounded-card p-3`  
**Data:** Reuse shapes from `commandCenterLanes` in `public-v2.tsx`

### 5.2 `WorkflowTimeline`

**Purpose:** Replace `SimpleMarketingModel` — 7-stage interactive timeline  
**Variants:** `horizontal` (lg+), `vertical` (mobile)  
**Interaction:** Click/scroll spy highlights active stage; 200ms border transition  
**Content:** Real UI screenshot slots (`next/image`, WebP, explicit w/h)

### 5.3 `StatusPill`

**Purpose:** Unified status language across landing mocks + product  
**Variants:** `draft | staged | awaiting_approval | approved | scheduled | published | failed`  
**Sizes:** `sm`, `md`  
**A11y:** `role="status"`, text never colour-only

### 5.4 `EvidenceCard`

**Purpose:** Citation/source display in research and campaign workspace  
**States:** collapsed (title + domain), expanded (snippet + link + confidence %)  
**Motion:** height transition 160ms

### 5.5 `TodayDashboard`

**Purpose:** Replace widget grid on `/dashboard`  
**Sections:** MorningBrief, MetricTiles (4-up), ActivityFeed, QuickActions  
**Data sources:** `/api/dashboard/stats`, approvals API, calendar API — consolidate into `/api/dashboard/today` (new, Phase 2)  
**RSC:** Shell server-rendered; tiles client only where live

### 5.6 `CommandBar` (extend existing)

**File:** Evolve `components/command-palette/`  
**Add groups:** Campaigns, Brands, Approvals, Assets, SEO, Calendar, People, Settings  
**Add:** Recent items (localStorage), fuzzy search across entity IDs  
**Style:** Match Raycast — `bg-sx-bg-panel border border-white/8 rounded-card`

### 5.7 `ApprovalSidebar`

**Purpose:** Right pane in approval split layout  
**Sections:** VersionHistory, CommentThread, ApproverList, AuditTimeline  
**Keyboard:** `a` approve, `r` reject (when focused)

### 5.8 `ResearchPanel`

**Purpose:** Expandable side sheet — sources, confidence, reasoning  
**Trigger:** "View evidence" on any AI-generated block  
**Never:** Chat-bubble "AI is thinking" — always structured evidence list

### 5.9 `GlassPanel`

**Purpose:** Elevated container for landing bento + dashboard cards  
**Classes:** `bg-sx-bg-elevated/80 backdrop-blur-md border border-white/8 rounded-card`

### 5.10 `SkeletonLoader`

**Purpose:** Layout-matched loading — no spinners in content areas  
**Rule:** Every async widget must ship skeleton with exact final dimensions

_(Full specs for remaining components — CampaignCard, BrandSwitcher, AuditTimeline, NotificationToast, etc. — follow same template; implement in Phase 2–3.)_

---

## 6. Tailwind Implementation Guidance

1. **Migrate landing hex → tokens** in `public-v2.tsx`: `#08090b` → `bg-sx-bg-primary`, etc.
2. **Create** `components/landing/premium/` for new primitives; keep `public-v2.tsx` as barrel re-export during migration.
3. **Extend** `Button` variants in `components/ui/button.tsx`: `premium-primary` already exists — align to `--sx-gradient-accent`.
4. **Card** variant `glass` → map to `GlassPanel` tokens.
5. **Do not delete** legacy `components/landing/*` until Phase 4 — mark unused with `@deprecated` JSDoc.
6. **Use** `@container` queries for bento grid reflow.
7. **Charts:** use existing chart tokens; intelligence accent for AI-derived metrics only.

---

## 7. Next.js App Router Integration

| Route                              | Change                                                                    | RSC/Client                |
| ---------------------------------- | ------------------------------------------------------------------------- | ------------------------- |
| `app/page.tsx`                     | New sections + metadata via `generateMetadata` from `lib/seo/metadata.ts` | Mostly RSC                |
| `app/features/page.tsx`            | Bento grid + walkthrough                                                  | RSC + lazy client islands |
| `app/dashboard/page.tsx`           | Swap to `TodayDashboard`                                                  | RSC shell + client tiles  |
| `app/dashboard/layout.tsx`         | Slim nav groups; extract nav config to `config/dashboard-nav.ts`          | Client (existing)         |
| `app/layout.tsx`                   | Font tokens, JSON-LD org schema                                           | RSC                       |
| `app/api/dashboard/today/route.ts` | **New** aggregated Today endpoint                                         | Route handler             |

**JSON-LD:** Add `components/seo/StructuredData.tsx` — SoftwareApplication, Organization, FAQ, BreadcrumbList.

**Internal linking:** Homepage → `/features`, `/security`, `/contact`, `/about`; contextual anchors in walkthrough.

---

## 8. Motion Specification

### Animate (allowed)

| Element            | Trigger              | Duration                     | Easing   |
| ------------------ | -------------------- | ---------------------------- | -------- |
| Hero cards         | mount / in-view once | 160ms stagger 80ms           | premium  |
| Nav height         | scroll > 24px        | 150ms                        | premium  |
| StatusPill change  | data update          | 120ms                        | premium  |
| Button press       | active               | 100ms                        | premium  |
| Command palette    | open/close           | 180ms opacity + scale 0.98→1 | premium  |
| Tab indicator      | click                | 160ms                        | premium  |
| Skeleton → content | load                 | crossfade 160ms              | ease-out |
| Timeline stage     | scroll spy           | border-color 200ms           | premium  |

### Never animate

- Background gradients, grid textures, noise
- Infinite loops, particles, floating icons
- Parallax, 3D transforms, rotating gradients
- Heavy backdrop-blur stacks (>12px on large areas)
- Route transitions (no slide pages)

**Reduced motion:** `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition-duration: 0.01ms !important; } }` — already partially in globals; enforce in new components.

---

## 9. SEO Implementation

### 9.1 Homepage copy (rewrite)

**Title (58 chars):** `Synthex | AI Marketing Operating System`  
**Meta description (158 chars):** `Turn voice notes and meetings into evidence-backed campaign plans, creative assets and approval-ready workflows. The marketing command center for agencies and in-house teams.`  
**H1:** Marketing plans that teams actually approve.  
**H2 examples:** How Synthex works · Enterprise marketing governance · Built for controlled pilots

### 9.2 Fix `lib/seo/metadata.ts`

Replace `DEFAULT_DESCRIPTION` — remove "fully autonomous" / "viral" language. Align with approval-gated EEAT copy.

### 9.3 Structured data (homepage)

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Synthex",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "AI marketing operating system for campaign planning, creative production and approval-gated publishing.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "AUD",
    "description": "Controlled pilot access"
  }
}
```

### 9.4 FAQ section (long-tail)

Target queries:

- "What is a marketing approval workflow?"
- "How do agencies use AI for campaign planning?"
- "Marketing governance software for enterprise teams"

### 9.5 Checklist

- [ ] Unique H1/H2/H3 per page
- [ ] Title 50–60 chars, meta 150–160 chars
- [ ] OG + Twitter cards via `generateMetadata`
- [ ] Canonical URLs on all public pages
- [ ] JSON-LD: SoftwareApplication, Organization, FAQ, Breadcrumbs
- [ ] Semantic landmarks: `<header>`, `<main>`, `<section aria-labelledby>`, `<footer>`
- [ ] Alt text on all product screenshots
- [ ] Internal links: Features, Security, Contact, About
- [ ] `sitemap.ts` + `robots.ts` verified
- [ ] Core Web Vitals: LCP image priority, no CLS in hero
- [ ] Review schema on testimonials (anonymous ok)

---

## 10. Accessibility Checklist

- [ ] WCAG 2.1 AA contrast on all text (4.5:1 body, 3:1 large)
- [ ] Visible focus rings: `ring-2 ring-sx-accent ring-offset-2 ring-offset-sx-bg-primary`
- [ ] Skip link to main content
- [ ] ⌘K and all approval shortcuts documented + screen-reader accessible
- [ ] `aria-label` on icon-only nav (collapsed sidebar)
- [ ] Video walkthrough: captions, no autoplay audio
- [ ] Forms: associated labels, error announcements
- [ ] Reduced motion respected globally
- [ ] Touch targets ≥44px mobile

---

## 11. Performance Checklist

- [ ] Hero: RSC + single client island (`HeroProductMock`)
- [ ] `next/image` WebP/AVIF, explicit sizes, `priority` on LCP
- [ ] Dynamic import dashboard widgets below fold only
- [ ] New `/api/dashboard/today` — one request vs many
- [ ] Remove unused landing components from bundle (tree-shake)
- [ ] Audit Lenis — disable on landing if INP regresses
- [ ] Lighthouse ≥95 all categories on `/` and `/dashboard`
- [ ] `loading.tsx` + skeletons for dashboard routes

---

## 12. Phased Rollout

### Phase 1 — Navigation, Hero, Landing (1–2 weeks)

**Files:** `app/page.tsx`, `components/landing/public-v2.tsx`, `app/globals.css`, `lib/seo/metadata.ts`  
**Deliverables:**

- Token v4 in CSS + Tailwind
- `HeroProductMock`, `TrustStrip`, `WorkflowTimeline`
- SEO metadata + JSON-LD
- Migrate `PublicNav` shrink-on-scroll
- Deprecate unused landing animation components

**Do not:** Touch dashboard yet.

### Phase 2 — Dashboard Today + Command Bar (1–2 weeks)

**Files:** `app/dashboard/page.tsx`, `components/command-palette/*`, new `components/dashboard/today/*`, `app/api/dashboard/today/route.ts`  
**Deliverables:**

- `TodayDashboard` replaces widget soup (keep widgets as drill-down links)
- Extended ⌘K entity search
- `StatusPill` in shared UI
- Nav config extraction + grouped sidebar

### Phase 3 — Campaign Workspace, Approvals, Calendar (2–3 weeks)

**Deliverables:**

- Split-pane approval UI
- Campaign workspace 3-column layout
- Calendar conflict detection UX polish
- `ResearchPanel` side sheet

### Phase 4 — Motion, A11y, SEO, Performance Hardening (1 week)

**Deliverables:**

- Lighthouse CI gates
- FAQ + testimonial schema
- Legacy landing cleanup (delete unused)
- Documentation update in `docs/architecture/`
- Full keyboard audit

---

## 13. File Map (Incremental Refactor)

```
app/
  page.tsx                          # Phase 1 — new sections
  layout.tsx                        # Phase 1 — fonts + JSON-LD
  globals.css                       # Phase 1 — sx tokens
  dashboard/page.tsx                # Phase 2 — TodayDashboard
  api/dashboard/today/route.ts      # Phase 2 — new

components/
  landing/
    public-v2.tsx                   # Phase 1 — token migration, re-exports
    premium/
      HeroProductMock.tsx           # Phase 1 — new
      WorkflowTimeline.tsx          # Phase 1 — new
      TrustStrip.tsx                # Phase 1 — new
      FeatureBento.tsx              # Phase 1 — new
      ProductWalkthrough.tsx        # Phase 1 — new
  dashboard/today/                  # Phase 2 — new
  ui/status-pill.tsx                # Phase 2 — new shared
  command-palette/                  # Phase 2 — extend
  seo/StructuredData.tsx            # Phase 1 — new

config/
  dashboard-nav.ts                  # Phase 2 — extract from layout

lib/
  seo/metadata.ts                   # Phase 1 — fix defaults + keywords
  design-tokens.ts                  # Phase 1 — align sx tokens (optional re-export)
```

---

## Appendix A — Landing SEO Copy Blocks

### Trust strip

Approval gated · Human review · Australian built · Evidence backed · SOC ready · Privacy first

### Primary CTA

Request pilot access

### Secondary CTA

Explore the platform → `/features`

### Enterprise H2

Marketing governance built for teams that cannot afford mistakes

### Security H2

Your campaigns. Your approvals. Your audit trail.

---

## Appendix B — Commands for Verification

```bash
npm run type-check
npm run lint
npm test
npm run build:vercel
# Lighthouse (local)
npx lighthouse http://localhost:3008 --only-categories=performance,accessibility,seo,best-practices
```

---

_This spec is the implementation source of truth for the Premium OS redesign. Code changes should land phase-by-phase with verification gates between each phase._
