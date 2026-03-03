# UX Audit — Synthex (2026-03-03)

## Executive Summary

Synthex has two parallel onboarding funnels (`/onboarding/step-1…3` and `/onboarding/keys…socials`) with no clear canonical path, creating a fragmented and confusing first-run experience. The dashboard sidebar exposes 11 groups and 40+ navigation items on first load despite a progressive-disclosure guard that should restrict new users to 3 groups — a guard that relies on a `localStorage` flag defaulting to the wrong value on first visit. The pricing page is missing a free/trial tier entirely, placing a $249/mo entry point as the lowest option, which will suppress conversion from paid marketing channels.

---

## Critical Issues (Fix Immediately)

### 1. Two competing onboarding funnels exist simultaneously

- **Where**: `app/(onboarding)/onboarding/page.tsx` and `app/(onboarding)/onboarding/keys/page.tsx`
- **Problem**: The welcome page (`/onboarding`) sends users to `/onboarding/keys` (the V2 flow: keys → audit → goals → socials). But routes `/onboarding/step-1`, `/onboarding/step-2`, `/onboarding/step-3`, `/onboarding/complete` also exist and are fully functional. Steps 4–6 redirect to `/onboarding/complete`. The V1 flow (`step-1 → step-2 → step-3 → complete`) and V2 flow (`keys → audit → goals → socials`) save onboarding data to completely different API endpoints (`/api/onboarding` for V1 and `/api/onboarding/api-credentials` + `/api/onboarding/social-profiles` + `/api/onboarding/generate-plan` for V2). If a user arrives at `/onboarding/step-1` via a stale link, bookmark, or search engine index they enter V1, which has no API key step.
- **Impact**: High. Any user who lands outside the canonical entry point (`/onboarding`) enters an orphaned flow. V1 users never set up API keys and will hit dead-ends in the AI features immediately after onboarding. V2 users can skip API keys but the `keys` step is listed as "Step 1" in its own progress indicator while V1's progress indicator uses a completely different step count.
- **Fix**: Delete or 301-redirect all `/onboarding/step-*` routes. The V2 flow (keys → audit → goals → socials) is clearly newer and more complete. Remove `step-1` through `step-6` page files and the `complete` page that belongs to V1.

### 2. The pricing page has no free tier or visible trial entry point

- **Where**: `app/pricing/page.tsx` lines 12–81
- **Problem**: The three plans are Professional ($249/mo), Business ($399/mo), and Custom. The FAQ at line 94–99 states "all plans come with a 14-day free trial, no credit card required" but the CTA buttons say "Start Free Trial" and link to `CheckoutButton` — a Stripe checkout component. There is no free plan card visible in the grid. A visitor who can't afford $249/mo or wants to trial before committing has no obvious path.
- **Impact**: High. SaaS conversion best practice requires a clear free/trial entry point in the pricing grid itself. The stated value proposition ("no credit card required") is undermined by routing new users directly into a Stripe checkout flow.
- **Fix**: Add a "Starter / Free Trial" card at the left of the pricing grid that links to `/signup` directly (bypassing Stripe checkout). The card should surface the 14-day trial messaging that currently lives only in the FAQ.

### 3. Sidebar progressive disclosure defaults to showing ALL groups for users who have a `sidebar-show-all-groups` key already in localStorage from a different context

- **Where**: `app/dashboard/layout.tsx` lines 233–247
- **Problem**: `showAllGroups` initialises to `false` (correct), but on the first `useEffect`, it reads `localStorage.getItem('sidebar-show-all-groups')`. If any test session, demo account, or prior visit set this to `'true'`, all 11 sidebar groups (40+ items) are shown immediately to a brand-new user. There is also no reset when onboarding completes — the `handleGoToDashboard` function in `complete/page.tsx` (line 173–181) only sets `onboardingComplete` and `showTourOnDashboard` flags, not `sidebar-show-all-groups`.
- **Impact**: Medium-High. New users who trigger this state see the full sidebar — MAIN, BUSINESSES, CONTENT & AI (10 items), PLANNING, ANALYTICS, MONETIZATION, BUSINESS INTEL, SEO & RESEARCH, MEDIA, WEB PROJECTS, AI AGENTS, TEAM & ADMIN — with no context for what any of it means.
- **Fix**: On onboarding completion, explicitly `localStorage.removeItem('sidebar-show-all-groups')` to ensure new users always start with the starter groups only.

