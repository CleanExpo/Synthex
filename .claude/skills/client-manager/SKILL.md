---
name: client-manager
description: >-
  Manages the full client lifecycle within Synthex AI Agency.
  Handles onboarding (config generation from client input),
  data isolation between tenants, usage tracking, and billing.
  Ensures no client data bleeds into another client's workspace.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: platform-skill
  triggers:
    - client onboarding
    - tenant management
    - client config
    - data isolation
    - client billing
---

# Client Manager

## Purpose

Handles everything related to client tenancy within Synthex.
When a business signs in, this skill generates their workspace,
builds their project config dynamically, and enforces data
isolation throughout the production pipeline.

## When to Use

Activate this skill when:
- A new client signs up and needs onboarding
- Client config needs updating (new repo, rebrand, etc.)
- Usage/billing needs checking before generation
- Client data access needs verification (isolation checks)

## When NOT to Use This Skill

- When generating video content (use video-engine)
- When verifying factual claims in content (use truth-finder)
- When creating platform showcase videos (use platform-showcase)
- When generating AI images (use imagen-designer)
- Instead use: `video-engine` for video production, `platform-showcase` for marketing

## Instructions

1. **Onboard**: Collect client details → generate config + workspace
2. **Validate**: Verify client repo access and scan readiness
3. **Isolate**: Ensure workspace is sandboxed from other clients
4. **Track**: Log all API usage per client for billing
5. **Report**: Provide usage summaries on request

## Client Config Schema

```yaml
# Generated at: output/clients/{slug}/client.yaml
client:
  id: "cli_abc123"           # Unique client ID
  name: "Brisbane Plumbing Co"
  slug: "brisbane-plumbing-co"
  onboarded_at: "2026-03-15T09:00:00Z"
  plan: "starter"            # starter | professional | enterprise
  status: "active"

business:
  industry: "plumbing"
  location: "Brisbane, QLD"
  description: "Residential and commercial plumbing services"
  website: "https://brisbaneplumbing.com.au"

source:
  type: "repo"               # repo | url-scan | upload
  repo: "https://github.com/client/their-project"
  # OR
  type: "url-scan"
  urls:
    - "https://brisbaneplumbing.com.au"
    - "https://brisbaneplumbing.com.au/services"
  # OR
  type: "upload"
  files_dir: "output/clients/brisbane-plumbing-co/uploads/"

brand:
  voice_id: "professional-au"  # Voice selection
  tone: "professional-trades"
  audience_primary: "homeowners"
  audience_secondary: "property-managers"
  colours:
    primary: "#2563eb"
    accent: "#d4841c"
  logo_path: null

video_defaults:
  resolution: "1080p"
  aspect_ratio: "16:9"
  format: "mp4"

billing:
  plan: "starter"
  monthly_video_limit: 5
  videos_generated_this_month: 0
  total_videos_generated: 0
  api_spend_this_month: 0.00
```

## Source Types

### Repo scan (developer clients)
- Standard project-scanner flow
- Full skill/agent/UI/API discovery
- Richest video content

### URL scan (non-technical clients)
- Scrape their website for content, services, about page
- Extract service descriptions, team info, testimonials
- Generate videos from verified web content

### File upload (any client)
- Client uploads docs, images, brand assets
- Parse uploaded content for video material
- Most manual but works for any business

## Billing Tiers

| Plan | Videos/month | API Budget | Voice Options | Support |
|------|-------------|------------|---------------|---------|
| Starter | 5 | $40 | 1 standard | Self-serve |
| Professional | 15 | $120 | 3 custom | Email |
| Enterprise | Unlimited | Custom | Custom cloned | Dedicated |

## Data Isolation Rules

1. Each client gets: `output/clients/{slug}/`
2. NEVER read files from another client's directory
3. NEVER reference another client's data in scripts
4. NEVER include client data in platform showcase without explicit permission
5. Platform mode uses `output/platform/` — completely separate tree

## Guidelines

- Always check billing limits BEFORE starting generation
- Generate client config dynamically — never copy from another client
- Verify client repo/URL access before first scan
- Report "content gaps" to client during onboarding
- Australian English for all AU clients (default)
- Data retention: Client data kept for 12 months after last activity
