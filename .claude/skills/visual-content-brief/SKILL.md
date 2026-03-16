---
name: visual-content-brief
description: >-
  Generates on-brand AI image prompts, visual direction briefs, and creative specs from
  a Business DNA profile. Produces prompts for DALL-E, Imagen, Flux, and Midjourney
  alongside colour-accurate platform graphic specs. Use when the user says "create visual
  content", "generate image prompts", "design brief", "product photography", "social
  graphics", "make visuals for my brand", or "what should my images look like". Extends
  Pomelli-style visual generation with Synthex's brand memory and BYOK image generation.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: workflow-skill
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
---

# Visual Content Brief

## Purpose

Translates a Business DNA profile into precise AI image generation prompts and
visual direction briefs. Bridges Pomelli's visual generation concept with Synthex's
content workflow — prompts can be sent directly to DALL-E 3, Imagen 3, Flux, or
Midjourney, then the resulting images used in Synthex's scheduled posts.

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

| Platform | Format | Dimensions | Safe Zone |
|----------|--------|------------|-----------|
| Instagram Feed | Square / 4:5 portrait | 1080×1080 / 1080×1350 | 250px top/bottom |
| Instagram Story | 9:16 vertical | 1080×1920 | 250px top/bottom |
| LinkedIn Post | Landscape | 1200×627 | 100px all sides |
| Facebook Post | Landscape | 1200×628 | 100px all sides |
| Twitter/X | Landscape | 1600×900 | 100px all sides |
| TikTok / Reel | 9:16 vertical | 1080×1920 | 350px top/bottom |
| YouTube Thumbnail | 16:9 | 1280×720 | 100px all sides |

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

## Generation via Synthex Image Pipeline

If user has an image generation BYOK key (DALL-E, Stability AI):

**API endpoint:** `POST /api/ai/images` (check availability)

Use `lib/ai/` image generation utilities. Pass prompts directly.
Each generated image can be attached to a scheduled post in Synthex.

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

- Imagen designer: `.claude/skills/imagen-designer/`
- Brand DNA: `.claude/skills/business-dna/`
- Synthex image routes: `app/api/ai/images/`
