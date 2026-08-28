---
name: design
description: >-
  Synthex design system enforcer. NEVER use Inter as a heading font, purple
  (#8B5CF6) gradients on white, or generic glassmorphism without Synthex tokens.
  ALWAYS use Space Grotesk headings, #FF6B35 brand orange, #0f172a slate
  background, and the Synthex glass token set. Activate on ANY request involving
  UI, components, styling, layout, visual design, colour, typography, spacing,
  shadows, animations, or anything a user will see on screen.
metadata:
  author: synthex
  version: '2.0'
  engine: synthex-ai-agency
  type: capability-uplift-visual
  triggers:
    - design
    - ui component
    - glassmorphism
    - visual design
    - responsive layout
    - visual
    - colour
    - color
    - typography
    - layout
    - component
    - styling
    - interface
    - spacing
    - shadow
    - animation
    - responsive
  requires:
    - ui-ux
context: fork
---

# Design Agent

> **Scope boundary.** This skill governs **product UI** — `app/`,
> `components/`, `lib/` — under `.claude/DESIGN.md`. Marketing art-boards
> (Instagram posts, ads, OG images, campaign creative for a portfolio brand)
> are governed by the `synthex-design` skill, whose anti-slop list
> deliberately bans glassmorphism, Inter display type and gradients. Those
> bans are correct there and wrong here — never cite them in a product-UI
> review, and never apply this file's tokens to a client art-board.

## Purpose

Maintains SYNTHEX's glassmorphic design system consistency, implements responsive
layouts, and ensures brand coherence across all interfaces. Enforces design
tokens, typography, colour palette, and animation standards.

## When to Use

Activate this skill when:

- Creating new UI components with glassmorphic styling
- Implementing responsive grid layouts
- Reviewing visual consistency across pages
- Applying design tokens (colours, spacing, shadows)
- Building interactive form elements or modals

## When NOT to Use This Skill

- When building backend API logic (use api-testing or code-review)
- When working on database schema or queries (use database-prisma)
- When auditing user flows or accessibility compliance (use ui-ux)
- When optimising server-side performance (no design skill needed)
- Instead use: `ui-ux` for UX audits, `code-review` for non-visual code

## Tech Stack

- **Styling**: Tailwind CSS 3.x
- **UI Pattern**: Glassmorphic design system
- **Theme**: Dark/Light mode support
- **Icons**: AI-generated custom icons (NO Lucide)
- **Animations**: CSS transitions, Framer Motion

Any AI-generated visual asset — icons included — is produced ONLY via
`lib/services/ai/image-generation.ts` `generateImage()`/`generateBatch()` or the
`generate_image` MCP tool; direct provider calls (Gemini/OpenAI/Stability/fal) fail the
static guard test `tests/unit/ai/no-direct-image-apis.test.ts` in CI. Generation is
grounded-by-default on the owned reference library and BLOCKS when no owned references
exist; for non-photographic assets like UI icons, `useReferences: false` is the audited
escape hatch (results stamped UNGROUNDED). **Visual generation (binding):** see
`.claude/rules/real-images-only.md` + `grounded-visuals`. Direct provider calls fail CI.

## Instructions

1. **Review design brief** — Understand the component's purpose and context
2. **Select design tokens** — Apply correct colours, spacing, and typography
3. **Apply glassmorphic base** — Use backdrop-filter, rgba backgrounds, subtle borders
4. **Build responsive layout** — Mobile-first with Tailwind breakpoints
5. **Add interaction states** — Hover, focus, active, disabled with smooth transitions
6. **Validate colour contrast** — Ensure 4.5:1 minimum ratio (WCAG 2.1 AA)
7. **Test dark/light modes** — Verify both themes render correctly
8. **Add micro-animations** — Subtle transitions for hover, loading, and feedback
9. **Check cross-browser** — Verify backdrop-filter support and fallbacks
10. **Document component** — Note props, variants, and usage examples

## Input Specification

| Parameter | Type   | Required | Description                                          |
| --------- | ------ | -------- | ---------------------------------------------------- |
| component | string | yes      | Component name or type to design                     |
| context   | string | no       | Where the component appears (dashboard, modal, etc.) |
| variant   | string | no       | `card`, `modal`, `form`, `navigation`                |

## Output Specification

| Field          | Type   | Description                           |
| -------------- | ------ | ------------------------------------- |
| component_code | TSX    | React component with Tailwind classes |
| design_tokens  | object | Applied tokens (colours, spacing)     |
| variants       | array  | Available component variants          |
| a11y_score     | string | Accessibility compliance status       |

## Error Handling

| Error                       | Action                                                     |
| --------------------------- | ---------------------------------------------------------- |
| Contrast ratio below 4.5:1  | Adjust colours, report original vs fixed                   |
| Accessibility violation     | Flag WCAG failure with specific rule                       |
| Browser incompatibility     | Add CSS fallback for unsupported properties                |
| Missing design token        | Use nearest available token, flag for design system update |
| Animation performance issue | Simplify to transform/opacity only                         |

## Design System

### Glassmorphic Principles

```css
backdrop-filter: blur(12px);
background: rgba(255, 255, 255, 0.1);
border: 1px solid rgba(255, 255, 255, 0.18);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);
```

### Colour Palette

- **Primary**: Brand orange (#FF6B35)
- **Background**: Deep slate (#0f172a)
- **Surface**: Glass layers with blur
- **Text**: White/gray spectrum
- **Accent**: Emerald (#10B981) for success, Rose for errors

### Typography

- **Headings**: Space Grotesk, weight 300–600
- **Body**: Inter, regular
- **Code**: JetBrains Mono

### Design Tokens

```javascript
spacing: 4px base (0.25rem increments)
radius: { sm: 4px, md: 8px, lg: 12px, xl: 16px, full: 9999px }
shadow: {
  glass: '0 8px 32px rgba(0, 0, 0, 0.37)',
  elevated: '0 20px 40px rgba(0, 0, 0, 0.4)'
}
```

## Key Directories

- `components/ui/` — Base UI components
- `styles/` — Global stylesheets
- `tailwind.config.cjs` — Theme configuration (design tokens)
- `public/` — Static assets

## Integration Points

- Works with **ui-ux** for user experience validation
- Coordinates with **code-review** for component standards
- Supports all feature agents with consistent UI patterns

---

## Capability Uplift — Override Defaults

**NEVER** use Inter as a heading font (it is the #1 LLM typography default),
purple (#8B5CF6 / #7C3AED) gradients on white, generic glassmorphism without
Synthex tokens, flat white-on-white SaaS layouts, or treat dark mode as an
afterthought.

**INSTEAD** every component uses Space Grotesk for headings (weight 300–600),
#FF6B35 brand orange as the primary accent, #0f172a deep slate as the base
background, and the Synthex glass token set:

```css
background: rgba(255, 255, 255, 0.08);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.12);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);
```

**REFERENCE** `.claude/skills/synthex-standards/references/aesthetic-standards.md`

---

## Foundation & Gate Wiring (SYN-1050)

> Adopted from the senior-skill standard so every artefact this skill produces is checked against the locked foundation before it lands.

**Reads at every invocation (never cached — re-read each run):**

- `.claude/memory/ceo-foundation.md` — visual brand consistency, the design-token system, brand-specific visual taboos (Phase 3.X), universal taboos.
- `.claude/memory/verification-gates.md` — gate state for any claim referenced.

**Output gate:** every client-facing artefact this skill produces routes through `brand-voice-enforce` before the CEO batched-review queue. A REJECT blocks the artefact until the quoted offending string is fixed.

**Evidence standard:** every quantitative or factual claim carries exactly one tag — `[VERIFIED]` / `[INFERENCE]` / `[UNCONFIRMED]`. Untagged = defect (`.claude/rules/fabel-evidence-standard.md`). Never state a projected result as fact.

**Spec:** see `spec.md` in this skill directory.