### 4. The API key step is the very first onboarding step — it will abandon most new users

- **Where**: `app/(onboarding)/onboarding/keys/page.tsx` lines 259–437
- **Problem**: The first thing a user encounters after signing up is a form asking for API keys from OpenRouter, Anthropic, OpenAI, and Google. This requires the user to: (1) know what an API key is, (2) already have accounts with those providers, (3) obtain a key, (4) paste it in and validate it. The step has a "Skip for now" link but it is styled as a very low-contrast text button (`text-sm text-gray-500`) while the primary CTA is disabled until at least one key is validated. Most new users will not have an OpenRouter key ready. The locked providers (Anthropic, OpenAI, Gemini) show for all users with a padlock icon — including free users who can never unlock them — which makes the form feel broken or paywalled.
- **Impact**: Critical. Asking for technical credentials as the first action post-signup is a well-documented conversion killer. Users who don't have an API key will stall here. The "Skip" affordance is visually buried.
- **Fix**: Move API key collection to after the business setup steps, or make it an optional step in Settings rather than a blocker. Elevate the "Skip for now" affordance to a visible outlined button. Do not show locked provider cards to free-tier users unless they click "Upgrade to unlock".

### 5. The billing page uses `min-h-screen` with a duplicate gradient that conflicts with the dashboard layout

- **Where**: `app/dashboard/billing/page.tsx` line 263
- **Problem**: The billing page sets its own `min-h-screen bg-gradient-to-br from-gray-900 via-cyan-900 to-gray-900` background. The dashboard layout (`app/dashboard/layout.tsx` line 283) already wraps the page in `bg-gray-950`. The billing page therefore renders with a teal gradient background that is inconsistent with every other dashboard page, which use the `bg-background` (dark navy) system variable.
- **Impact**: Low-medium. Visual inconsistency undermines trust on a page where users make financial decisions.
- **Fix**: Remove the outer `div` wrapper with the gradient class from `app/dashboard/billing/page.tsx` line 263 and replace with `<div className="max-w-4xl mx-auto">`.

---

## Login & Onboarding Flow

### Current State

A new user arriving at Synthex experiences the following:

1. **`/signup`** — Standard email/password or Google OAuth form. Four fields (name, email, password, confirm password) plus terms checkbox. Password strength meter is present.
2. **Email verification interstitial** — If `requiresVerification: true` from the API, the signup form replaces itself with a "Check your email" screen. A "Continue to onboarding" button allows skipping verification (comment at line 281–283 acknowledges this is a workaround: "email verification is not fully wired yet").
3. **`/onboarding`** — Welcome screen with a Sparkles icon, headline "Welcome to SYNTHEX", and a single "Get Started" button. Subtext reads "4 quick steps" but the progress indicator in the next step shows only 4 steps labelled "API Keys / Website Audit / Your Goals / Social Profiles".
4. **`/onboarding/keys`** (Step 1 of 4) — API key collection. Shows 4 provider cards. On the free plan, 3 of 4 are locked. Minimum one valid key required to proceed (but skip link exists).
5. **`/onboarding/audit`** (Step 2 of 4) — Website SEO audit. Fully optional. Runs a 20-second analysis via external APIs (Cheerio + Google PageSpeed). Can skip.
6. **`/onboarding/goals`** (Step 3 of 4) — Six visual card questions + AI-generated 90-day marketing plan. All 6 questions must be answered before the "Generate My Plan" button is enabled. The "Continue" button is disabled until a plan is generated. "Skip for now" link exists.
7. **`/onboarding/socials`** (Step 4 of 4) — 9 social profile URL inputs + posting mode selection. Fully optional. "Finish Setup" completes onboarding by calling `/api/onboarding` to create the Organisation record.
8. **`/dashboard`** — Dashboard loads with QuickStats (all zeros for new users), GetStartedChecklist (3 steps: connect account, schedule post, generate AI post), OverviewTab, InsightsWidget, GamificationWidget (renders nothing if no streak), ContentSuggestionsWidget (renders nothing if no recommendations).

