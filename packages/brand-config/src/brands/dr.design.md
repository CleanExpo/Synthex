---
version: alpha
name: Disaster Recovery
description: Visual identity for Disaster Recovery — ready answers when the worst happens. Paired runtime config at dr.ts.
colors:
  primary: "#0B2545"
  secondary: "#13315C"
  accent: "#FF8A00"
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
  display-md:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: 800
    lineHeight: 1.1
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
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  outer-margin-landscape: 96px
  outer-margin-portrait: 64px
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
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.neutral-50}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.md}"
  card:
    backgroundColor: "{colors.neutral-50}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
---

## Overview

Safety-first authority. Deep navy carries calm institutional weight; signal orange is the single emergency-orange call-out. The system reads as a calm hand on a hard day — not a marketing campaign. Voice is reassuring + expert; sentences short.

## Colors

- **Primary (#0B2545):** Deep navy — institutional trust, dark surfaces, hero backgrounds.
- **Secondary (#13315C):** Mid-navy — secondary surfaces, secondary CTAs.
- **Accent (#FF8A00):** Signal orange — single emergency call-out per scene. Never decorative.
- **Neutral 50 / 100 / 500 / 900:** Cool greys.
- **Semantic** — success / warning / danger reserved for system states.

## Typography

Inter throughout. Display ExtraBold (800) for hero, Regular (400) for body. Tight display tracking, relaxed body line-height.

## Layout

12-col grid, 96px outer margin landscape / 64px portrait. Safe-area inset 5%. Logo top-left.

## Elevation & Depth

Flat-first; tonal navy steps express hierarchy. When elevation is required: `0 4px 12px rgba(11, 37, 69, 0.12)`.

## Components

- **cta-primary** — Signal orange on navy, 8px radius. One per scene.
- **cta-secondary** — Mid-navy on neutral-50.
- **card** — Neutral-50 surface, 12px radius.

## Do's and Don'ts

**Do:** lead with the next safe step. Reserve orange for emergency action.
**Don't:** never use red as a brand colour (danger only). Never sensationalise.
