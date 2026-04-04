# FIX MANIFEST — Full-Stack Synthex Reconstruction
## Generated: 2026-03-17 | Phase 2 Triage

---

## CRITICAL — Blocks user flow / security hole

### C1 · `/api/auth/request-reset` may be missing
- **File**: `app/forgot-password/page.tsx:36`
- **Issue**: Forgot-password form POSTs to `/api/auth/request-reset`. Dev mode fakes success (line 51-52), masking missing endpoint. Password reset is broken in production.
- **Action**: Confirm endpoint exists. If not, create `app/api/auth/request-reset/route.ts` using Supabase `auth.resetPasswordForEmail()`.
- **Agent**: C1-forgot-password-fixer

### C2 · Reset password page dead end — no "Request new link" button
- **File**: `app/auth/reset-password/page.tsx:35-41`
- **Issue**: If token is expired/missing, user sees error with no recovery option. No "Back to Forgot Password" link.
- **Action**: Add "Request new reset link" button linking to `/forgot-password`.
- **Agent**: C1-forgot-password-fixer

### C3 · ESLint blocked by dep corruption
- **Issue**: `eslint-plugin-react` → `es-abstract` missing `helpers/isTrailingSurrogate`. `npm run lint` fails entirely.
- **Action**: Run `npm ci` or `npm install` to restore `node_modules`.
- **Agent**: Pre-fix (run immediately before Phase 6)

### C4 · Onboarding signup → verify email → onboarding dead end
- **File**: `app/(auth)/signup/page.tsx:310`, `middleware.ts:145-163`
- **Issue**: Users who see email verification screen then click "Continue to onboarding" may have no auth-token yet. Middleware checks JWT for `onboarding_complete` which may be absent.
- **Action**: Ensure `/onboarding` route allows unauthenticated users OR that signup sets JWT before redirecting.
- **Agent**: C3-onboarding-persistence-fixer

---

## HIGH — Damages trust or causes data loss

### H1 · 13+ fetch calls missing `credentials: 'include'`
- **Files**: `components/AIHashtagGenerator.tsx:66`, `components/AIABTesting.tsx:84,203,238,259`, `components/AIPersonaManager.tsx:53,136,162,181`, `components/ai-content-studio/index.tsx:44,78`, `components/PredictiveAnalytics.tsx:129-131`
- **Issue**: Missing credentials causes auth failures for cross-origin cookies in production.
- **Action**: Add `credentials: 'include'` to each raw fetch call OR convert to SWR.
- **Agent**: D4-api-connection-fixer

### H2 · Onboarding Step 2 save failure is silent
- **File**: `app/(onboarding)/onboarding/review/page.tsx:373-428`
- **Issue**: If `/api/onboarding/review` fails (org creation fails, etc.), user edits are lost silently. Page navigates forward with no toast/error.
- **Action**: Add error toast in catch block BEFORE navigating forward.
- **Agent**: C3-onboarding-persistence-fixer

### H3 · Detected platforms lost if sessionStorage cleared
- **File**: `app/(onboarding)/onboarding/connect/page.tsx:110-119`
- **Issue**: Detected platforms (from AI analysis) only in sessionStorage. After OAuth redirect in new tab, list disappears.
- **Action**: Also store detected platforms in OnboardingProgress server-side (add to `/api/onboarding/review` save).
- **Agent**: C3-onboarding-persistence-fixer

### H4 · WelcomeCard silently hides when `exists: false`
- **File**: `components/dashboard/WelcomeCard.tsx:116`
- **Issue**: Returns `null` if onboarding summary API returns `exists: false`. New users get blank space.
- **Action**: Show a fallback "Complete your setup" card if `!data.exists`.
- **Agent**: D1-dashboard-welcome-tour-fixer

### H5 · ProductTour hardcoded selectors, no DOM validation
- **File**: `components/ProductTour.tsx:31-79`
- **Issue**: Tour highlights CSS selectors like `[data-tour="dashboard"]`. If elements missing, tour silently misaligns.
- **Action**: Add existence check before starting tour. If target missing, skip step gracefully.
- **Agent**: D1-dashboard-welcome-tour-fixer

### H6 · OAuth callback 2-second race condition
- **File**: `app/auth/callback/page.tsx:61-68`
- **Issue**: Client-side callback has 2s timeout; under network latency, may redirect to `/login` before API callback sets cookies.
- **Action**: Increase timeout to 5s and add a loading spinner with "Completing sign-in..." message.
- **Agent**: C1-forgot-password-fixer (also in auth flow)

### H7 · 27 TypeScript errors
- **Files**: `app/api/templates/**`, `app/api/content/generate/route.ts`, `app/api/content/score/route.ts` — TS2344 context param types. 6 phantom onboarding routes in `.next_alt/types/`.
- **Action**: Fix `context?: { params?: ... }` → `context: { params: Promise<...> }` in affected route handlers. Remove or create phantom route files.
- **Agent**: Handled in Phase 6 TEST LOOP fix cycle

