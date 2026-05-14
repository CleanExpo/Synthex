---
version: alpha
name: RestoreAssist
description: Visual identity for RestoreAssist — the Australian water-damage tradie's job-close system. Paired runtime config at ra.ts.
colors:
  primary: "#1C2E47"
  secondary: "#8A6B4E"
  accent: "#D4A574"
  neutral-50: "#F5F5F4"
  neutral-100: "#E7E5E4"
  neutral-500: "#78716C"
  neutral-900: "#050505"
  success: "#3FA34D"
  warning: "#E0A800"
  danger: "#C0392B"
  on-primary: "#F5F5F4"
  on-secondary: "#F5F5F4"
  on-accent: "#1C2E47"
  surface: "{colors.neutral-50}"
  on-surface: "{colors.neutral-900}"
  border: "{colors.neutral-100}"
  dark-primary: "#D4A574"
  dark-secondary: "#8A6B4E"
  dark-surface: "#050505"
  dark-on-surface: "#F5F5F4"
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
    textColor: "{colors.primary}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.md}"
    typography: "{typography.body-lg}"
  cta-secondary:
    backgroundColor: "{colors.primary}"
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
    textColor: "{colors.primary}"
    typography: "{typography.mono-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
---

## Overview

Navy authority + warm earth. Navy `#1C2E47` carries institutional weight — the colour of insurer letterhead and field-truck signage. Warm earth `#8A6B4E` and light tan `#D4A574` ground the brand in the physical materials a water-damage tradie works with (drywall, timber, hardwood). Typography is pure Inter — no serifs, no flourish — paired with JetBrains Mono for IICRC section citations and timestamps. Cadence is short and decisive; voice is Australian-direct, grounded, informed, human. The system reads more like a job-card on a site-truck dash than a marketing site.

Audience: Australian water-damage restoration tradies — sole traders and small companies running insurer-facing reporting (Allianz, IAG, QBE, Suncorp, RACQ). Earn trust by being the most informed voice in the room with no need to impress.

## Colors

The palette is rooted in navy authority backed by warm restorative earth tones.

- **Primary (#1C2E47):** Navy — institutional trust. Used for hero backgrounds, primary surfaces, structural type, and brand identification at distance.
- **Secondary (#8A6B4E):** Warm earth. Subordinate surfaces, secondary CTA fills, supporting type weight.
- **Accent (#D4A574):** Light tan — reserved for primary CTAs, action moments, and IICRC compliance call-outs. Never decorative.
- **Neutral 50 / 100 / 500 / 900:** Warm-tinted greys (stone family) for surfaces, borders, captions, and the dark backstop (`#050505`).
- **Semantic** — success / warning / danger reserved for system states only. Danger red is **never** used as a brand colour.

Dark variant: primary lifts to light tan (`#D4A574`) for legibility on the `#050505` dark backstop; neutrals invert (`50 ↔ 900`).

## Typography

The typography strategy uses **Inter** for the entire narrative and **JetBrains Mono** for technical data (IICRC section refs, timestamps, NIR identifiers, ABN, GST line items).

- **Display (xl/lg/md):** Inter ExtraBold (800) for headlines. Tight line-height (≤1.10), negative letter-spacing for optical density.
- **Body (lg/md):** Inter Regular (400) at relaxed line-height (1.5) for long-form readability.
- **Caption:** Inter Medium (500) at 13px for metadata and figure captions.
- **Mono:** JetBrains Mono Medium (500) — strictly for `S500:2025 §7.1`-style citations, timestamps, chain-of-custody hashes, and any value that must read as a literal token.

No italic for emphasis — use weight + colour. Headlines are tight, body is relaxed, mono is identifier-only.

## Layout

12-column grid, `outer-margin-landscape` (96px) at 1920×1080 / `outer-margin-portrait` (64px) at 1080×1920. Safe-area inset of 5% from each edge protects content from frame crop. Logo top-left, never centred. Maximum three colours per scene; light tan reserved for accent only.

Aspect ratios supported: 1920×1080, 1080×1920, 1080×1080. Display type scales 96 → 64 → 48px across landscape → square → portrait. Mono identifiers never wrap — clamp width or shrink scale.

## Elevation & Depth

Flat surfaces preferred over drop shadows. Use 1px borders + tonal shifts to express hierarchy. When elevation is required, use a single navy-tinted shadow:

```
0 4px 12px rgba(28, 46, 71, 0.10)
```

Active states invert background to navy; text to neutral-50. Focus rings use accent at 40% opacity outside the element bounds.

## Shapes

Rounded corners express softness in moderation: `sm` (4px) for chips and inputs, `DEFAULT` (8px) for buttons, `md` (12px) for cards, `lg` (16px) for hero panels. Full rounding (9999px) reserved for status pills and avatars.

## Components

- **cta-primary** — Light tan fill, navy text, 8px radius. The single highest-emphasis interactive element on any surface. Used at most once per scene.
- **cta-secondary** — Navy fill, neutral-50 text. Subordinate actions.
- **card** — Neutral-50 surface with 1px neutral-100 border, 12px radius. Default container for grouped content.
- **input** — Navy underline only (no full border). Focus ring lifts to accent.
- **mono-chip** — JetBrains Mono on neutral-100 fill. Reserved for IICRC section refs, timestamps, identifiers.

## Do's and Don'ts

**Do:**
- Lead with IICRC compliance and field evidence.
- Reserve light tan for action moments (CTAs, IICRC call-outs).
- Use mono for any code, identifier, citation, or timestamp.
- Maintain WCAG-AA contrast on every text-on-surface pair.

**Don't:**
- Never use red as a primary brand colour (reserved for `danger` only).
- Never abbreviate the company name to "RA" in voiceover or on-screen titles.
- Never name a competitor (DocuSketch, Encircle, Magicplan, Xactimate) — position by what RA does, not what they don't.
- Never use serif type or italic for emphasis.
- Never use "AI-powered" as standalone filler — name the specific lifecycle hook.
