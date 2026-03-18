# Design System Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Simple Mode (Gunmetal + Champagne Bronze) and Pro Mode (Gunmetal + Amber Gold) design tokens to the existing design system, wire a `ModeProvider` that gates on subscription plan, and surface the `PRO MODE` pill indicator.

**Architecture:** Extend the existing `lib/design-tokens.ts` with two new named exports (`simpleModeTokens`, `proModeTokens`). Add corresponding CSS custom property blocks to `app/globals.css` under `.mode-simple` and `.mode-pro` class selectors. Create a `ModeProvider` client component that reads the subscription plan via `useSubscription()`, applies the correct mode class to `<body>`, and exposes a `useMode()` hook. Create a `ProModePill` component that renders conditionally. Wire `ModeProvider` into `app/dashboard/layout.tsx`. This plan makes no visual changes to existing pages — it only adds the token infrastructure that Plan C (Simple Mode Surface) and future phases will reference.

**Tech Stack:** Next.js 15 App Router · Tailwind CSS · CSS Custom Properties · TypeScript 5 · `hooks/useSubscription.ts` · Jest

**Spec:** `docs/superpowers/specs/2026-03-18-v11-dual-surface-design.md` §3 (Simple Mode) + §4 (Pro Mode)

**Linear issue:** Create SYN-412 before starting — "feat(design): Design System Migration — Phase D v11.0"

**Runs in parallel with:** Plan A (Brand DNA Engine) — no shared files, no dependency.

---

## File Map

| Action | Path                                          | Responsibility                                                |
| ------ | --------------------------------------------- | ------------------------------------------------------------- |
| Modify | `lib/design-tokens.ts`                        | Add `simpleModeTokens` + `proModeTokens` named exports        |
| Modify | `app/globals.css`                             | Add `.mode-simple` and `.mode-pro` CSS custom property blocks |
| Create | `components/providers/mode-provider.tsx`      | Mode context — reads plan, applies class, exposes `useMode()` |
| Create | `components/ui/pro-mode-pill.tsx`             | "PRO MODE" amber pill indicator                               |
| Modify | `app/dashboard/layout.tsx`                    | Wrap content in `<ModeProvider>`                              |
| Create | `tests/unit/providers/mode-provider.test.tsx` | Unit tests for mode resolution logic                          |

---

## Task 1 — Extend `lib/design-tokens.ts` with v11 mode tokens

**Files:**

- Modify: `lib/design-tokens.ts`

- [ ] **Step 1: Write the failing test for token exports**

Create `tests/unit/design-tokens.test.ts`:

```typescript
import { simpleModeTokens, proModeTokens } from '@/lib/design-tokens';

describe('v11 mode tokens', () => {
  test('simpleModeTokens exports expected keys', () => {
    expect(simpleModeTokens).toMatchObject({
      background: '#202124',
      surface: '#2b2d31',
      accent: '#a8845c',
      accentSubtle: 'rgba(168,132,92,0.15)',
      accentBorder: 'rgba(168,132,92,0.35)',
      textPrimary: '#e8e0d4',
      textSecondary: 'rgba(232,224,212,0.4)',
    });
  });

  test('proModeTokens exports expected keys', () => {
    expect(proModeTokens).toMatchObject({
      background: '#1c1b1e',
      surface: '#252428',
      accent: '#f59e0b',
      accentSubtle: 'rgba(245,158,11,0.1)',
      accentBorder: 'rgba(245,158,11,0.2)',
      textPrimary: 'rgba(255,255,255,0.85)',
      textSecondary: 'rgba(255,255,255,0.35)',
      dataHighlight: '#f59e0b',
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest tests/unit/design-tokens.test.ts --no-coverage
```

Expected: FAIL — `simpleModeTokens` not exported from `lib/design-tokens`

- [ ] **Step 3: Add mode token exports to `lib/design-tokens.ts`**

Append at the bottom of `lib/design-tokens.ts` (before the existing `export default`):

```typescript
// ============================================================================
// V11 SURFACE MODE TOKENS
// Spec: docs/superpowers/specs/2026-03-18-v11-dual-surface-design.md §3–4
// ============================================================================

/**
 * Simple Mode — Gunmetal + Champagne Bronze
 * Target user: SMB owner (café, tradie, salon, gym). Starter plan.
 */
export const simpleModeTokens = {
  background: '#202124',
  surface: '#2b2d31',
  accent: '#a8845c',
  accentSubtle: 'rgba(168,132,92,0.15)',
  accentBorder: 'rgba(168,132,92,0.35)',
  textPrimary: '#e8e0d4',
  textSecondary: 'rgba(232,224,212,0.4)',
} as const;

/**
 * Pro Mode — Deep Gunmetal + Amber Gold
 * Target user: Agency, growth-stage, power user. Pro/Agency plan.
 */
export const proModeTokens = {
  background: '#1c1b1e',
  surface: '#252428',
  accent: '#f59e0b',
  accentSubtle: 'rgba(245,158,11,0.1)',
  accentBorder: 'rgba(245,158,11,0.2)',
  textPrimary: 'rgba(255,255,255,0.85)',
  textSecondary: 'rgba(255,255,255,0.35)',
  dataHighlight: '#f59e0b',
} as const;

export type SurfaceMode = 'simple' | 'pro';
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest tests/unit/design-tokens.test.ts --no-coverage
```