### Issues Found

**Onboarding step count mismatch** (`app/(onboarding)/onboarding/page.tsx` line 44):
The welcome page text says "4 quick steps" (correct for V2 flow), but there is no indication that step 1 involves API keys — an unexpected technical requirement. Users who read "4 quick steps" and expect business-setup questions will be confused when the first screen asks for an API key.

**Goals page: "Continue" button disabled until AI plan is generated** (`app/(onboarding)/onboarding/goals/page.tsx` line 549–554):
```tsx
<Button
  onClick={() => router.push('/onboarding/socials')}
  disabled={!plan}  // ← Must generate plan before continuing
```
A user who answers all 6 questions but whose plan generation fails (API error, no API key) is blocked. The error state at line 500–505 shows a red box with the error message, but the "Continue" button remains disabled. Only "Skip for now" (low-contrast text link) is usable.

**Socials page derives org name from domain name, not user input** (`app/(onboarding)/onboarding/socials/page.tsx` lines 420–425):
```tsx
const hostname = new URL(audit.url).hostname.replace(/^www\./, '');
const domain = hostname.split('.')[0] ?? 'mybusiness';
orgName = domain.charAt(0).toUpperCase() + domain.slice(1);
```
If the user skipped the audit step (no URL entered), `orgName` defaults to `'My Business'`. Users who entered a business name in `/onboarding/step-1` (if they used the V1 flow) do not have that name carried forward into V2. Users who skipped the audit in V2 will find their organisation named "My Business".

**Verification email interstitial has no resend link** (`app/(auth)/signup/page.tsx` lines 237–310):
The "Check your email" screen shown after signup tells users to check spam but provides no "Resend email" button. The only option is "Continue to onboarding" or "Go back" to re-enter their email.

**"Confirm Password" field shows `Lock` icon when match is valid, then CheckCircle icon** (`app/(auth)/signup/page.tsx` lines 467–478):
When the password fields match, a `CheckCircle` replaces the show/hide button. This removes the ability to show/hide the confirmation password once matched, which is a minor but real friction point if the user wants to verify what they typed.

**Onboarding layout uses `Math.random()` for particle positions in SSR layout** (`app/(onboarding)/layout.tsx` lines 18–30):
The `OnboardingParticles` component uses `Math.random()` inside a server component render loop. This will produce hydration mismatches between server and client because random values differ across renders.

### Recommended Flow

```
/signup → email/password or Google OAuth
         ↓ (on success)
/onboarding → Welcome ("2 minutes to set up your workspace")
         ↓
Step 1: Business Details (name, industry, team size — already exists in V1 and is better UX than API keys)
         ↓
Step 2: Connect platforms (social OAuth — publish permissions, not just profile URLs)
         ↓
Step 3: Brand persona / tone of voice (optional, skippable)
         ↓
Step 4: API keys (optional, skippable — defer to Settings for technical users)
         ↓
/dashboard → with "Get Started" checklist surfacing "Add API key" as a high-priority incomplete item
```

---

## Dashboard UX

### Issues Found

**QuickStats shows all-zero metrics for new users with no contextual message** (`components/dashboard/quick-stats.tsx` lines 29–43):
A new user sees "Total Posts: 0 / Engagement: 0% / Followers: 0 / Scheduled: 0". Zero metrics with no explanation or call-to-action feel like an empty broken state. The `GetStartedChecklist` does appear below this but only when `isNewUser` is true (all three metrics are zero) — if a user somehow has any posts (e.g. demo data), the checklist disappears even though they haven't connected a social account.

**Duplicate "Profile" and "Settings" in user dropdown menu both link to the same route** (`app/dashboard/layout.tsx` lines 433–444):
```tsx
<Link href="/dashboard/settings">Profile</Link>
<Link href="/dashboard/settings">Settings</Link>
```
Both "Profile" and "Settings" dropdown items navigate to `/dashboard/settings`. This is wasted space and confusing — users expect "Profile" to go to their profile page and "Settings" to go to general settings.

