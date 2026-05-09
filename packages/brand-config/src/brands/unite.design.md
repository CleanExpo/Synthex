---
version: alpha
name: Unite Group
description: Visual identity for Unite Group — connected service for the field. Paired runtime config at unite.ts.
colors:
  primary: "#E55A2B"
  secondary: "#1E293B"
  accent: "#FBBF24"
  neutral-50: "#F8FAFC"
  neutral-100: "#E2E8F0"
  neutral-500: "#64748B"
  neutral-900: "#0F172A"
  success: "#10B981"
  warning: "#F59E0B"
  danger: "#EF4444"
  on-primary: "#FFFFFF"
  on-secondary: "#FFFFFF"
  on-accent: "#0F172A"
  surface: "{colors.neutral-50}"
  on-surface: "{colors.neutral-900}"
typography:
  display-xl:
    fontFamily: Inter
    fontSize: 88px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -0.02em
  display-lg:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: 700
    lineHeight: 1.08
  display-md:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.1
  headline:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
  body-lg:
    fontFamily: Inter
    fontSize: 19px
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
  outer-margin-landscape: 88px
  outer-margin-portrait: 56px
rounded:
  sm: 4px
  DEFAULT: 8px
  md: 12px
  lg: 16px
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
    textColor: "{colors.neutral-50}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.md}"
  card:
    backgroundColor: "{colors.neutral-50}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  network-badge:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.neutral-900}"
    rounded: "{rounded.full}"
    padding: "{spacing.sm}"
    typography: "{typography.caption}"
---

## Overview

Field-network credibility. Candy orange anchors the parent-brand mark (shared with RestoreAssist as the holding-group identity); slate carries structural weight; amber signals the network connection. Voice is plain, operational, partner-respectful.

## Colors

- **Primary (#E55A2B):** Candy orange dark — parent-group brand identification.
- **Secondary (#1E293B):** Deep slate — structural type, secondary surfaces.
- **Accent (#FBBF24):** Amber — network badges, partner connections, certification highlights.

## Typography

**Inter** throughout. Display weight 700 (slightly lighter than RestoreAssist's 800) to differentiate the parent-group mark from operating brands.

## Layout

12-col grid, 88px landscape margin / 56px portrait. Logo top-left.

## Components

- **cta-primary** — Candy orange on neutral-50 type.
- **network-badge** — Amber pill — used for partner identification and network membership.
- **card** — Neutral-50 surface, 12px radius.

## Do's and Don'ts

**Do:** position Unite Group as the holding entity; let RestoreAssist / DR / NRPG carry the operational voice.
**Don't:** never compete with the operating brands' identities — Unite plays the connector role.
