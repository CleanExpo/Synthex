# Plan 69-01 Summary — Public Landing Page

**Completed**: 2026-03-03
**Phase**: 69 — Public Landing Page
**Plan**: 69-01

---

## Objective

Ship a conversion-optimised public landing page at synthex.social root with proper SEO metadata, dynamic OG images, a free-tier pricing card, and a billing toggle.

---

## Task Outcomes

### Task 01: Convert landing page to server component and fix SEO metadata

**Files changed**: `app/page.tsx`

- Removed `'use client'` directive from `app/page.tsx` — child components in `components/landing/*` are already `'use client'` so Next.js automatically wraps them in client boundaries.
- Added `export const metadata: Metadata = PAGE_METADATA.home` using the pre-built config in `lib/seo/metadata.ts`.
- Also imported and wired `HowItWorks` and `Testimonials` sections (Task 04 content done at the same time — see note below).
- The `buildFaqSchemaJson()` call in the JSX body continues to work correctly as a plain function call in a server component (it returns a static JSON string — no hooks or browser APIs).

**Commit**: `5a49406e feat(69-01): convert landing page to server component with metadata export`

---

### Task 02: Generate OG image and add dynamic OG image API route

**Files changed**: `app/api/og/route.tsx` (new), `lib/seo/metadata.ts`

- Created `app/api/og/route.tsx` as an Edge runtime route using `next/og` (`ImageResponse`).
  - Accepts `?title=...` and `?description=...` query params.
  - Dark navy background (#0a1628) with cyan accent gradient and grid pattern overlay.
  - Renders "SYNTHEX" logo text, page title, description, and a `synthex.social` URL badge.
  - Returns 1200×630 PNG. Exports `export const runtime = 'edge'`.
- Updated `lib/seo/metadata.ts` `generateMetadata()` to use `/api/og?title=...` as the default OG image URL when no explicit `image` is provided. Pages that pass their own `image` continue to use it unchanged.

**Commit**: `cf6acfda feat(69-01): add dynamic OG image API route and update SEO metadata`

---

### Task 03: Add free-tier card and billing toggle to pricing page

**Files changed**: `app/pricing/page.tsx`, `components/pricing/pricing-grid.tsx` (new)

- `app/pricing/page.tsx` remains a server component. The interactive billing toggle and card grid were extracted into a new `'use client'` component `PricingGrid` in `components/pricing/pricing-grid.tsx`.
- **Starter free-tier card** added as the first card:
  - Name: "Starter", Price: "Free"
  - Description: "14-day trial — no credit card required"
  - Features: 2 social accounts, 10 AI posts/month, Basic analytics, 1 persona profile
  - CTA: "Start Free Trial" — plain `<Link href="/signup">` (not CheckoutButton)
- **Monthly/annual billing toggle** added above the pricing grid:
  - Defaults to monthly.
  - Annual prices: Professional $199/mo, Business $319/mo (both save 20%).
  - "Save 20%" badge appears on each affected card when annual is selected; a persistent "Save 20%" label also shown beside the "Annual" toggle label.
  - Starter and Custom cards unaffected by toggle.
- Grid updated from 3 columns to 4: `lg:grid-cols-4`.
- `PricingFAQSchema` JSON-LD and FAQ section preserved in the server component.

**Commit**: `45be475c feat(69-01): add free Starter tier and billing toggle to pricing page`

---

### Task 04: Add HowItWorks and Testimonials sections to landing page

**Note**: This task was executed concurrently with Task 01 — both modify `app/page.tsx`. To avoid redundant commits to the same file, the HowItWorks and Testimonials imports and JSX were included in the Task 01 commit.

**Section order in final `app/page.tsx`**:
1. NavBar
2. HeroSection
3. FeaturesSection
4. HowItWorks (NEW — between Features and Video)
5. VideoSection
6. StatsSection
7. Testimonials (NEW — between Stats and FAQ)
8. FAQSection
9. CTASection
10. FooterSection
11. LandingAnimations (utility, no DOM output)

Both `HowItWorks` and `Testimonials` are `'use client'` components with intersection observers and animation state — they continue to work correctly as client subtrees inside the server component.

---

## Deviations

1. **Task 04 merged into Task 01 commit** — Both tasks touch only `app/page.tsx`. Reading the plan before starting made it efficient to do all `app/page.tsx` changes in a single pass. The commit for Task 01 covers Task 04.
2. **Task 03 added `components/pricing/pricing-grid.tsx`** — The plan specified staging only `app/pricing/page.tsx`, but the billing toggle requires a new `'use client'` component. The new file was staged alongside the page file in the Task 03 commit.

---

## Commit Hashes

```
45be475c feat(69-01): add free Starter tier and billing toggle to pricing page
cf6acfda feat(69-01): add dynamic OG image API route and update SEO metadata
5a49406e feat(69-01): convert landing page to server component with metadata export
```

---

## Verification

- `npm run type-check` — passes (zero errors) after each task and at completion.
- No `'use client'` in `app/page.tsx`.
- `export const metadata` present in `app/page.tsx`.
- `app/api/og/route.tsx` exists with `export const runtime = 'edge'`.
- `lib/seo/metadata.ts` default OG URL uses `/api/og?title=...`.
- Pricing page has 4 cards: Starter, Professional, Business, Custom.
- Starter CTA links to `/signup` (not CheckoutButton).
- Billing toggle in `PricingGrid` switches between monthly and annual prices.
- `HowItWorks` wired after `FeaturesSection`, `Testimonials` wired after `StatsSection`.
