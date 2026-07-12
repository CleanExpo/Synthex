---
name: visual-content-brief
description: >-
  Synthex visual content enforcer. NEVER produce generic stock-photo prompts,
  "professional woman at a desk" imagery without brand colour injection, or
  AI image prompts that could belong to any brand. ALWAYS inject the brand's
  primary hex, lighting that matches brand tone, and a negative prompt banning
  competitor colours and stock-photo feel. Activate on ANY request to create
  visuals, image prompts, design briefs, social graphics, product photography,
  or brand imagery — including "what should my images look like".
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: capability-uplift-visual
  triggers:
    - visual content
    - image prompts
    - design brief
    - product photography
    - social graphics
    - brand visuals
    - ai images
    - canva alternative
    - create visuals
    - visual brief
    - ai image
    - generate image
    - image generation
    - photography brief
context: fork
---

# Visual Content Brief

> **Visual generation (binding):** all images/video route through the grounded
> pipeline — see `.claude/rules/real-images-only.md` + the `grounded-visuals`
> skill. Direct provider calls fail CI.

## Purpose

Translates a Business DNA profile into precise AI image generation prompts and
visual direction briefs. Bridges Pomelli's visual generation concept with Synthex's
content workflow — prompts feed the grounded pipeline (see "Generation via the
grounded pipeline" below); the resulting images are used in Synthex's scheduled
posts.

## Workflow

```
1. Load Business DNA (colours, visual style, tone)
2. Identify visual content type (social post, ad creative, product shot, story, banner)
3. Generate tailored AI image prompts for each type
4. Produce platform-specific dimension specs
5. Output visual brief document
6. (Optional) Generate via Synthex's image pipeline if BYOK image key available
```

## Visual Brief Components

For each requested visual, produce:

### 1. AI Image Prompt

Structure every prompt using this formula:

```
[Subject + Action] + [Brand Style] + [Colour Palette] + [Lighting] + [Mood] + [Technical Spec]
```

**Example for a wellness brand:**

```
A calm professional woman working at a minimalist desk, soft morning light,
brand palette: sage green #8FAF8F and warm white #FAFAF8, clean editorial style,
shallow depth of field, magazine-quality photography, no text overlays,
16:9 aspect ratio, photorealistic
```

**Negative prompt (always include):**

```
Avoid: busy backgrounds, stock photo feel, competitor brand colours,
harsh shadows, low resolution, watermarks, text in image
```

### 2. Brand Colour Application Guide

```
PRIMARY COLOUR: [hex from DNA]
  → Background fills, CTA buttons, key accent elements

SECONDARY COLOURS: [hex list]
  → Supporting elements, borders, typography backgrounds

NEUTRAL: white/near-white or dark
  → Image backgrounds, breathing room

FORBIDDEN: [colours that clash with brand or signal competitors]
```

### 3. Platform Specs

| Platform          | Format                | Dimensions            | Safe Zone        |
| ----------------- | --------------------- | --------------------- | ---------------- |
| Instagram Feed    | Square / 4:5 portrait | 1080×1080 / 1080×1350 | 250px top/bottom |
| Instagram Story   | 9:16 vertical         | 1080×1920             | 250px top/bottom |
| LinkedIn Post     | Landscape             | 1200×627              | 100px all sides  |
| Facebook Post     | Landscape             | 1200×628              | 100px all sides  |
| Twitter/X         | Landscape             | 1600×900              | 100px all sides  |
| TikTok / Reel     | 9:16 vertical         | 1080×1920             | 350px top/bottom |
| YouTube Thumbnail | 16:9                  | 1280×720              | 100px all sides  |

## Content Type Templates

### Product Photography

```
[Product name] on [clean background matching brand colour], [lighting style],
professional product photography, [surface texture], brand colour accent [hex],
top-down / 45-degree angle, crisp focus, ecommerce-ready, white background
optional for cutout use
```

### Social Proof / People

```
[Demographic matching target audience], [setting relevant to product use],
candid authentic moment, not stock-photo feel, brand colour accent in environment,
diverse representation, natural lighting, editorial photography style
```

### Abstract / Brand Awareness

```
Abstract [brand concept] visualisation, [primary colour hex] dominant,
geometric / organic shapes, minimal and sophisticated, no human figures,
suitable for brand awareness campaign, premium feel
```

### Animated / Video Thumbnails

```
Split-screen before/after | Dynamic motion blur | Bold text overlay position:
[top third / bottom third] — leave [X]% of frame clear for text
```

## Generation via the grounded pipeline (REAL IMAGES ONLY mandate)

The sole sanctioned entry point is `generateImage()`/`generateBatch()` in
`lib/services/ai/image-generation.ts`, or the `generate_image` / `generate_video`
MCP studio tools (which inherit the same defaults). Every generation is
grounded-by-default on the owned reference library — `public/reference-library/manifest.json`
(143+ subjects incl. 135 CCW products) plus the PRIVATE Supabase bucket
`reference-library-private` (customer job photos, signed URLs, ingest via
`POST /api/admin/private-refs`). The prompt auto-detects the industry; **no owned
references ⇒ the call is `blocked: true`** ("No owned references for this subject —
add real photos to the reference library first"). `useReferences: false` is the
sole audited escape hatch and every result it produces is stamped `UNGROUNDED`.
The `carpet-style-v1` LoRA (trigger `ccwcarpet`) auto-applies for carpet-cleaning.
Direct provider calls (Artlist/Nano Banana/margot/Gemini/OpenAI/Stability/fal) fail
the CI guard test `tests/unit/ai/no-direct-image-apis.test.ts`.

Keep the prompt formula / negative-prompt / brand-colour discipline above — it
feeds the `prompt` parameter of `generateImage()`. Use the dashboard's 3-variant
batch + tap-to-rank flow to deliver a prompt set for review.

## Output Format

Deliver the brief as a structured document the user can save:

```
──────────────────────────────────────────
 VISUAL BRIEF — [Brand Name]
 Generated: [date]
──────────────────────────────────────────

BRAND VISUAL DNA
  Primary: [hex] | Secondary: [hexes]
  Style: [image style from DNA]
  Avoid: [list]

PROMPT SET A — Instagram Feed (×3 variations)
  Prompt 1: [full prompt]
  Negative: [negative prompt]
  Dimensions: 1080×1080

PROMPT SET B — LinkedIn (×2 variations)
  ...

PRODUCT PHOTOGRAPHY BRIEF
  [structured brief]
```

## Reference

- Grounded pipeline (mandatory): `.claude/rules/real-images-only.md`, `.claude/skills/grounded-visuals/`
- Brand DNA: `.claude/skills/business-dna/`
- Image generation service: `lib/services/ai/image-generation.ts`

---

## Capability Uplift — Override Defaults

**NEVER** produce a prompt that omits the brand's colour palette, uses
"professional woman/man at a clean desk" as a default setting, outputs prompts
that could apply to any brand, or skips the negative prompt.

**INSTEAD** every image prompt uses this structure:

[Subject + Action] + [Brand Visual Style from DNA] + [Primary Colour Hex] +
[Lighting that matches brand tone: editorial/dramatic/natural/documentary] +
[Mood] + [Technical Spec: aspect ratio, photorealistic/illustrated]

Negative: stock photo feel, generic office background, competitor brand colours
[hex list], watermarks, harsh shadows, low resolution

For a Synthex-generated brand, pull the primary colour from Business DNA
before writing any prompt. A prompt without a hex code is not a Synthex prompt.

**REFERENCE** `.claude/skills/synthex-standards/references/aesthetic-standards.md`

---

## Foundation & Gate Wiring (SYN-1050)

> Adopted from the senior-skill standard so every artefact this skill produces is checked against the locked foundation before it lands.

**Reads at every invocation (never cached — re-read each run):**

- `.claude/memory/ceo-foundation.md` — visual brand consistency, voice tag (Q2.5.5), universal + brand-specific taboos.
- `.claude/memory/verification-gates.md` — gate state for any claim referenced.

**Output gate:** every client-facing artefact this skill produces routes through `brand-voice-enforce` before the CEO batched-review queue. A REJECT blocks the artefact until the quoted offending string is fixed.

**Evidence standard:** every quantitative or factual claim carries exactly one tag — `[VERIFIED]` / `[INFERENCE]` / `[UNCONFIRMED]`. Untagged = defect (`.claude/rules/fabel-evidence-standard.md`). Never state a projected result as fact.

**Spec:** see `spec.md` in this skill directory.
