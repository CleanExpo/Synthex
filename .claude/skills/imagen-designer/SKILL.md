---
name: imagen-designer
description: >-
  AI image generation skill using Google's Gemini/Imagen models.
  Generates visuals for video production, marketing materials,
  and showcase content. Supports FREE and PREMIUM tiers.
metadata:
  author: synthex
  version: "2.0"
  engine: synthex-ai-agency
  type: generation-skill
---

# Imagen Designer

## Purpose

Generates AI images for video production and marketing materials using
Google's Gemini/Imagen APIs. Supports both free and premium tiers with
different model options.

## Tier System

### FREE TIER
- **Model**: `gemini-2.0-flash-exp`
- **Scripts**: `generate_image.py`, `generate_nano_banana.py`
- **Requirements**: `GEMINI_API_KEY` only
- **Features**: Basic image generation, placeholder fallback

### PREMIUM TIER
- **Models**: Imagen 4 Ultra, Imagen 4, Imagen 4 Fast, Imagen 3
- **Script**: `generate_imagen.py`
- **Requirements**: `VERTEX_AI_PROJECT`, Google Cloud authentication
- **Features**: 2K resolution, multi-image generation, higher quality

## When to Use

Activate this skill when:
- Video production needs visual assets
- Marketing materials require generated images
- Showcase content needs illustrative visuals
- Product mockups or UI previews are needed

## Environment Discovery

First, run the discovery script to check available API keys:

```bash
source .claude/skills/imagen-designer/scripts/discover-keys.sh
```

This will:
- Check for GEMINI_API_KEY (free tier)
- Check for VERTEX_AI_PROJECT (premium tier)
- Set IMAGEN_PROVIDER and IMAGEN_KEYS_AVAILABLE

## Generation Scripts

### 1. Basic Generation (Free Tier)

```bash
python .claude/skills/imagen-designer/scripts/generate_image.py \
  --prompt "Your detailed prompt here" \
  --aspect "16:9" \
  --output "output/path/image.png" \
  --style "realistic"
```

### 2. Nano Banana Pro/Flash (Free Tier)

```bash
python scripts/generate_nano_banana.py "Your prompt" \
  --model pro \
  --aspect 16:9 \
  --output output/image.png
```

| Model | Description | Timeout |
|-------|-------------|---------|
| pro | Higher quality, more detailed | 180s |
| flash | Faster generation, good quality | 60s |

### 3. Imagen 4 (Premium Tier)

```bash
python scripts/generate_imagen.py "Your prompt" \
  --model imagen-4-ultra \
  --size 2K \
  --aspect 16:9 \
  --count 1 \
  --output output/image.png
```

| Model | Description | Max Resolution |
|-------|-------------|----------------|
| imagen-4-ultra | Highest quality | 2K |
| imagen-4 | High quality | 2K |
| imagen-4-fast | Fast generation | 1K |
| imagen-3 | Previous generation | 1K |
| imagen-3-fast | Fast, previous gen | 1K |

## Parameters

| Parameter | Options | Default | Description |
|-----------|---------|---------|-------------|
| --prompt | Text | Required | Image description |
| --aspect | 16:9, 9:16, 1:1, 4:3, 3:4, 21:9 | 16:9 | Aspect ratio |
| --output | Path | Required | Output file path |
| --style | realistic, artistic, minimal, corporate | realistic | Visual style |
| --model | See tables above | varies | Model selection |
| --size | 1K, 2K | 1K | Resolution (Imagen only) |
| --count | 1-4 | 1 | Image count (Imagen only) |

## Prompt Engineering Guidelines

### For Marketing/Corporate Images

```
A professional marketing image showing [subject].
Style: Clean, modern, corporate.
Colours: [brand colours]
Background: [simple/gradient/contextual]
Mood: [professional/friendly/innovative]
No text or logos.
```

### For UI Mockups

```
A clean UI mockup showing [feature].
Style: Modern dashboard design.
Colours: Dark mode with [accent colour] highlights.
Elements: [specific UI elements]
Realistic software interface aesthetic.
```

### For Abstract/Conceptual

```
An abstract visualization representing [concept].
Style: [geometric/organic/data-driven]
Colours: [brand colours]
Feeling: [innovative/trustworthy/dynamic]
Professional corporate aesthetic.
```

## Brand Colour Integration

For Synthex platform videos, use:
- Primary: #C41E3A (Ruby red)
- Background: #EBEBEF (Light gray)
- Accent: #10B981 (Emerald for success states)
- Dark: #1F2937 (For contrast)

## Output Verification

After generation, the scripts verify:
1. File exists at specified path
2. File size > 1KB (not empty)
3. Valid image format (PNG/JPEG)
4. Metadata JSON saved alongside image

## Error Handling

| Error | Action |
|-------|--------|
| API key missing | Fail immediately with clear message |
| API rate limit | Wait 60s, retry once |
| Generation failed | Retry with simplified prompt |
| Invalid output | Retry, then fail with details |
| Premium model on free tier | Fall back to free tier model |

## Guidelines

- Run `discover-keys.sh` before attempting generation
- Use descriptive prompts for consistent results
- Avoid text in images (AI text is often garbled)
- Keep prompts under 500 characters for best results
- Use corporate/professional style for business content
- Output to assigned workspace only
- Check user tier before selecting model
