---
version: alpha
name: Synthex
description: Visual identity for Synthex — synthetic intelligence at production scale. Paired runtime config at synthex.ts.
colors:
  primary: "#FF6B35"
  secondary: "#0F172A"
  accent: "#22D3EE"
  neutral-50: "#F8FAFC"
  neutral-100: "#E2E8F0"
  neutral-500: "#64748B"
  neutral-900: "#020617"
  success: "#10B981"
  warning: "#F59E0B"
  danger: "#EF4444"
  on-primary: "#0F172A"
  on-secondary: "#F8FAFC"
  on-accent: "#0F172A"
  surface: "{colors.secondary}"
  on-surface: "{colors.neutral-50}"
  surface-elevated: "#1E293B"
typography:
  display-xl:
    fontFamily: Inter
    fontSize: 96px
    fontWeight: 800
    lineHeight: 1.0
    letterSpacing: -0.04em
  display-lg:
    fontFamily: Inter
    fontSize: 64px
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: -0.03em
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
  mono-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.01em
  mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.4
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
rounded:
  sm: 4px
  DEFAULT: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 9999px
components:
  cta-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.md}"
    typography: "{typography.body-lg}"
  cta-secondary:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.neutral-50}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.md}"
  card:
    backgroundColor: "{colors.surface-elevated}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  code-block:
    backgroundColor: "{colors.neutral-900}"
    textColor: "{colors.accent}"
    typography: "{typography.mono-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.md}"
  signal-chip:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.secondary}"
    typography: "{typography.mono-md}"
    rounded: "{rounded.full}"
    padding: "{spacing.sm}"
---

## Overview

Production-grade infrastructure aesthetic. Dark slate canvas with candy-orange brand mark and cyan signal accent — the colour story of monitoring dashboards and synthesised data streams. JetBrains Mono carries the technical weight; Inter handles the narrative. Audience: ML engineers, platform teams, CTOs evaluating synthetic-data infrastructure. Voice is technical, precise, evidence-led.

## Colors

- **Primary (#FF6B35):** Candy orange — Synthex brand mark, hero CTAs, attention nodes.
- **Secondary (#0F172A):** Deep slate — primary canvas, dark-first surface.
- **Accent (#22D3EE):** Cyan — signal output, code highlights, success indicators.
- **Surface-elevated (#1E293B):** Card and modal surfaces against the slate canvas.

## Typography

**Inter** for headlines and body, **JetBrains Mono** for code, IDs, model names, latency numbers, anything that should read as a literal value. Tight display tracking, precise body line-height.

## Layout

12-col grid on dark canvas, 96px landscape margin / 64px portrait. Mono blocks get full grid width when displayed standalone.

## Elevation & Depth

Dark-first — elevation is expressed by lifting from `secondary` (#0F172A) to `surface-elevated` (#1E293B). Cyan accent line on hover for interactive surfaces. No drop shadows on dark — use luminosity instead.

## Components

- **cta-primary** — Candy orange on slate type, the single highest-emphasis interaction.
- **code-block** — Slate-900 background, cyan text, JetBrains Mono — for code samples and API responses.
- **signal-chip** — Cyan pill with mono type — for output values, latency badges, status signals.
- **card** — Surface-elevated against secondary canvas.

## Do's and Don'ts

**Do:** lead with measurable claims (latency, throughput, accuracy). Show code, not adjectives.
**Don't:** never use light-mode mockups in primary marketing — Synthex is dark-first.
