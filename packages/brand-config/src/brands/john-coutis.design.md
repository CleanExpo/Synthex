---
version: alpha
name: John Coutis OAM
description: Visual identity for John Coutis OAM — Australian inspirational speaker and named spokesman for the expanded NRPG industry association. Paired runtime config at john-coutis.ts. All tokens are PROPOSAL pending founder review with John; see TODO markers.
colors:
  primary: "#1A1A1A"
  secondary: "#3A2E1F"
  accent: "#D4A437"
  neutral-50: "#F5F0E6"
  neutral-100: "#E8DFCE"
  neutral-500: "#7A6F5C"
  neutral-900: "#1A1A1A"
  success: "#3FA34D"
  warning: "#E0A800"
  danger: "#C0392B"
  on-primary: "#F5F0E6"
  on-secondary: "#F5F0E6"
  on-accent: "#1A1A1A"
  surface: "{colors.primary}"
  on-surface: "{colors.neutral-50}"
  surface-light: "{colors.neutral-50}"
  on-surface-light: "{colors.neutral-900}"
typography:
  display-xl:
    fontFamily: Bebas Neue
    fontSize: 128px
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: 0.02em
    textTransform: uppercase
  display-lg:
    fontFamily: Bebas Neue
    fontSize: 88px
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: 0.02em
    textTransform: uppercase
  display-md:
    fontFamily: Bebas Neue
    fontSize: 56px
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: 0.02em
    textTransform: uppercase
  headline:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.25
  pull-quote:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.4
    fontStyle: italic
  body-lg:
    fontFamily: Inter
    fontSize: 20px
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
    letterSpacing: 0.04em
    textTransform: uppercase
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 72px
  outer-margin-landscape: 112px
  outer-margin-portrait: 56px
rounded:
  sm: 2px
  DEFAULT: 4px
  md: 8px
  lg: 12px
  full: 9999px
components:
  cta-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.md} {spacing.xl}"
    typography: "{typography.body-lg}"
    fontWeight: 600
  cta-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-50}"
    border: "1px solid {colors.neutral-50}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.md} {spacing.xl}"
  card:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.neutral-50}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
  chyron:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-50}"
    accentBar: "{colors.accent}"
    accentBarWidthPx: 6
    padding: "{spacing.md} {spacing.lg}"
  pull-quote-block:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    leftRule: "4px solid {colors.accent}"
    paddingLeft: "{spacing.lg}"
    typography: "{typography.pull-quote}"
  badge-oam:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs} {spacing.sm}"
    typography: "{typography.caption}"
---

## Overview

Warm, lived-in, earned. The system reads like a master storyteller's stage at the moment the houselights come down — charcoal surface, a single shaft of gold for the call-to-action, condensed display type that mirrors his wordmark. Nothing in the system competes with the man on camera. The visual identity exists to frame him, not to perform alongside him.

This is intentionally NOT a corporate-speaker visual system (which would be navy + teal, sans-serif throughout, conservative). The brand differentiates by feeling like an Australian pub at storytelling hour: warm, dark, gold-lit, honest.

<!-- TODO confirm with John: dark-default vs light-default. Current proposal assumes dark hero (matches his wordmark which renders white-on-dark). -->

## Colors