Expected: PASS — 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/design-tokens.ts tests/unit/design-tokens.test.ts
git commit -m "feat(design): add v11 Simple + Pro mode token exports — SYN-412"
```

---

## Task 2 — Add CSS custom property blocks to `app/globals.css`

**Files:**

- Modify: `app/globals.css`

The `.mode-simple` and `.mode-pro` classes override the `--mode-*` CSS custom properties that components will reference. Applied to `<body>` by `ModeProvider`.

- [ ] **Step 1: Locate the insertion point in `app/globals.css`**

Find the closing `}` of the `:root { ... }` block (around line 138). Insert immediately after it — but **remain inside** the enclosing `@layer base { }` block. The `:root` block is nested inside `@layer base`; the next sibling is `.dark { ... }`. Class selectors belong in `@layer base`, so the insertion point is between the `:root` closing `}` and the `.dark` block. Do not insert after the `@layer base` closing brace.

- [ ] **Step 2: Add mode CSS blocks**

Insert after the `:root { ... }` closing brace:

```css
/* =============================================================================
   V11 SURFACE MODE TOKENS
   Applied to <body> by ModeProvider — overrides --mode-* custom properties.
   Spec: docs/superpowers/specs/2026-03-18-v11-dual-surface-design.md §3-4
   ============================================================================= */

/* Simple Mode — Gunmetal + Champagne Bronze (Starter plan) */
.mode-simple {
  --mode-bg: #202124;
  --mode-surface: #2b2d31;
  --mode-accent: #a8845c;
  --mode-accent-subtle: rgba(168, 132, 92, 0.15);
  --mode-accent-border: rgba(168, 132, 92, 0.35);
  --mode-text-primary: #e8e0d4;
  --mode-text-secondary: rgba(232, 224, 212, 0.4);
}

/* Pro Mode — Deep Gunmetal + Amber Gold (Pro/Agency plan) */
.mode-pro {
  --mode-bg: #1c1b1e;
  --mode-surface: #252428;
  --mode-accent: #f59e0b;
  --mode-accent-subtle: rgba(245, 158, 11, 0.1);
  --mode-accent-border: rgba(245, 158, 11, 0.2);
  --mode-text-primary: rgba(255, 255, 255, 0.85);
  --mode-text-secondary: rgba(255, 255, 255, 0.35);
  --mode-data-highlight: #f59e0b;
}
```

- [ ] **Step 3: Verify the CSS/TS token values stay in sync**

Manually confirm that every property in the `.mode-pro` CSS block has a corresponding key in `proModeTokens` (and vice versa). The specific check: `--mode-data-highlight: #f59e0b` in CSS must match `dataHighlight: '#f59e0b'` in `proModeTokens`. There is no automated test for this sync — it is a manual gate.

- [ ] **Step 4: Verify no CSS parse errors**

```bash
npm run build 2>&1 | head -30
```

Expected: No CSS errors in output.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat(design): add .mode-simple and .mode-pro CSS token blocks — SYN-412"
```

---

## Task 3 — Create `ModeProvider`

**Files:**

- Create: `components/providers/mode-provider.tsx`
- Create: `tests/unit/providers/mode-provider.test.tsx`

The provider reads the subscription plan, maps it to a mode, applies a class to `<body>`, and exposes `useMode()`.

Plan → Mode mapping:

- `free` | `starter` → `'simple'`
- `pro` | `growth` | `scale` | `professional` | `business` | `custom` → `'pro'`
- loading → no class applied yet (avoids flash)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/providers/mode-provider.test.tsx`:

