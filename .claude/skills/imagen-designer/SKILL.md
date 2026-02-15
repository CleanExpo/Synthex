---
name: imagen-designer
description: >
  Image generation prompt engineering and visual design standards for
  AI marketing content. Generates optimized prompts for AI image tools,
  enforces brand consistency, and handles platform-specific sizing and
  aspect ratios. Use when user says "generate image", "design visual",
  "brand assets", "social media graphics", or "image prompt".
---

# Image Generation & Visual Design

## Process

1. **Gather brief** -- collect brand context, campaign goal, target platform(s), and visual direction
2. **Select format** -- determine aspect ratio and resolution from platform specs
3. **Compose prompt** -- build a structured AI image prompt with style, subject, composition, and brand elements
4. **Apply brand rules** -- enforce color palette, typography guidelines, logo placement, and tone
5. **Generate variants** -- produce 2-4 prompt variations for A/B testing
6. **Review & refine** -- iterate based on output quality and brand alignment

## Platform Image Specifications

| Platform | Format | Aspect Ratio | Resolution | Notes |
|----------|--------|--------------|------------|-------|
| YouTube | Thumbnail | 16:9 | 1280x720 | High contrast, readable at small size |
| YouTube | Shorts cover | 9:16 | 1080x1920 | Bold text, vertical framing |
| Instagram | Feed post | 1:1 | 1080x1080 | Clean composition, text overlay minimal |
| Instagram | Feed post (tall) | 4:5 | 1080x1350 | Maximum feed real estate |
| Instagram | Reels cover | 9:16 | 1080x1920 | Eye-catching, movement implied |
| Instagram | Story | 9:16 | 1080x1920 | Interactive-ready layout |
| TikTok | Video cover | 9:16 | 1080x1920 | Bold text, high energy |
| X (Twitter) | In-stream image | 16:9 | 1600x900 | Contrast for dark/light mode |
| Facebook | Feed image | 1:1 or 4:5 | 1080x1080 / 1080x1350 | Minimal text overlay (<20%) |
| Facebook | Cover photo | 2.7:1 | 1640x624 | Brand identity focused |
| LinkedIn | Post image | 1:1 or 16:9 | 1080x1080 / 1920x1080 | Professional, data-driven visuals |
| LinkedIn | Article header | 16:9 | 1920x1080 | Clean, editorial style |
| Pinterest | Standard pin | 2:3 | 1000x1500 | Tall format, text overlay readable |
| Pinterest | Idea pin | 9:16 | 1080x1920 | Multi-page visual story |
| Reddit | Post image | 16:9 or 4:3 | 1200x628 or 1200x900 | Informative, not overly branded |

## Prompt Engineering Structure

### Prompt Template
```
[Style/Medium] of [Subject] in [Setting/Environment],
[Composition/Framing], [Lighting],
[Color palette/Brand colors], [Mood/Atmosphere],
[Technical details: resolution, quality descriptors]
```

### Style Modifiers
- **Photography**: editorial, product, lifestyle, documentary, portrait
- **Illustration**: flat design, isometric, watercolor, line art, 3D render
- **Graphic design**: minimalist, typographic, data visualization, infographic
- **Brand-specific**: match existing brand visual language

### Composition Rules
- Rule of thirds for subject placement
- Negative space for text overlay areas
- Visual hierarchy: primary subject > secondary elements > background
- Platform-aware safe zones (avoid edges that get cropped)

### Quality Descriptors
- Resolution: "high resolution", "4K", "detailed"
- Lighting: "studio lighting", "natural light", "golden hour", "dramatic"
- Render quality: "photorealistic", "sharp focus", "professional"

## Brand Consistency Framework

### Color System
- Define primary, secondary, and accent colors with hex values
- Specify text-on-dark and text-on-light variants
- Ensure contrast ratios meet WCAG AA (4.5:1 for text)

### Typography Integration
- Headline: bold, high contrast, readable at thumbnail size
- Body text: clean, legible at mobile viewing distance
- Platform constraints: some platforms strip custom fonts

### Logo Placement
- Consistent positioning per platform (bottom-right default)
- Minimum clear space around logo
- Monochrome variant for busy backgrounds
- Never stretch, rotate, or obscure the logo

### Visual Tone
- Map brand voice to visual style (e.g., "authoritative" = clean lines, dark palette)
- Maintain consistent filter/color grading across campaign assets
- Document "do" and "do not" examples for reference

## Output

### Per Image Request
- 2-4 prompt variations with rationale for each
- Recommended aspect ratio and resolution for target platform
- Brand compliance checklist (colors, logo, tone)
- Alt text suggestion for accessibility

### Deliverable Formats
- AI prompt text ready for image generation tools
- Platform-specific sizing guide
- Brand compliance notes and adjustment recommendations

## References

- Platform specs sourced from `Synthex/platform_master_config.json`
- Brand assets stored in `imagen-designer/references/`
- See `platform-showcase` skill for content adaptation context