**Sidebar collapsed mode shows only group icons with no active-item highlight** (`app/dashboard/layout.tsx` lines 323–331):
When the sidebar is collapsed, each group is represented by its icon in a `div` with `title={group.label}` for tooltip. But individual items within the group are not accessible at all — the user must expand the sidebar to navigate to any item. There is no collapsed-mode affordance for the active page.

**"Show More" button count is miscalculated** (`app/dashboard/layout.tsx` lines 354–362):
```tsx
`Show More (${dynamicSidebarGroups.length - dynamicSidebarGroups.filter((g) => STARTER_GROUP_IDS.has(g.id)).length} more)`
```
For multi-business owners, `dynamicSidebarGroups` includes the injected BUSINESSES group. `STARTER_GROUP_IDS` does not include `'businesses'`, so the count is off by one. Multi-business owners see "Show More (9 more)" when there are actually 8 additional groups (excluding BUSINESSES which is already visible).

**Dashboard page has a `DashboardHeader` component that renders a second notification toggle alongside the top-bar `NotificationBell`** (`app/dashboard/page.tsx` line 226):
The `DashboardHeader` component at line 226 receives a `showNotifications` prop and `onToggleNotifications` handler, implying it renders its own notification UI. The layout's top bar already renders `<NotificationBell />` (line 411). This duplicates notification controls with no clear distinction.

**ContentSuggestionsWidget and GamificationWidget silently render nothing for new users** (`components/dashboard/ContentSuggestionsWidget.tsx` line 45; `components/dashboard/GamificationWidget.tsx` line 75):
Both widgets have `if (!isLoading && [no data]) return null`. For new users with no streak and no recommendations, the bottom half of the dashboard is completely empty — two invisible holes in the layout. The `grid grid-cols-1 lg:grid-cols-2 gap-4` wrapper in `dashboard/page.tsx` line 254 is still rendered, causing unexpected spacing.

**The search bar in the top nav is non-functional** (`app/dashboard/layout.tsx` lines 396–403):
The search input has no `onChange`, no `onSubmit`, and no associated handler. It is a decorative element presenting a false affordance. Users who type in it get no results and no feedback.

---

## Key Conversion Flows

### Pricing → Trial

**No free plan visible on pricing page** (`app/pricing/page.tsx` lines 12–81):
The lowest visible plan is $249/month. The 14-day trial messaging is present in the FAQ and the CTA section, but no free tier card exists. Benchmark: most marketing SaaS tools (Buffer, Hootsuite, Mailchimp) show a free tier as the leftmost card to anchor the value and reduce signup friction.

**CheckoutButton goes directly to Stripe checkout** (`app/pricing/page.tsx` line 194):
Users clicking "Start Free Trial" on either the Professional or Business card are routed through a Stripe checkout flow. The FAQ promises "no credit card required" but Stripe checkout typically requires payment details. This is a broken promise that will increase drop-off at checkout.

**Monthly/annual toggle is absent** (`app/pricing/page.tsx` lines 124–265):
There is no billing frequency toggle. Offering annual pricing (e.g. "save 20%") with a toggle is a proven conversion lever — it is missing entirely.

### Dashboard → First Value

**"Get Started" checklist step ordering is wrong** (`components/dashboard/get-started-checklist.tsx` lines 92–119):
The three steps are: (1) Connect social account, (2) Schedule a post, (3) Generate AI post. Step 2 (scheduling) logically depends on step 3 (having content to schedule), yet step 3 comes last. The sequence should be: Generate content → Connect account → Schedule.

**New users with data (e.g. demo seeded accounts) skip the GetStartedChecklist entirely** (`app/dashboard/page.tsx` lines 207–212):
```tsx
const isNewUser = stats !== null
  && stats.totalPosts === 0
  && stats.followers === 0
  && stats.scheduledPosts === 0;
```
If the database has any seed data for a new user, `isNewUser` is false and the checklist never appears. The checklist should check actual onboarding completion status (from the auth token or a user flag) rather than inferring it from metric values.

