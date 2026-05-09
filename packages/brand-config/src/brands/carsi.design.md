---
version: alpha
name: CARSI
description: Visual identity for CARSI — inspection-led training. Paired runtime config at carsi.ts.
colors:
  primary: "#2563EB"
  secondary: "#2D2A26"
  accent: "#F2E8D5"
  neutral-50: "#FAFAF7"
  neutral-100: "#EDEAE2"
  neutral-500: "#6F6B62"
  neutral-900: "#1B1916"
  success: "#3FA34D"
  warning: "#E0A800"
  danger: "#C0392B"
  on-primary: "#FFFFFF"
  on-secondary: "#F2E8D5"
  on-accent: "#2D2A26"
  surface: "{colors.accent}"
  on-surface: "{colors.secondary}"
typography:
  display-xl:
    fontFamily: Lora
    fontSize: 88px
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: -0.01em
  display-lg:
    fontFamily: Lora
    fontSize: 56px
    fontWeight: 700
    lineHeight: 1.1
  display-md:
    fontFamily: Lora
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: Lora
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
  body-lg:
    fontFamily: Inter
    fontSize: 19px
    fontWeight: 400
    lineHeight: 1.55
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
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
  DEFAULT: 6px
  md: 10px
  lg: 14px
  full: 9999px
components:
  cta-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-50}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.md}"
    typography: "{typography.body-lg}"
  cta-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.accent}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.md}"
  card:
    backgroundColor: "{colors.neutral-50}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
---

## Overview

Editorial training authority. Lora display type evokes textbook gravity; Inter body keeps lessons readable on screen. Cream surface, deep coffee secondary, blue primary for course-action moments. Voice is patient, instructional, exact.

## Colors

- **Primary (#2563EB):** Course-blue — used for navigation, links, action CTAs.
- **Secondary (#2D2A26):** Deep coffee — display type, structural anchors.
- **Accent (#F2E8D5):** Warm cream — page surface, soft contrast against coffee type.

## Typography

**Lora** (serif) for all display levels — textbook gravitas. **Inter** (sans) for body — screen readability. Headlines weight 700; body Regular at 1.55 line-height for long-form learning content.

## Layout

12-col grid, generous gutters (`spacing.xl`). Lesson units use the `card` component as a fixed module.

## Elevation & Depth

Flat — paper-on-paper aesthetic. Hairline coffee borders, no shadows. Page colour does the work.

## Components

- **cta-primary** — Blue on neutral-50, one per lesson page.
- **cta-secondary** — Coffee on cream — supplementary downloads, references.
- **card** — Neutral-50 on cream surface for lesson modules.

## Do's and Don'ts

**Do:** Lora for headlines, Inter for body. Patient cadence; explain before instructing.
**Don't:** never mix Lora into body type. Never sensationalise or use marketing voice.
