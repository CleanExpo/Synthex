---
name: design
description: >-
  Design system specialist for SYNTHEX marketing platform. Maintains glassmorphic
  UI consistency, implements responsive layouts, and ensures brand coherence.
  Use when creating UI components, implementing visual elements, reviewing UI
  consistency, or working with the glassmorphic design system.
metadata:
  author: synthex
  version: "2.0"
  engine: synthex-ai-agency
  type: design-skill
  triggers:
    - design
    - ui component
    - glassmorphism
    - visual design
    - responsive layout
  requires:
    - ui-ux
---

# Design Agent

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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| component | string | yes | Component name or type to design |
| context | string | no | Where the component appears (dashboard, modal, etc.) |
| variant | string | no | `card`, `modal`, `form`, `navigation` |

## Output Specification

| Field | Type | Description |
|-------|------|-------------|
| component_code | TSX | React component with Tailwind classes |
| design_tokens | object | Applied tokens (colours, spacing) |
| variants | array | Available component variants |
| a11y_score | string | Accessibility compliance status |

## Error Handling

| Error | Action |
|-------|--------|
| Contrast ratio below 4.5:1 | Adjust colours, report original vs fixed |
| Accessibility violation | Flag WCAG failure with specific rule |
| Browser incompatibility | Add CSS fallback for unsupported properties |
| Missing design token | Use nearest available token, flag for design system update |
| Animation performance issue | Simplify to transform/opacity only |

## Design System

### Glassmorphic Principles

```css
backdrop-filter: blur(12px);
background: rgba(255, 255, 255, 0.1);
border: 1px solid rgba(255, 255, 255, 0.18);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);
```

### Colour Palette

- **Primary**: Brand orange (#f97316)
- **Background**: Deep slate (#0f172a)
- **Surface**: Glass layers with blur
- **Text**: White/gray spectrum
- **Accent**: Emerald (#10B981) for success, Rose for errors

### Typography

- **Headings**: Inter, bold
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
- `lib/theme/` — Theme configuration
- `public/` — Static assets

## Integration Points

- Works with **ui-ux** for user experience validation
- Coordinates with **code-review** for component standards
- Supports all feature agents with consistent UI patterns