```typescript
import { renderHook } from '@testing-library/react';
import { ModeProvider, useMode } from '@/components/providers/mode-provider';
import * as subscriptionHook from '@/hooks/useSubscription';

jest.mock('@/hooks/useSubscription');

const mockUseSubscription = subscriptionHook.useSubscription as jest.MockedFunction<
  typeof subscriptionHook.useSubscription
>;

// `UseSubscriptionReturn` is not exported from the hook — construct the shape manually.
// refetch must be `() => Promise<void>` to satisfy the hook's return type.
const makeSubscription = (plan: string) =>
  ({
    subscription: {
      id: 'sub_1',
      plan: plan as 'free',
      status: 'active',
      limits: { socialAccounts: 1, aiPosts: 10, personas: 1, seoAudits: 0, seoPages: 0 },
      usage: { aiPosts: 0, seoAudits: 0, seoPages: 0 },
      cancelAtPeriodEnd: false,
    },
    isLoading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue(undefined) as () => Promise<void>,
    hasAccess: jest.fn().mockReturnValue(true) as (plan: never) => boolean,
  }) as ReturnType<typeof subscriptionHook.useSubscription>;

describe('useMode', () => {
  afterEach(() => {
    document.body.className = '';
  });

  test('returns "simple" for starter plan', () => {
    mockUseSubscription.mockReturnValue(makeSubscription('starter'));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModeProvider>{children}</ModeProvider>
    );
    const { result } = renderHook(() => useMode(), { wrapper });
    expect(result.current.mode).toBe('simple');
  });

  test('returns "simple" for free plan', () => {
    mockUseSubscription.mockReturnValue(makeSubscription('free'));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModeProvider>{children}</ModeProvider>
    );
    const { result } = renderHook(() => useMode(), { wrapper });
    expect(result.current.mode).toBe('simple');
  });

  test('returns "pro" for pro plan', () => {
    mockUseSubscription.mockReturnValue(makeSubscription('pro'));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModeProvider>{children}</ModeProvider>
    );
    const { result } = renderHook(() => useMode(), { wrapper });
    expect(result.current.mode).toBe('pro');
  });

  test('returns "pro" for business plan', () => {
    mockUseSubscription.mockReturnValue(makeSubscription('business'));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModeProvider>{children}</ModeProvider>
    );
    const { result } = renderHook(() => useMode(), { wrapper });
    expect(result.current.mode).toBe('pro');
  });

  test('isLoading true when subscription is loading', () => {
    mockUseSubscription.mockReturnValue({
      ...makeSubscription('pro'),
      subscription: null,
      isLoading: true,
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModeProvider>{children}</ModeProvider>
    );
    const { result } = renderHook(() => useMode(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest tests/unit/providers/mode-provider.test.tsx --no-coverage
```

Expected: FAIL — `ModeProvider` not found

- [ ] **Step 3: Create `components/providers/mode-provider.tsx`**

