---
version: alpha
name: RestoreAssist
description: Visual identity for RestoreAssist — the National Inspection Standard for Australian restoration. Paired runtime config at ra.ts.
colors:
  primary: "#E55A2B"
  secondary: "#2A3D45"
  accent: "#C5E063"
  neutral-50: "#F5F7F8"
  neutral-100: "#E4E9EC"
  neutral-500: "#6F7B82"
  neutral-900: "#0E1518"
  success: "#3FA34D"
  warning: "#E0A800"
  danger: "#C0392B"
  on-primary: "#FFFFFF"
  on-secondary: "#FFFFFF"
  on-accent: "#0E1518"
  surface: "{colors.neutral-50}"
  on-surface: "{colors.neutral-900}"
  border: "{colors.neutral-100}"
  dark-primary: "#16B5B3"
  dark-secondary: "#1A2428"
  dark-surface: "#0E1518"
  dark-on-surface: "#F5F7F8"
typography:
  display-xl:
    fontFamily: Inter
    fontSize: 96px
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: -0.02em
  display-lg:
    fontFamily: Inter
    fontSize: 64px
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: -0.02em
  display-md:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: -0.01em
  headline:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.2
  body-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.5
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
  mono-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.01em
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  outer-margin-landscape: 96px
  outer-margin-portrait: 64px
  safe-area: 5%
rounded:
  sm: 4px
  DEFAULT: 8px
  md: 12px
  lg: 16px
  full: 9999px
components:
  cta-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.md}"
    typography: "{typography.body-lg}"
  cta-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.neutral-50}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.md}"
  card:
    backgroundColor: "{colors.neutral-50}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  input:
    backgroundColor: "{colors.neutral-50}"
    textColor: "{colors.neutral-900}"
    rounded: "{rounded.sm}"
  mono-chip:
    backgroundColor: "{colors.neutral-100}"
    textColor: "{colors.secondary}"
    typography: "{typography.mono-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
---

## Overview

Restoration-clarity. Candy orange anchors the palette as the canonical RestoreAssist mark — recognisable at field-truck distance and unmistakable on a white background. Slate carries the structural weight; lime accent signals NIR moments of action. Typography is pure Inter — no serifs, no flourish — paired with JetBrains Mono for inspection codes and timestamps. Cadence is short and decisive; voice is direct, grounded, informed, human. The system reads more like a field-instrument readout than a marketing site.

Audience: people in crisis (water damage at 2am, mould diagnosis after months of illness, house fire). Earn trust by being the most informed voice in the room with no need to impress.

## Colors

The palette is rooted in a single decisive accent backed by industrial neutrals.

- **Primary (#E55A2B):** Candy orange dark — the canonical RestoreAssist mark. Used for hero backgrounds, primary surfaces, and brand identification at distance.
- **Secondary (#2A3D45):** Sophisticated slate. Structural weight for type, borders, secondary surfaces, and CTA fills.
- **Accent (#C5E063):** Lime — reserved exclusively for NIR call-outs and action moments. Never decorative.
- **Neutral 50 / 100 / 500 / 900:** Cool greys for surfaces, borders, captions, and inverted type.
- **Semantic** — success / warning / danger reserved for system states only. Danger red is **never** used as a brand colour.

Dark variant lifts primary to teal (#16B5B3) for legibility on dark surfaces; neutrals invert (50 ↔ 900).

## Typography

The typography strategy uses **Inter** for the entire narrative and **JetBrains Mono** for technical data.

- **Display (xl/lg/md):** Inter ExtraBold (800) for headlines. Tight line-height (≤1.10), negative letter-spacing for optical density.
- **Body (lg/md):** Inter Regular (400) at relaxed line-height (1.5) for long-form readability.
- **Caption:** Inter Medium (500) at 13px for metadata and figure captions.
- **Mono:** JetBrains Mono Medium (500) — strictly for inspection codes, timestamps, NIR identifiers, and any value that must read as a literal token.

No italic for emphasis — use weight + colour. Headlines are tight, body is relaxed, mono is identifier-only.

## Layout

12-column grid, `outer-margin-landscape` (96px) at 1920×1080 / `outer-margin-portrait` (64px) at 1080×1920. Safe-area inset of 5% from each edge protects content from frame crop. Logo top-left, never centred. Maximum three colours per scene; lime reserved for accent only.

Aspect ratios supported: 1920×1080, 1080×1920, 1080×1080. Display type scales 96 → 64 → 48px across landscape → square → portrait. Mono identifiers never wrap — clamp width or shrink scale.

## Elevation & Depth

Flat surfaces preferred over drop shadows. Use 1px borders + tonal shifts to express hierarchy. When elevation is required, use a single warm-tinted shadow:

```
0 4px 12px rgba(14, 21, 24, 0.08)
```

Active states invert background to slate; text to neutral-50. Focus rings use primary at 30% opacity outside the element bounds.

## Shapes

Rounded corners express softness in moderation: `sm` (4px) for chips and inputs, `DEFAULT` (8px) for buttons, `md` (12px) for cards, `lg` (16px) for hero panels. Full rounding (9999px) reserved for status pills and avatars.

## Components

- **cta-primary** — Lime fill, slate text, 8px radius. The single highest-emphasis interactive element on any surface. Used at most once per scene.
- **cta-secondary** — Slate fill, neutral-50 text. Subordinate actions.
- **card** — Neutral-50 surface with 1px neutral-100 border, 12px radius. Default container for grouped content.
- **input** — Slate underline only (no full border). Focus ring lifts to primary.
- **mono-chip** — JetBrains Mono on neutral-100 fill. Reserved for NIR codes, timestamps, identifiers.

## Do's and Don'ts

**Do:**
- Lead with NIR data and field evidence.
- Reserve lime for action moments (CTAs, NIR call-outs).
- Use mono for any code, identifier, or timestamp.
- Maintain WCAG-AA contrast on every text-on-surface pair.

**Don't:**
- Never use red as a primary brand colour (reserved for `danger` only).
- Never abbreviate the company name to "RA" in voiceover or on-screen titles.
- Never imply the NIR is optional or vendor-specific.
- Never use serif type or italic for emphasis.