---

## Form UX, Empty States, Error Messages

**Signup form: "confirmPassword" field loses show/hide toggle on match** (`app/(auth)/signup/page.tsx` lines 467–478):
When passwords match, the toggle button is replaced with a `CheckCircle` icon. There is no way to show/hide the confirm password field after it matches. Edge case but real friction.

**Login page: "Remember me" checkbox is not wired to any state** (`app/(auth)/login/page.tsx` lines 348–351):
```tsx
<input type="checkbox" className="..." />
<span>Remember me</span>
```
There is no `onChange`, no state variable, no effect. The checkbox is decorative and does nothing. This is a false affordance that undermines trust.

**Rate-limit error message is redundant** (`app/(auth)/login/page.tsx` lines 150–151 and 282–300):
When a rate limit is hit, a `toast.error()` fires and the red countdown banner is shown. The toast says "Too many login attempts. Please wait X minutes" and the banner also says "Too many attempts / Please wait [countdown]". The same information is communicated twice in two different UI components simultaneously.

**Billing page error state has inconsistent background** (`app/dashboard/billing/page.tsx` lines 240–259):
The error state wrapper uses `min-h-screen bg-gradient-to-br from-gray-900 via-cyan-900 to-gray-900` — the same gradient as the success state. This means error and success states have the same visual weight. Error states should use a subtle red-tinted or neutral background.

**Onboarding audit "Continue" button disabled until audit completes** (`app/(onboarding)/onboarding/audit/page.tsx` line 470):
```tsx
disabled={!result}
```
Users who skip typing a URL and want to proceed cannot click "Continue" — only "Skip for now" is available. The button label and disabled state create confusion about whether skipping or continuing are the same action. Both should be labelled consistently.

**Goals page: error message is a centred red box with no action** (`app/(onboarding)/onboarding/goals/page.tsx` lines 501–505):
If plan generation fails, the error is shown in a small red text box above the (still disabled) "Generate My Plan" button. There is no "Try Again" button distinct from clicking the main CTA. The user must figure out that they need to click the still-labelled "Generate My Plan" button again.

---

## Visual Hierarchy and Information Density

**Onboarding particles use Math.random() with no SSR guard**, producing hydration errors in React strict mode (`app/(onboarding)/layout.tsx` lines 15–31). The random styles are computed inline with `style={{ left: ... }}` — React 18 will warn about these mismatches in development and may produce flicker in production.

**The dashboard main content area padding differs from the billing page** (`app/dashboard/layout.tsx` line 479: `p-3 sm:p-4 md:p-6`; `app/dashboard/billing/page.tsx` line 263: `p-8`). The billing page will appear more generously padded than all other dashboard pages, creating layout inconsistency.

**QuickStats card title is "Quick Stats" with no time range** (`components/dashboard/quick-stats.tsx` line 23):
There is no indication of whether these numbers are all-time, last 30 days, or real-time. "Total Posts" implies all-time, "Engagement: 0%" implies a calculated rate (over what period?), and "Scheduled" implies upcoming. The absence of a time reference makes the numbers harder to interpret.

**Step progress indicator in onboarding V2 is duplicated across 4 files** (`app/(onboarding)/onboarding/keys/page.tsx` lines 109–152; `audit/page.tsx` lines 44–83; `goals/page.tsx` lines 39–78; `socials/page.tsx` lines 41–80):
The `StepProgress` component is copy-pasted with identical code into all four onboarding step files. A change to the step names or styling must be made in four places. This is a DRY violation that will cause drift over time.

---

## Quick Wins (Under 30 minutes each)

1. **Fix the "Remember me" checkbox** (`app/(auth)/login/page.tsx` line 348–351): Add `checked` state and wire `onChange`. Even if the backend doesn't yet support persistent sessions, wiring it prevents the false affordance. Effort: 15 min.

2. **Fix duplicate user menu links** (`app/dashboard/layout.tsx` lines 433–444): Change the "Profile" link to `/dashboard/settings/profile` (or the correct profile route). Effort: 5 min.

