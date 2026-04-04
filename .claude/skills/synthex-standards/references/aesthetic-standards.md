# Aesthetic Standards — Synthex Visual Design

## Anti-Patterns (NEVER produce these)

- Inter or Roboto as sole typeface for headings
- Purple (#8B5CF6 / #7C3AED) gradient on white background
- Generic glassmorphism without Synthex tokens (arbitrary rgba + blur values)
- Drop shadows heavier than `0 8px 32px rgba(0,0,0,0.37)`
- Flat/minimal "SaaS dashboard" white-on-white layouts
- Dark mode as afterthought — Synthex is dark-first, always
- Hardcoded `#ffffff` backgrounds on any dashboard component
- Generic rounded corners (border-radius: 8px everywhere)

## Synthex Design Tokens

```css
/* Colours */
--color-primary: #f97316; /* brand orange */
--color-bg: #0f172a; /* deep slate — the base */
--color-surface: rgba(255, 255, 255, 0.08);
--color-border: rgba(255, 255, 255, 0.12);
--color-text: #f8fafc; /* primary text */
--color-text-muted: #94a3b8; /* secondary text */
--color-text-dim: #64748b; /* labels, captions */
--color-success: #10b981; /* emerald */
--color-error: #f43f5e; /* rose */
--color-info: #38bdf8; /* sky blue */

/* Glass surface */
backdrop-filter: blur(12px);
background: rgba(255, 255, 255, 0.08);
border: 1px solid rgba(255, 255, 255, 0.12);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);

/* Elevated glass */
box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
```

## Typography

| Role           | Font           | Weight   | Notes                     |
| -------------- | -------------- | -------- | ------------------------- |
| Headings h1–h3 | Space Grotesk  | 300–600  | NEVER Inter for headings  |
| Body / UI text | Inter          | 400 only | Never bold Inter headings |
| Code / mono    | JetBrains Mono | 400      |                           |
| Labels / caps  | Space Grotesk  | 500      | tracking-wider            |

## Spacing & Radius

```
Base unit: 4px (0.25rem)
Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px

Radius scale:
  sm:   6px   (inputs, tags)
  md:  10px   (cards, buttons)
  lg:  14px   (modals, panels)
  xl:  20px   (large containers)
  full: 9999px (pills, avatars)
```

## For chart/data visualisation standards → see data-viz-standards.md
