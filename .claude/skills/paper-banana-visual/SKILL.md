---
name: paper-banana-visual
description: >-
  Orchestrates Paper Banana microservice calls to generate publication-quality
  academic diagrams, data plots, and visualizations. Handles prompt engineering
  for scientific and business visuals, quality evaluation via the Critic agent,
  and visual asset management. Use when generating diagrams, plots, infographics,
  or evaluating visual quality for research reports and content.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: generation-skill
  triggers:
    - paper banana
    - generate diagram
    - academic illustration
    - visual data
    - research visual
    - data plot
    - infographic
  requires:
    - .claude/skills/imagen-designer (existing visual generation)
---

# Paper Banana Visual — AI Visual Generation Orchestrator

## Purpose

Generate publication-quality diagrams, plots, and data visualizations using the
Paper Banana agentic AI framework (https://paperbanana.org/). Paper Banana uses
a multi-agent pipeline (Retriever > Planner > Stylist > Visualizer > Critic)
powered by Google Gemini to produce academic-quality illustrations.

## When to Use

Activate this skill when:
- Generating academic-quality diagrams from text descriptions
- Creating data plots from structured data
- Producing infographics for research reports
- Creating before/after visual comparisons
- Evaluating visual quality and suggesting improvements
- Managing visual asset library for a client

## When NOT to Use This Skill

- When generating marketing photos or social media images (use imagen-designer)
- When creating UI mockups or design files (use design skill)
- When the visual doesn't need academic/data quality
- Instead use: `imagen-designer` for marketing visuals, `design` for UI

## Instructions

1. **Receive visual request** — Accept description, type (diagram/plot/infographic),
   and optional data payload
2. **Craft prompt** — Engineer prompt for Paper Banana's pipeline:
   - For diagrams: Include topic, key concepts, relationships, desired style
   - For plots: Include data format, chart type, labels, colour scheme
   - For infographics: Include sections, data points, visual hierarchy
3. **Call microservice** — POST to Paper Banana FastAPI service:
   - `/api/generate/diagram` for concept diagrams
   - `/api/generate/plot` for data visualizations
   - `/api/evaluate` for quality evaluation
4. **Evaluate quality** — Check Critic agent score (0-100):
   - Score >= 70: Approve for use
   - Score 50-69: Suggest refinements, regenerate with improved prompt
   - Score < 50: Reject, redesign prompt from scratch
5. **Store asset** — Upload to storage, create VisualAsset record in database
6. **Generate metadata** — Create alt text, caption, and SEO-optimized filename
7. **Return result** — URL, thumbnail, quality score, metadata

## Input Specification

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | yes | 'diagram', 'plot', 'infographic', 'before_after' |
| prompt | string | yes | Description of desired visual |
| data | object | no | Structured data for plots |
| style | string | no | Visual style preference |
| reportId | number | no | Link to research report |

## Output Specification

| Field | Type | Description |
|-------|------|-------------|
| imageUrl | string | Full-size image URL |
| thumbnailUrl | string | Thumbnail URL |
| qualityScore | number | 0-100 Critic evaluation |
| altText | string | SEO alt text |
| caption | string | Figure caption |
| metadata | object | Paper Banana response metadata |

## Paper Banana Pipeline

```
Text Prompt
    |
    v
[Retriever] -- Gathers relevant visual references
    |
    v
[Planner] -- Designs layout and composition
    |
    v
[Stylist] -- Applies academic visual style
    |
    v
[Visualizer] -- Generates the image (Gemini VLM)
    |
    v
[Critic] -- Evaluates quality, suggests improvements
    |
    v
Final PNG + JSON metadata
```

## Error Handling

| Error | Action |
|-------|--------|
| Microservice unavailable | Return error, suggest retry in 30s |
| Generation timeout (>60s) | Queue as async job, notify when complete |
| Quality score < 50 | Auto-retry with refined prompt (max 2 retries) |
| Invalid data format for plot | Return validation errors with format guide |
| Storage upload failed | Retry once, return base64 as fallback |
