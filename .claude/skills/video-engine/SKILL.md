---
name: video-engine
description: >-
  Synthex AI Video Production Engine. Multi-tenant platform that generates
  explainer videos, feature walkthroughs, and promotional content from
  verified project data. Operates in Client Mode (for signed-in businesses)
  and Platform Mode (for Synthex's own marketing content).
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: core-skill
---

# Synthex Video Engine

## Purpose

Multi-tenant AI video production platform. Generates professional explainer
videos, feature walkthroughs, and promotional content for signed-in client
businesses from their real, verified project data. Also generates Synthex's
own marketing and showcase content for the landing page.

## Two Operating Modes

### Client Mode
A signed-in business requests videos about THEIR product/service.
- Engine scans their provided repo/data/website
- Generates videos from verified client data only
- Output: `output/clients/{client-slug}/`
- Billing: tracked per client against their plan

### Platform Mode
Synthex generates videos about ITSELF for marketing/homepage.
- Engine scans Synthex's own codebase and capabilities
- Generates showcase videos demonstrating what Synthex can do
- Uses real capabilities as proof (the engine demonstrates itself)
- Output: `output/platform/showcase/`

## When to Use

Activate this skill when:
- A client needs video content generated
- Synthex homepage needs showcase videos
- Video production pipeline needs orchestration
- Content verification is required

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    VIDEO PRODUCTION PIPELINE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  SCAN    │───▶│  SCRIPT  │───▶│  VERIFY  │───▶│ GENERATE │  │
│  │          │    │          │    │          │    │          │  │
│  │ • Repo   │    │ • AI     │    │ • Fact   │    │ • Imagen │  │
│  │ • URL    │    │   writes │    │   check  │    │ • Voice  │  │
│  │ • Upload │    │   script │    │ • Source │    │ • Assemble│ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                                                  │
│  Source Types:                                                   │
│  • repo   → Full codebase scan (developers, SaaS)               │
│  • url    → Website scraping (any business)                     │
│  • upload → File parsing (any business)                         │
│  • self   → Synthex scans itself (platform mode)                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Isolation

```
output/
├── platform/           ← Synthex's own marketing videos (ISOLATED)
│   ├── showcase/       ← Homepage videos
│   ├── scripts/        ← Video scripts
│   ├── clips/          ← Generated video clips
│   ├── voiceovers/     ← AI voice audio
│   ├── final/          ← Assembled final videos
│   └── usage/          ← Platform analytics
│
└── clients/            ← Multi-tenant client workspaces (ISOLATED)
    ├── {client-a}/     ← Client A's workspace
    │   ├── client.yaml ← Client config
    │   ├── manifest.json
    │   ├── scripts/
    │   ├── clips/
    │   ├── voiceovers/
    │   ├── final/
    │   └── usage/
    │
    └── {client-b}/     ← Client B's workspace (NO CROSS-ACCESS)
```

## Instructions

1. **Detect Mode**: Client request vs Platform request
2. **Scan Source**: Based on source type (repo/url/upload/self)
3. **Generate Script**: AI writes video script from verified data
4. **Verify Claims**: Fact-checker validates every claim against source
5. **Generate Media**: Imagen for visuals, ElevenLabs for voice
6. **Assemble**: Combine clips, voice, music into final video
7. **Deliver**: Output to appropriate workspace

## Rules

- ALL tasks route through video-director agent
- NEVER generate content from unverified data
- Client data is ISOLATED - never cross-reference between clients
- Platform mode can only reference Synthex's own capabilities
- Same verification gate applies to platform videos (no shortcuts)
- Budget tracked per client AND platform-wide

## Environment Requirements

- GEMINI_API_KEY (for Imagen image generation)
- ELEVENLABS_API_KEY (for voice generation)
- Python 3.10+ with requests library
- ffmpeg for video assembly