### H8 · `pricing-section.tsx` links to `/register` (wrong URL)
- **File**: `components/landing/pricing-section.tsx` (Starter/Pro plan CTAs)
- **Issue**: Links use `/register` but canonical signup is `/signup`.
- **Action**: Change `/register` → `/signup` in all CTAs.
- **Agent**: B3-pricing-page-reconstructor

### H9 · Pipeline timeout — no UI if pipeline hangs >25s
- **File**: `app/(onboarding)/onboarding/page.tsx`
- **Issue**: `/api/onboarding/pipeline` has `maxDuration=60` but page has no timeout. User sees "Analysing..." indefinitely.
- **Action**: Add 45s client-side timeout with "Taking longer than expected... try again" option.
- **Agent**: C4-onboarding-guidance-ux-fixer

---

## MEDIUM — UX friction

### M1 · 13 unused landing components not wired (complete list from A3)
- **HIGH PRIORITY components to wire**:
  - `PricingSection` → `app/pricing/page.tsx` (replace PricingGrid)
  - `OrbitIntegrations` → `app/page.tsx` (after HowItWorks) + `app/integrations/page.tsx` (hero)
  - `SocialIconButtons` → `app/(auth)/login/page.tsx` + `app/(auth)/signup/page.tsx`
- **MEDIUM PRIORITY**:
  - `TextRevealByWord` → hero heading in `app/page.tsx`
  - `InteractiveBentoGallery` → `app/page.tsx` (new "See It In Action" section)
  - `GlowCard` → `app/features/page.tsx` feature cards
  - `ProjectCards` → `app/about/page.tsx` team showcase
- **LOW PRIORITY**:
  - `BottomMenu` → dashboard mobile nav
  - `HandwrittenTitle` → `app/about/page.tsx` hero
- **Agents**: B1, B2, B3, B4, D3

### M2 · GamificationWidget + ContentSuggestionsWidget return null (no empty state)
- **Files**: `components/dashboard/GamificationWidget.tsx:74-75`, `components/dashboard/ContentSuggestionsWidget.tsx:44-45`
- **Action**: Replace `return null` with actionable empty state (icon + message + CTA link).
- **Agent**: D2-dashboard-empty-states-fixer

### M3 · Trend values hardcoded in OverviewTab (+12%, +5, +0.8%)
- **File**: `components/dashboard/tabs/overview-tab.tsx:21-45`
- **Action**: For new users, show "—" or "No data yet" instead of fake percentages.
- **Agent**: D3-dashboard-ux-polish-agent

### M4 · "Skip for now" button conditional — disappears after 1 connect
- **File**: `app/(onboarding)/onboarding/connect/page.tsx:391`
- **Action**: Remove `connectedCount === 0` condition. Rename to "I'll connect more later" when platforms are connected.
- **Agent**: C4-onboarding-guidance-ux-fixer

### M5 · 5 files using raw `fetch()` instead of SWR (CLAUDE.md violation)
- **Files**: `components/AIHashtagGenerator.tsx`, `components/AIABTesting.tsx`, `components/AIPersonaManager.tsx`, `components/PredictiveAnalytics.tsx`, `components/ai-content-studio/index.tsx`
- **Action**: Convert GET reads to SWR pattern with `credentials: 'include'` fetcher.
- **Agent**: D4-api-connection-fixer

### M6 · 2 Prisma routes missing Zod validation
- **Files**: `app/api/revenue/route.ts` POST, `app/api/sponsors/route.ts` POST
- **Action**: Add Zod schemas for body validation.
- **Agent**: D4-api-connection-fixer (during API fixes)

### M7 · `ContainerAnimated` / `ContainerStagger` not wired in features/about pages
- **Action**: Use for staggered card animations in `app/features/page.tsx` and `app/about/page.tsx`.
- **Agents**: B2-features-page-reconstructor, B4-about-page-reconstructor

### M8 · Auto-save missing on onboarding review page
- **File**: `app/(onboarding)/onboarding/review/page.tsx`
- **Action**: Add debounced auto-save (every 5s of inactivity) to `/api/onboarding/review`.
- **Agent**: C3-onboarding-persistence-fixer

---

## LOW — Polish

### L1 · 2 broken footer links: `/brand` and `/faqs`
- **File**: `components/landing/footer-section.tsx:32,43`
- **Action**: Change `/faqs` → `/pricing#faq` (FAQ is on pricing page). Change `/brand` → `/about`.
- **Agent**: B6-nav-footer-fixer