````typescript
'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import type { SurfaceMode } from '@/lib/design-tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModeContextValue {
  mode: SurfaceMode;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRO_PLANS = new Set(['pro', 'growth', 'scale', 'professional', 'business', 'custom']);

function resolveModeFromPlan(plan: string | undefined): SurfaceMode {
  if (!plan) return 'simple';
  return PRO_PLANS.has(plan) ? 'pro' : 'simple';
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ModeContext = createContext<ModeContextValue>({
  mode: 'simple',
  isLoading: true,
});

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current surface mode and loading state.
 *
 * ```tsx
 * const { mode, isLoading } = useMode();
 * ```
 */
export function useMode(): ModeContextValue {
  return useContext(ModeContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ModeProviderProps {
  children: ReactNode;
}

/**
 * Reads the subscription plan and applies the correct mode class to <body>.
 * Wrap around dashboard layout content only — not the root layout.
 */
export function ModeProvider({ children }: ModeProviderProps) {
  const { subscription, isLoading } = useSubscription();

  const mode = useMemo<SurfaceMode>(
    () => resolveModeFromPlan(subscription?.plan),
    [subscription?.plan]
  );

  // Apply mode class to <body> — removed on cleanup
  useEffect(() => {
    if (isLoading) return;
    const body = document.body;
    body.classList.remove('mode-simple', 'mode-pro');
    body.classList.add(`mode-${mode}`);
    return () => {
      body.classList.remove('mode-simple', 'mode-pro');
    };
  }, [mode, isLoading]);

  const value = useMemo<ModeContextValue>(
    () => ({ mode, isLoading }),
    [mode, isLoading]
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}
````

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest tests/unit/providers/mode-provider.test.tsx --no-coverage
```

Expected: PASS — 5 tests pass

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npm test -- --passWithNoTests 2>&1 | tail -5
```

Expected: 0 failures

- [ ] **Step 6: Commit**

```bash
git add components/providers/mode-provider.tsx tests/unit/providers/mode-provider.test.tsx
git commit -m "feat(design): add ModeProvider + useMode hook — SYN-412"
```

---

## Task 4 — Create `ProModePill`

**Files:**

- Create: `components/ui/pro-mode-pill.tsx`

Persistent amber pill shown in the dashboard header for Pro Mode users. Non-interactive — informational only. Renders `null` in Simple Mode.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ui/pro-mode-pill.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { ProModePill } from '@/components/ui/pro-mode-pill';
import * as modeHook from '@/components/providers/mode-provider';

jest.mock('@/components/providers/mode-provider');

const mockUseMode = modeHook.useMode as jest.MockedFunction<typeof modeHook.useMode>;

describe('ProModePill', () => {
  test('renders "PRO MODE" text in pro mode', () => {
    mockUseMode.mockReturnValue({ mode: 'pro', isLoading: false });
    render(<ProModePill />);
    expect(screen.getByText('PRO MODE')).toBeInTheDocument();
  });

  test('renders nothing in simple mode', () => {
    mockUseMode.mockReturnValue({ mode: 'simple', isLoading: false });
    const { container } = render(<ProModePill />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing while loading', () => {
    mockUseMode.mockReturnValue({ mode: 'simple', isLoading: true });
    const { container } = render(<ProModePill />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest tests/unit/ui/pro-mode-pill.test.tsx --no-coverage
```

Expected: FAIL — `ProModePill` not found

- [ ] **Step 3: Create `components/ui/pro-mode-pill.tsx`**

```typescript
'use client';

import { useMode } from '@/components/providers/mode-provider';

/**
 * Persistent mode indicator pill — top-right of dashboard header.
 * Shows "PRO MODE" in amber for Pro/Agency plan users.
 * Renders null in Simple Mode or while loading.
 * Non-interactive — informational only.
 */
export function ProModePill() {
  const { mode, isLoading } = useMode();

  if (isLoading || mode !== 'pro') return null;

  return (
    <span
      aria-label="Pro Mode active"
      className="inline-flex items-center rounded-full border border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.1)] px-2.5 py-0.5 text-[10px] font-semibold tracking-widest text-[#f59e0b] select-none"
    >
      PRO MODE
    </span>
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest tests/unit/ui/pro-mode-pill.test.tsx --no-coverage
```

Expected: PASS — 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add components/ui/pro-mode-pill.tsx tests/unit/ui/pro-mode-pill.test.tsx
git commit -m "feat(design): add ProModePill component — SYN-412"
```

---

## Task 5 — Wire `ModeProvider` into `app/dashboard/layout.tsx`

**Files:**

- Modify: `app/dashboard/layout.tsx`

`ModeProvider` wraps the dashboard layout's children so all dashboard pages have access to `useMode()` and the body mode class.

- [ ] **Step 1: Read the current dashboard layout**

Read `app/dashboard/layout.tsx` to find the return statement structure before editing.

- [ ] **Step 2: Add import**

At the top of `app/dashboard/layout.tsx`, add:

```typescript
import { ModeProvider } from '@/components/providers/mode-provider';
```

- [ ] **Step 3: Wrap layout children in `ModeProvider`**

Find the outermost JSX return in the layout and wrap it with `<ModeProvider>`:

```tsx
// Before:
return <div className="...">{/* existing layout JSX */}</div>;

// After:
return (
  <ModeProvider>
    <div className="...">{/* existing layout JSX */}</div>
  </ModeProvider>
);
```

> **Note:** No visual change is expected after this step. The existing layout uses hardcoded Tailwind colours (`bg-[#0a1628]`, `bg-[#080e1a]`, etc.) that override `--mode-bg`. The mode class is applied to `<body>` for future components to reference via `var(--mode-*)`. Plan C (Simple Mode Surface) introduces the new layout that actually uses these tokens.

- [ ] **Step 4: Run type-check to confirm no errors**

```bash
npm run type-check 2>&1 | tail -5
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/layout.tsx
git commit -m "feat(design): wire ModeProvider into dashboard layout — SYN-412"
```

---

## Task 6 — Final verification

- [ ] **Step 1: Run the full test suite**

```bash
npm test -- --passWithNoTests 2>&1 | tail -10
```

Expected: 0 failures

- [ ] **Step 2: Run type-check**

```bash
npm run type-check 2>&1 | tail -5
```

Expected: 0 errors

- [ ] **Step 3: Run lint**

```bash
npm run lint 2>&1 | tail -10
```

Expected: 0 errors

- [ ] **Step 4: Update Linear**

Open SYN-412 in Linear. Add comment:

```
Phase D complete.

Files changed:
- lib/design-tokens.ts — simpleModeTokens + proModeTokens + SurfaceMode type
- app/globals.css — .mode-simple + .mode-pro CSS blocks
- components/providers/mode-provider.tsx — ModeProvider + useMode hook
- components/ui/pro-mode-pill.tsx — PRO MODE amber pill indicator
- app/dashboard/layout.tsx — wrapped in ModeProvider

Tests added: design-tokens, mode-provider, pro-mode-pill
```

Set SYN-412 status to **Done**.

- [ ] **Step 5: Final commit if any uncommitted changes remain**

```bash
git status
```

If clean — no commit needed. If dirty — commit with `chore(design): final Phase D cleanup — SYN-412`.