3. **Remove billing page's own gradient wrapper** (`app/dashboard/billing/page.tsx` line 263): Change `min-h-screen bg-gradient-to-br from-gray-900 via-cyan-900 to-gray-900 p-8` to `space-y-6`. Effort: 5 min.

4. **Dedup the rate-limit UI**: Remove the `toast.error()` call for rate-limit responses in login (line 150) since the inline red banner provides the same information. Effort: 5 min.

5. **Reset `sidebar-show-all-groups` on onboarding complete** (`app/(onboarding)/onboarding/complete/page.tsx` lines 173–181): Add `localStorage.removeItem('sidebar-show-all-groups')` inside `handleGoToDashboard`. Effort: 5 min.

6. **Fix the sidebar "Show More" count for multi-business owners** (`app/dashboard/layout.tsx` lines 354–362): Filter out the BUSINESSES group from the count calculation since it is always visible. Effort: 10 min.

7. **Add `aria-label` to the search input** (`app/dashboard/layout.tsx` line 399): Missing accessibility label on the search bar. Add `aria-label="Search"`. Effort: 2 min.

8. **Fix `Math.random()` in `OnboardingParticles`** (`app/(onboarding)/layout.tsx` lines 18–30): Wrap the component in a `useEffect` with `useState` to generate positions client-side only, preventing hydration mismatch. Effort: 20 min.

9. **Add "Resend verification email" button** (`app/(auth)/signup/page.tsx` lines 280–293): The email verification interstitial has no resend action. Add a button that calls the resend API endpoint. Effort: 25 min.

10. **Surface the `StepProgress` component into a shared file**: Extract the copy-pasted `StepProgress` from the 4 V2 onboarding steps into `components/onboarding/StepProgress.tsx` and import it. Effort: 20 min.

---

## Medium Improvements (1–3 hours each)

### 1. Reorder onboarding steps: put API keys last or skip entirely

**File**: `app/(onboarding)/onboarding/page.tsx` (entry redirect target)
Move the keys step to after business setup or make it an in-app prompt once the user first tries to use an AI feature. The current ordering (API keys first) is the single most likely drop-off point. A user who came from a marketing landing page, saw "set up in 2 minutes", and is then asked for an OpenRouter API key in the first 30 seconds will abandon.

### 2. Enable the Continue button on Goals page regardless of plan generation status

**File**: `app/(onboarding)/onboarding/goals/page.tsx` line 549
Remove `disabled={!plan}` from the Continue button. Allow progression if all 6 questions are answered, regardless of whether the AI plan was generated. Move plan generation to a background process or offer it later. This unblocks users whose plan generation fails due to API key issues.

### 3. Make the QuickStats empty state meaningful

**File**: `components/dashboard/quick-stats.tsx`
When all stats are zero, replace numeric values with a "Connect your first platform to see stats" call-to-action that links to `/dashboard/platforms`. The all-zero state is currently indistinguishable from a data fetch failure.

### 4. Add a Starter / Free Trial card to the pricing page

**File**: `app/pricing/page.tsx` lines 12–81
Add a fourth plan object:
```ts
{
  name: 'Starter',
  price: 'Free',
  description: '14-day trial — no credit card required',
  features: [
    '2 social accounts',
    '10 AI posts/month',
    'Basic analytics',
    '1 persona profile',
  ],
  cta: { label: 'Start Free Trial', href: '/signup' }
}
```
This is a sign-up link, not a Stripe checkout. Render it at the left of the grid.

### 5. Make the dashboard search bar functional

**File**: `app/dashboard/layout.tsx` lines 396–403
The search bar is a false affordance. Either implement basic client-side navigation search (search the sidebar items by label, navigate on selection) or remove it entirely. A non-functional search bar is worse than no search bar because it creates user frustration.

### 6. Consolidate and remove the V1 onboarding flow

**Files**:
- `app/(onboarding)/onboarding/step-1/page.tsx`
- `app/(onboarding)/onboarding/step-2/page.tsx`
- `app/(onboarding)/onboarding/step-3/page.tsx`
- `app/(onboarding)/onboarding/step-4/page.tsx` (already a redirect)
- `app/(onboarding)/onboarding/step-5/page.tsx`
- `app/(onboarding)/onboarding/step-6/page.tsx`
- `app/(onboarding)/onboarding/complete/page.tsx`