### L2 · Auth middleware lists both `/auth/login` AND `/login` as auth paths
- **File**: `middleware.ts:107`
- **Action**: Comment clarifying that `/auth/*` are legacy redirects. No functional change needed — already works.
- **Agent**: C2-auth-url-standardiser (documentation only)

### L3 · `synthex_onboarding_socials` sessionStorage key removed but never set
- **File**: `app/(onboarding)/onboarding/connect/page.tsx:221`
- **Action**: Remove orphaned cleanup line.
- **Agent**: C3-onboarding-persistence-fixer

### L4 · Auth pattern inconsistency — some routes use older `getUserIdFromRequestOrCookies`
- **Files**: `app/api/revenue/route.ts`, `app/api/sponsors/route.ts`, `app/api/analytics/route.ts`
- **Action**: Document in ADR. Defer migration to `APISecurityChecker` — not urgent.
- **Agent**: Deferred

### L5 · Chrome Extension ping has no timeout in onboarding Step 1
- **File**: `app/(onboarding)/onboarding/page.tsx:63-78`
- **Action**: Add 5s timeout, hide extension-related UI if no PONG received.
- **Agent**: C4-onboarding-guidance-ux-fixer

---

## KEY CORRECTIONS TO ORIGINAL PLAN

1. **Auth canonical URLs are `/login` not `/auth/login`**: The plan's C2 assumed wrong canonical. Actual canonical: `/login`, `/signup`, `/forgot-password`. The `/auth/*` paths are legacy redirects that work fine. C2's job is just to fix pricing-section's `/register` → `/signup` and document the URL structure.

2. **Most "missing" pages already exist**: A7 found all major pages exist (blog, careers, demo, changelog, support, docs). B5 agents should IMPROVE existing stubs, not create new pages.

3. **Marketing pages already use correct auth URLs**: Nav and footer already consistently use `/login` and `/signup`. No mass replacement needed.

4. **API security is strong**: 0 routes with missing auth. Focus is on UX/data consistency, not security holes.

5. **Canonical auth path clarification**: `app/(auth)/login/page.tsx` is the live page served at `/login`. `app/auth/login/page.tsx` is just a redirect component.

---

## EXECUTION ORDER FOR FIX BATCHES

### Batch A — Marketing + Landing (6 agents, parallel)
| Agent | Key work | Files touched |
|-------|----------|---------------|
| B1 | Wire OrbitIntegrations + TextRevealByWord + InteractiveBentoGallery to landing | app/page.tsx |
| B2 | Wire GlowCard + ContainerStagger + HandwrittenTitle to features page | app/features/page.tsx |
| B3 | Wire PricingSection to pricing page + fix /register→/signup | app/pricing/page.tsx, components/landing/pricing-section.tsx |
| B4 | Wire GlowCard + ProjectCards + ContainerStagger to about page | app/about/page.tsx |
| B5 | Improve existing stub pages (blog, careers, demo, changelog, support) | app/blog/, app/careers/, app/demo/, app/changelog/, app/support/ |
| B6 | Fix /brand→/about, /faqs→/pricing#faq, /register→/signup in footer | components/landing/footer-section.tsx, components/landing/nav-bar.tsx |

### Batch B — Auth + Onboarding (4 agents, parallel)
| Agent | Key work | Files touched |
|-------|----------|---------------|
| C1 | Confirm/create /api/auth/request-reset + fix reset-password UX | app/forgot-password/page.tsx, app/auth/reset-password/page.tsx, app/api/auth/ |
| C2 | Fix pricing-section /register→/signup + document URL structure + fix OAuth callback timeout | components/landing/pricing-section.tsx, middleware.ts, app/auth/callback/page.tsx |
| C3 | Fix Step 2 silent save failure + server-persist detected platforms + auto-save + orphaned key | app/(onboarding)/onboarding/review/page.tsx, connect/page.tsx, app/api/onboarding/ |
| C4 | Fix pipeline timeout UI + always-visible skip button + "I'll connect more later" rename | app/(onboarding)/onboarding/page.tsx, connect/page.tsx |

### Batch C — Dashboard + API (4 agents, parallel)
| Agent | Key work | Files touched |
|-------|----------|---------------|
| D1 | Fix WelcomeCard fallback + ProductTour DOM validation | components/dashboard/WelcomeCard.tsx, components/ProductTour.tsx |
| D2 | Add empty states to GamificationWidget + ContentSuggestionsWidget | components/dashboard/GamificationWidget.tsx, ContentSuggestionsWidget.tsx |
| D3 | Fix hardcoded trends in OverviewTab + wire BottomMenu as mobile nav | components/dashboard/tabs/overview-tab.tsx, app/dashboard/layout.tsx |
| D4 | Add credentials:include to 13 fetch calls + convert 5 to SWR + Zod for revenue/sponsors | components/AI*.tsx, components/ai-content-studio/, app/api/revenue/, app/api/sponsors/ |
