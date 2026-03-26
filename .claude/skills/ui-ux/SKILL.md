---
name: ui-ux
description: >-
  Synthex UX enforcer. NEVER produce generic bullet-list audit reports, recite
  WCAG rules without grounding them in Synthex's dark glassmorphic interface,
  or reference pnpm (this project uses npm). ALWAYS ground findings in
  Synthex's #0f172a dark background, Radix UI primitive semantics, and 4px
  spacing scale. Activate on ANY request to audit UX, review accessibility,
  optimise flows, check interactions, or validate usability.
metadata:
  author: synthex
  version: '2.0'
  engine: synthex-ai-agency
  type: capability-uplift-visual
  triggers:
    - ux audit
    - accessibility
    - user flow
    - interaction pattern
    - usability
    - interaction
    - flow
    - wcag
    - a11y
    - audit
    - review
  requires:
    - design
context: fork
---

# UI/UX Agent

## Purpose

Optimises SYNTHEX user experience by analysing user flows, ensuring WCAG 2.1 AA
accessibility compliance, validating interaction patterns, and conducting
systematic UX audits across the application.

## When to Use

Activate this skill when:

- Designing or reviewing user flows and navigation
- Auditing accessibility compliance (WCAG 2.1 AA)
- Optimising form UX, loading states, or error feedback
- Conducting usability testing or click path analysis
- Reviewing interaction patterns for consistency

## When NOT to Use This Skill

- When optimising API performance or response times (use api-testing)
- When designing database schema or data models (use database-prisma)
- When implementing visual design tokens or glassmorphic styles (use design)
- When doing server-side performance optimisation (no UX skill needed)
- Instead use: `design` for visual implementation, `api-testing` for backend perf

## Tech Stack

- **Framework**: Next.js 14+ App Router
- **Components**: React 18 with Server Components
- **Forms**: React Hook Form + Zod
- **State**: React hooks, Context API
- **Testing**: Playwright for E2E

## Instructions

1. **Define audit scope** — Identify pages, flows, or components to review
2. **Map user journey** — Document the current flow from entry to completion
3. **Identify friction points** — Note where users might get confused or stuck
4. **Test keyboard navigation** — Verify all interactive elements are reachable
5. **Validate ARIA labels** — Check screen reader support on dynamic content
6. **Check colour contrast** — Verify 4.5:1 ratio on all text elements
7. **Test touch targets** — Confirm 44x44px minimum on mobile
8. **Validate form UX** — Check inline validation, error messages, success states
9. **Test loading states** — Verify skeleton loaders, progress indicators exist
10. **Generate UX report** — Output findings with severity and recommendations

## Input Specification

| Parameter | Type   | Required | Description                                                |
| --------- | ------ | -------- | ---------------------------------------------------------- |
| target    | string | yes      | Page path, flow name, or component                         |
| scope     | string | no       | `accessibility`, `flow`, `forms`, `full` (default: `full`) |

## Output Specification

| Field          | Type                  | Description                             |
| -------------- | --------------------- | --------------------------------------- |
| element        | string                | Component or page element               |
| category       | string                | a11y/flow/form/feedback                 |
| severity       | critical/warning/info | Issue severity                          |
| issue          | string                | Description of the problem              |
| recommendation | string                | Suggested improvement                   |
| wcag_rule      | string                | WCAG criterion violated (if applicable) |

## Error Handling

| Error                      | Action                                      |
| -------------------------- | ------------------------------------------- |
| Inaccessible element found | Flag as critical with WCAG rule reference   |
| E2E test failure           | Capture screenshot, report failure context  |
| Touch target too small     | Report exact size vs required 44x44px       |
| Missing ARIA label         | Suggest appropriate label text              |
| Motion preference ignored  | Flag `prefers-reduced-motion` not respected |

## Accessibility Checklist

- [ ] Semantic HTML structure
- [ ] ARIA labels where needed
- [ ] Focus management
- [ ] Keyboard navigable
- [ ] Colour contrast (4.5:1 minimum)
- [ ] Touch targets (44x44px minimum)
- [ ] Motion preferences respected
- [ ] Screen reader tested

## Key UX Patterns

### Form UX

- Progressive disclosure
- Inline validation
- Clear error messages (Australian English)
- Success confirmation with toast

### Navigation UX

- Breadcrumb trails
- Active state indicators
- Predictable layouts
- Quick actions

### Feedback UX

- Toast notifications
- Progress indicators
- Skeleton loaders
- Optimistic updates

## User Personas

- **Marketing Manager**: Needs quick content scheduling
- **Content Creator**: Needs AI-assisted writing
- **Team Lead**: Needs analytics overview
- **Social Media Manager**: Needs multi-platform posting

## Key Directories

- `components/` — UI components
- `hooks/` — Custom React hooks
- `app/` — Page layouts
- `tests/playwright/` — E2E tests

## Commands

```bash
pnpm test:e2e                                      # Run E2E tests
npx lighthouse --only-categories=accessibility      # Accessibility audit
```

## Integration Points

- Works with **design** for visual implementation
- Coordinates with **api-testing** for response time UX
- Supports **client-retention** with satisfaction metrics

---

## Capability Uplift — Override Defaults

**NEVER** produce a generic bullet-list audit report with copy-pasted WCAG
criterion text, reference `pnpm test:e2e` (this project uses `npm run e2e`),
flag Next.js 14 or React 18 patterns as the standard (we run Next.js 15 /
React 19), or run contrast checks against a white background.

**INSTEAD** every audit is grounded in Synthex's actual interface: contrast
ratios are checked against #0f172a dark slate background (not white), ARIA
audit considers that Radix UI primitives already handle most semantics (flag
only when Radix patterns are bypassed), and focus rings are validated in dark
theme (the default ring-offset colour needs to be --color-bg, not white).

**REFERENCE** `.claude/skills/synthex-standards/references/aesthetic-standards.md`
