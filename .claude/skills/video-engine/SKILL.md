---
name: video-engine
description: >
  Video content generation using Veo3 integration. Handles storyboard
  creation, character consistency, brand integration, and platform-specific
  optimization for YouTube long-form, YouTube Shorts, TikTok, Instagram
  Reels, and other formats. Use when user says "generate video", "storyboard",
  "video content", "Veo3", "shorts", "reels", or "video strategy".
---

# Video Content Engine (Veo3)

## Process

1. **Define video brief** -- collect campaign goal, target platform(s), brand guidelines, and key message
2. **Select format** -- determine video type (long-form, shorts, reels) and platform specs
3. **Generate storyboard** -- create scene-by-scene breakdown with visuals, dialogue, and timing
4. **Ensure character consistency** -- maintain visual identity of characters/presenters across scenes
5. **Integrate brand elements** -- apply logo, colors, typography, and brand voice throughout
6. **Optimize per platform** -- adjust duration, aspect ratio, pacing, and metadata for each target
7. **Generate via Veo3** -- execute video generation with scene transitions and music integration
8. **Review and iterate** -- quality check against brief and brand standards

## Veo3 Integration Settings

From `platform_master_config.json`:

| Feature | Setting |
|---------|---------|
| Storyboard generation | Enabled |
| Character consistency | Enabled |
| Brand integration | Enabled |
| Platform optimization | Enabled |
| Scene transitions | Smooth |
| Style consistency | Brand-aligned |
| Music integration | Royalty-free library |

## Platform Video Specifications

### YouTube Long-Form
- Duration: 8-15 minutes
- Aspect ratio: 16:9
- Resolution: 1920x1080
- File format: MP4
- Bitrate: 8-12 Mbps
- FPS: 24-60
- Structure: Hook (0-15s) > Problem (15-60s) > Solution (60-80%) > CTA (final 20s)
- Requires: custom thumbnail, timestamps, end screen, cards

### YouTube Shorts
- Duration: 15-60 seconds
- Aspect ratio: 9:16
- Resolution: 1080x1920
- File format: MP4
- Bitrate: 5-10 Mbps
- FPS: 30-60
- Structure: Immediate hook > compressed value > loop-friendly ending

### Instagram Reels
- Duration: 15-30 seconds
- Aspect ratio: 9:16
- Resolution: 1080x1920
- Cover frame: custom selection
- Music: trending audio essential
- Structure: Hook > Build suspense > Reveal > Value/Lesson

### TikTok
- Duration: 15-60 seconds (up to 10 minutes for extended)
- Aspect ratio: 9:16
- Resolution: 1080x1920
- Text overlay: essential for silent viewing
- Transitions: quick cuts every 2-3 seconds
- Structure: Trending audio + Brand message + Visual hook

### Facebook Video
- Duration: 1-3 minutes
- Aspect ratio: 1:1 or 4:5
- Captions: required for silent viewing
- Thumbnail: custom selection
- Structure: Personal story > Context > Value/Lesson

### LinkedIn Video
- Duration: 30 seconds to 10 minutes
- Aspect ratio: 16:9 or 1:1
- Captions: professional tone
- Structure: Industry insight or professional story format

### Pinterest Video Pins
- Duration: 4 seconds to 15 minutes
- Aspect ratio: 2:3, 1:1, or 9:16
- Cover image: custom selection
- Structure: How-to guide or inspiration board format

## Storyboard Generation

### Scene Structure
```
Scene [N]:
  Duration: [seconds]
  Visual: [description of what appears on screen]
  Dialogue/VO: [spoken text or voiceover script]
  Text overlay: [on-screen text for silent viewing]
  Music/SFX: [audio cues]
  Transition: [cut, fade, swipe, zoom]
  Brand elements: [logo placement, color usage, typography]
```

### Pacing Guidelines

| Platform | Avg. Scene Length | Cuts Per Minute | Hook Window |
|----------|-------------------|-----------------|-------------|
| YouTube Long-form | 10-30s | 4-8 | First 15s |
| YouTube Shorts | 3-5s | 12-20 | First 2s |
| Instagram Reels | 2-4s | 15-20 | First 3s |
| TikTok | 2-3s | 20-30 | First 1-2s |
| Facebook | 5-15s | 4-12 | First 3s |
| LinkedIn | 10-30s | 2-6 | First 5s |

## Character Consistency

### Visual Identity Tracking
- Define character appearance attributes: face, build, clothing, accessories
- Lock style reference across all scenes in a storyboard
- Maintain consistent lighting and color grading on characters
- Document character sheet for multi-video campaign continuity

### Brand Presenter Guidelines
- Consistent framing and positioning across scenes
- Wardrobe aligned with brand palette
- Background environment matches brand aesthetic
- Expression and energy level appropriate to platform tone

## Brand Integration

### Visual Elements
- Logo: consistent placement per platform (watermark or intro/outro)
- Color palette: applied to backgrounds, text overlays, graphics
- Typography: brand fonts for all on-screen text
- Lower thirds: branded template for speaker identification

### Audio Elements
- Brand audio signature (intro/outro jingle if applicable)
- Music from royalty-free library matching brand mood
- Consistent audio levels and mixing standards

### Messaging Elements
- Brand voice applied to all scripts and dialogue
- Key messaging points embedded naturally in content
- CTA aligned with campaign objective

## Output

### Per Video
- Complete storyboard document (scene-by-scene)
- Veo3 generation prompts per scene
- Platform-specific export settings (resolution, bitrate, format)
- Thumbnail/cover frame recommendation
- Caption/subtitle file
- Metadata package (title, description, tags, hashtags)

### Multi-Platform Package
- Primary video (usually YouTube long-form)
- Short-form derivatives (Shorts, Reels, TikTok) extracted from primary
- Platform-specific edits with adjusted pacing and aspect ratios
- Publishing schedule aligned with waterfall strategy

## References

- Platform video specs sourced from `Synthex/platform_master_config.json`
- Veo3 settings in `automation_settings.veo3_integration` config section
- Cross-posting order and timing in `publishing_automation.cross_posting` config section
- See `platform-showcase` skill for full adaptation strategy
- See `imagen-designer` skill for thumbnail and cover frame design
- Video asset references stored in `video-engine/references/`
