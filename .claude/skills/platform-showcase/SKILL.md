---
name: platform-showcase
description: >-
  Generates marketing and showcase videos for Synthex AI Agency itself.
  The engine eats its own cooking — demonstrating its capabilities
  by producing videos about what it can do. Used for homepage content,
  marketing materials, and capability demonstrations.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: platform-skill
  triggers:
    - showcase video
    - platform demo
    - marketing video
    - homepage content
    - capability demonstration
---

# Platform Showcase

## Purpose

Synthex's homepage and marketing channels need video content
that demonstrates what the platform can do. This skill generates
that content using the same engine that serves clients — proving
the product by being the product.

## When to Use

Activate this skill when:
- Homepage showcase videos need generating or updating
- New capabilities have been added and need demonstrating
- Marketing campaign requires video content
- Sales team needs demo material
- A capability showcase is needed for a specific industry

## When NOT to Use This Skill

- When generating client-specific videos (use video-engine in Client Mode)
- When creating non-Synthex marketing content (use content agents)
- When managing client accounts or billing (use client-manager)
- When generating standalone images (use imagen-designer)
- Instead use: `video-engine` for client videos, `client-manager` for client ops

## Instructions

1. **Scan Synthex**: Run project-scanner against Synthex's own codebase
2. **Identify capabilities**: Map features, integrations, and client outcomes
3. **Select showcase type**: Match to marketing need
4. **Generate from truth**: Only showcase real, working capabilities
5. **Verify**: Same fact-checker gate as client videos
6. **Publish**: Output to `output/platform/showcase/`

## Showcase Video Types

| Type | Purpose | Audience | Duration |
|------|---------|----------|----------|
| capability-demo | Shows a specific Synthex feature | Prospects | 60s |
| industry-vertical | "Synthex for [industry]" | Niche prospects | 75s |
| process-walkthrough | How Synthex works end-to-end | All prospects | 90s |
| result-showcase | Real output examples | Decision makers | 60s |
| platform-overview | Full Synthex product positioning | All | 120s |
| feature-highlight | Single feature deep-dive | Specific users | 45s |

## Content Sources for Platform Videos

Platform videos draw from these verified sources:

1. **Synthex's own codebase** — features, architecture
   - What the engine CAN do (verified by code)
   - How the pipeline works (verified by implementation)
   - What technologies are used (verified by dependencies)

2. **Platform metadata** — capability stats
   - Number of features available
   - Types of content supported
   - Industries/frameworks supported

3. **Documentation** — README, docs, guides
   - Feature descriptions
   - Architecture explanations
   - Getting started guides

## What Platform Videos CANNOT Include

- Specific client names without written permission
- Client content without written permission
- Revenue figures or financial projections
- Unverified capability claims
- Competitor comparisons or disparagement
- Claims about speed/quality without measurable evidence

## Homepage Video Catalogue

```yaml
homepage_videos:
  hero:
    id: sx-hero
    title: "Synthex — AI Marketing Platform"
    type: platform-overview
    duration: 90
    placement: hero-section
    priority: critical

  how_it_works:
    id: sx-how-it-works
    title: "How Synthex Works"
    type: process-walkthrough
    duration: 90
    placement: how-it-works-section
    priority: critical

  capabilities:
    - id: sx-cap-content
      title: "AI Content Generation"
      type: capability-demo
      duration: 60
      placement: features-grid

    - id: sx-cap-analytics
      title: "Real-Time Analytics"
      type: capability-demo
      duration: 60
      placement: features-grid

    - id: sx-cap-scheduling
      title: "Smart Scheduling"
      type: capability-demo
      duration: 60
      placement: features-grid

    - id: sx-cap-multiplatform
      title: "Multi-Platform Publishing"
      type: capability-demo
      duration: 60
      placement: features-grid

  industry_verticals:
    - id: sx-ind-saas
      title: "Synthex for SaaS"
      type: industry-vertical
      duration: 75

    - id: sx-ind-ecommerce
      title: "Synthex for E-Commerce"
      type: industry-vertical
      duration: 75

    - id: sx-ind-agencies
      title: "Synthex for Agencies"
      type: industry-vertical
      duration: 75
```

## Self-Referential Script Rules

When the engine writes scripts about itself:

1. **Capabilities must be verified against actual code**
   - "Synthex generates AI content" → verified by API routes
   - "Multi-platform publishing" → verified by integrations
   - "Real-time analytics" → verified by dashboard features

2. **Process descriptions must match actual implementation**
   - Pipeline steps → verified against actual codebase
   - Feature names → verified against UI components

3. **The verification gate applies equally to platform videos**
   - fact-checker verifies Synthex videos the same as client videos
   - No shortcuts because "it's our own product"
   - This IS the demonstration of the verification system

## Guidelines

- Platform videos go to `output/platform/showcase/`
- Use professional, confident tone — let the product speak
- Update homepage videos when capabilities change
- Hero video is the MOST important video in the system
- Never claim "AI-generated" is better — claim "verified" is better