Archive these files (per project convention, move to `.claude/archived/2026-03-03/`) and add 301 redirects in `next.config.js` from `/onboarding/step-*` and `/onboarding/complete` to `/onboarding`.

### 7. Fix the billing page background and padding inconsistency

**File**: `app/dashboard/billing/page.tsx` lines 263, 226–238, 240–259
Remove the `min-h-screen bg-gradient-to-br` wrappers from all three rendering branches (loading, error, success). The dashboard layout handles the page background. Add consistent `space-y-6` container instead.

---

## Strategic Recommendations

### A. Choose one onboarding path and commit

The existence of two parallel funnels (V1 step-1/2/3 and V2 keys/audit/goals/socials) indicates that the V2 flow was built alongside the V1 without cleaning up the old routes. This creates maintenance debt and UX fragmentation. Phase 69 should make V2 canonical and archive V1.

### B. Rethink the BYOK (Bring Your Own Key) model for new users

Requiring API keys in onboarding assumes users are technical. Most social media managers are not. Consider offering a "Synthex-managed" option where the platform uses its own API key credits for new users (with a monthly cap on the free plan), and BYOK is an advanced/cost-saving option for power users. This would remove the API key step from onboarding entirely for most users.

### C. Establish a proper "first value moment" target

Currently, the path from signup to first AI-generated post is: signup → email verify → onboarding (4 steps, at least one blocked by API key) → dashboard → connect platform → navigate to content → generate. That is 8+ actions before seeing any value. Industry benchmark for SaaS is 3 actions to first value. Target: signup → onboarding (business name + website) → AI-generated sample post → dashboard. The audit and goals questionnaire, while valuable, should be deferred to after the user has seen value.

### D. Add a billing frequency toggle to the pricing page

Monthly vs annual pricing with an annual discount (e.g. "Save 20% — billed annually") is a standard conversion lever. The absence of this toggle means all users are defaulted to monthly billing. Annual billing increases LTV and reduces churn. The toggle is a well-understood UI pattern that requires minimal development.

### E. Introduce contextual upgrade prompts within the app

The billing page has a generic "Upgrade" prompt but individual features that are plan-gated (e.g. AI insights at `app/dashboard/insights`, SEO audit) should show inline upgrade prompts at the point of friction. This is more effective than a centralised billing page.

### F. Fix the collapsed sidebar for power users

The collapsed sidebar mode (`w-16`) shows only group icons with no tooltip on hover for individual items and no active-state highlighting. Power users who collapse the sidebar to gain horizontal space have no way to see which page they are on or navigate to sub-items without expanding. Implement a popout sub-menu on group icon hover when the sidebar is collapsed (standard pattern in tools like Linear, Notion, GitHub).

---

## Priority Order

1. **Consolidate to one onboarding funnel** (Critical — broken flow for stale-link users, maintenance debt)
2. **Move API keys out of step 1** (Critical — highest drop-off point in onboarding)
3. **Add Starter / Free tier to pricing page** (Critical — conversion from paid marketing)
4. **Fix the Continue button on goals page** (High — blocks users when plan generation fails)
5. **Make QuickStats empty state meaningful** (High — first dashboard impression for all new users)
6. **Fix the non-functional search bar** (High — false affordance erodes trust)
7. **Fix duplicate user dropdown links** (Medium — quick win, trust issue)
8. **Fix billing page background inconsistency** (Medium — quick win)
9. **Fix `Math.random()` in onboarding particles** (Medium — hydration errors in production logs)
10. **Fix "Remember me" checkbox** (Medium — false affordance)
11. **Add resend verification email** (Medium — impacts users with delivery issues)
12. **Dedup `StepProgress` component** (Low — developer experience, future maintenance)
13. **Add pricing page billing toggle** (Low — revenue optimisation, not blocking)
14. **Implement collapsed sidebar sub-menus** (Low — power user experience)
