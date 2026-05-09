---
version: alpha
name: Carpet Cleaners Warehouse
description: Visual identity for CCW — trade prices, same-day dispatch. Paired runtime config at ccw.ts.
colors:
  primary: "#D62828"
  secondary: "#003049"
  accent: "#F77F00"
  neutral-50: "#FAFAFA"
  neutral-100: "#EDEDED"
  neutral-500: "#6B6B6B"
  neutral-900: "#0E0E0E"
  success: "#3FA34D"
  warning: "#E0A800"
  danger: "#A02020"
  on-primary: "#FFFFFF"
  on-secondary: "#FFFFFF"
  on-accent: "#0E0E0E"
  surface: "{colors.neutral-50}"
  on-surface: "{colors.neutral-900}"
typography:
  display-xl:
    fontFamily: Outfit
    fontSize: 96px
    fontWeight: 800
    lineHeight: 1.0
    letterSpacing: -0.03em
  display-lg:
    fontFamily: Outfit
    fontSize: 64px
    fontWeight: 800
    lineHeight: 1.05
  display-md:
    fontFamily: Outfit
    fontSize: 48px
    fontWeight: 800
    lineHeight: 1.1
  headline:
    fontFamily: Outfit
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
    fontWeight: 600
    lineHeight: 1.4
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  outer-margin-landscape: 80px
  outer-margin-portrait: 48px
rounded:
  sm: 4px
  DEFAULT: 6px
  md: 10px
  lg: 14px
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
  price-tag:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-50}"
    typography: "{typography.headline}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
---

## Overview

Trade-counter directness. Bold red price-tag energy on navy structure with high-vis orange call-outs. Outfit display type carries product-listing weight; Inter body keeps SKU descriptions readable. Voice is plain, transactional, no-nonsense.

## Colors

- **Primary (#D62828):** Trade red — price tags, sale flags, brand identification.
- **Secondary (#003049):** Deep navy — structural backgrounds, type, navigation.
- **Accent (#F77F00):** Hi-vis orange — primary CTAs, dispatch indicators.

## Typography

**Outfit** display (800) for prices and product names. **Inter** for body and product descriptions.

## Layout

12-col grid, tighter outer margins (80px landscape / 48px portrait) for product-density feel.

## Components

- **cta-primary** — Hi-vis orange on neutral-900 type.
- **price-tag** — Red on white, prominent display weight, used for SKU pricing.
- **card** — Neutral-50 surface, 10px radius (slightly tighter than restoration brands).

## Do's and Don'ts

**Do:** lead with price + SKU + dispatch time. Stack offers visually.
**Don't:** never use editorial whitespace — this is a trade catalogue, not a gallery.