- **Primary (#1A1A1A)** — Deep charcoal. The default surface for hero scenes, lower-thirds, full-bleed video chyrons. Not pure black (#000) because pure black is screen-cold; charcoal carries warmth from the slight brown bias.
- **Secondary (#3A2E1F)** — Warm umber. Card surfaces and depth steps above the charcoal primary. Reads as "well-loved leather chair" not "dark mode UI".
- **Accent (#D4A437)** — Australian gold. The only colour permitted for CTAs, the OAM badge, and pull-quote rules. Chosen to (a) feel Australian without resorting to green-and-gold cliché, (b) sit adjacent to the actual Order of Australia Medal ribbon palette, (c) carve out airspace away from the navy-blue every other inspirational speaker uses.
- **Neutral 50 (#F5F0E6)** — Warm cream. Body text on dark surfaces. Slightly off-white — paper, not screen.
- **Neutral 100 (#E8DFCE)** — Aged paper. Secondary body, captions.
- **Neutral 500 (#7A6F5C)** — Warm grey. Disabled / inactive states, metadata.
- **Neutral 900 (#1A1A1A)** — Same as primary (single dark token for both roles by design).
- **Semantic** — success / warning / danger reserved for system states. Never used in editorial scenes.

### Contrast (WCAG AA)
- on-primary (#F5F0E6 on #1A1A1A): contrast ratio ~14.6:1 — passes AAA.
- on-accent (#1A1A1A on #D4A437): contrast ratio ~8.4:1 — passes AAA for normal text.
- on-secondary (#F5F0E6 on #3A2E1F): contrast ratio ~10.2:1 — passes AAA.

## Typography

**Display: Bebas Neue (SIL Open Font License)** — condensed, all-caps, structurally aligned with his existing Canva wordmark. Used for hero titles, chyron names, episode card headlines. Never set in mixed case — the geometry only works in uppercase.

**Body: Inter (SIL Open Font License)** — workhorse. Used for everything that is not display: subtitles, captions, lower-thirds metadata, blog copy, on-screen lists.

**Pull-quote: Inter italic 500** — when JC says something quotable on camera, the on-screen pull-quote uses italic-medium Inter at 24px with a gold left-rule. This is the ONLY place italic is used.

No mono. No serif. <!-- TODO confirm body font with John; Inter is the proposal default until his web team confirms what the WordPress theme uses. -->

### Type scale per aspect ratio

| Ratio | Display-xl | Display-md | Body-lg | Body-md |
|---|---|---|---|---|
| 1920×1080 (landscape) | 128px | 56px | 20px | 16px |
| 1080×1080 (square) | 96px | 48px | 18px | 16px |
| 1080×1920 (portrait / Reels) | 84px | 44px | 18px | 16px |

## Layout

12-column grid, 112px outer margin landscape / 56px portrait. Hero text holds the top half of the frame. Wordmark logo top-left, never overlapping subject. CTA chip always in the lower-right safe area. JC's face / skateboard never crops below the chest — he is shot at conversational eye level, not "looked down at" or "looked up to".

Safe-area inset: 5%.

## Elevation & Depth

Flat-first; warmth and depth come from the dual-tone charcoal+umber stack, not from drop shadows. When elevation is genuinely required (card lifting from a hero scene, modal over a video pause):

- Default: `0 4px 16px rgba(0, 0, 0, 0.32)`
- Hero accent (one card per scene maximum): `0 8px 24px rgba(212, 164, 55, 0.18)` — barely-visible gold spill

Never use shadow as decoration. Never use multiple elevation layers stacked.

## Components

- **cta-primary** — Australian gold (`#D4A437`) on charcoal text, 4px radius. One per scene. Used for "Watch the talk", "Book John", "Subscribe".
- **cta-secondary** — Outline-only (1px cream border on transparent). Used for "Read more", "See episodes".
- **card** — Warm umber (`#3A2E1F`) surface with cream text. 8px radius. Used for episode tiles, testimonial blocks, topic cards.
- **chyron** — Lower-third for video. Charcoal background, 6px gold left-rule, name in Bebas Neue caps, "OAM" post-nominal in the caption typography on a second line.
- **pull-quote-block** — Gold italic Inter with a 4px gold left-rule. The single emphatic punctuation device in editorial.
- **badge-oam** — Small gold pill, charcoal text, caption typography, all-caps. Used in chyron and speaker intro stills.

## Aspect ratios

`1920×1080` (landscape — YouTube long-form keynote highlights)
`1080×1920` (portrait — YouTube Shorts, Instagram Reels, TikTok)
`1080×1080` (square — Instagram feed, LinkedIn feed)

## Do's and Don'ts

**Do:**
- Frame JC at conversational eye level. He is a peer, not a monument.
- Use the gold accent sparingly. One CTA, one pull-quote, one OAM badge per scene — not all three.
- Let charcoal dominate. White-space is not a luxury; in this system the equivalent is *charcoal-space*.
- Set display type in Bebas Neue uppercase. The geometry breaks at any other treatment.

**Don't:**
- Never use stock disability imagery (wheelchair icons, ramp pictograms, accessibility-symbol glyphs). His mode of motion is a custom skateboard; that is the visual when one is needed.
- Never use Lucide / Material / FontAwesome icon families. Custom geometric marks only (per Phill's brand-wide rule).
- Never set Bebas Neue in mixed case or below 32px — it is a display face, not a UI face.
- Never put gold on cream — contrast collapses; gold lives on charcoal or umber surfaces only.
- Never use red as an editorial colour. Red is reserved for `danger` state.
- Never let the wordmark logo be smaller than 56px tall (safe-area px).
- Never decorate a JC scene with motion graphics that compete with his delivery. The system frames; he performs.
