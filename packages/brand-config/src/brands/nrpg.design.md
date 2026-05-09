---
version: alpha
name: NRPG
description: Visual identity for NRPG — standards for the response network. Paired runtime config at nrpg.ts.
colors:
  primary: "#059669"
  secondary: "#2A3D5F"
  accent: "#F2B33D"
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
    textColor: "{colors.neutral-900}"
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
---

## Overview

Standards-body authority. Emerald carries the response-network identity — calm, qualified, organised. Slate-blue grounds the hierarchy; amber accent flags certifications and verified actions. Voice is direct, factual, regulatory.

## Colors

- **Primary (#059669):** Emerald — network identity, hero surfaces.
- **Secondary (#2A3D5F):** Slate-blue — structural type, secondary surfaces.
- **Accent (#F2B33D):** Amber — verification badges, certified-action call-outs.

## Typography

Inter throughout, ExtraBold for display, Regular for body.

## Layout

12-col grid, 96px landscape margin / 64px portrait. Logo top-left.

## Elevation & Depth

Flat-first. Hairline emerald borders signal grouped certified content.

## Components

- **cta-primary** — Amber on neutral-900 type. One per scene.
- **cta-secondary** — Emerald on neutral-50.
- **card** — Neutral-50, 12px radius.

## Do's and Don'ts

**Do:** lead with the standard, the certifying body, the date. Reserve amber for verified actions.
**Don't:** never present unverified claims as certified. Never use red as a brand colour.
