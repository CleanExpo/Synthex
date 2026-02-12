---
name: project-scanner
description: >-
  Website content scanner for non-repo clients. Scrapes client website pages
  to extract services, content, brand elements, and video-worthy material.
  Use when onboarding clients who don't have a codebase to scan, when
  extracting brand data from a live website, or when building a client
  manifest from URL-based sources.
metadata:
  author: synthex
  version: "1.0"
  engine: synthex-ai-agency
  type: platform-skill
  triggers:
    - scan website
    - client website
    - extract brand
    - url scan
    - website content
---

# Project Scanner

## Purpose

Scans client websites to extract services, content, brand colours, and
video-worthy material when no codebase or repo is available. Produces a
structured manifest that feeds into the video-engine and client-manager
workflows.

## When to Use

Activate this skill when:
- A new client has no repo/codebase — only a website URL
- Client onboarding requires brand extraction from a live site
- Video production needs verified content from client's web presence
- Service/feature discovery is needed for a client without structured data

## When NOT to Use This Skill

- When the client has provided a repo or codebase (scan the repo directly)
- When doing SEO analysis of a website (use seo skills)
- When generating video content (use video-engine after scanning)
- When managing client accounts or billing (use client-manager)
- Instead use: `client-manager` for onboarding workflow, `video-engine` for production

## Instructions

1. **Collect target URLs** from the client — homepage + key pages (services, about, features)
2. **Run the scanner** using `scripts/scan-website.py <url1> [url2] ... --output manifest.json`
3. **Review the manifest** — check verification status for each page
4. **Flag placeholders** — if placeholder content is detected, alert the client
5. **Extract services** — verify discovered services match client's actual offerings
6. **Extract brand colours** — confirm colours align with client's brand guidelines
7. **Identify video candidates** — note service explainers and feature demos available
8. **Save the manifest** to the client's workspace: `output/clients/{client-slug}/manifest.json`
9. **Hand off to video-engine** — pass the verified manifest for content production
10. **Log the scan** — record URLs scanned, services found, and verification status

## Input Specification

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| urls | string[] | Yes | List of client website URLs to scan |
| output_path | string | No | Path for JSON manifest output |
| client_slug | string | Yes | Client identifier for workspace isolation |

## Output Specification

| Field | Type | Description |
|-------|------|-------------|
| manifest.json | JSON | Complete scan results with services, features, brand colours |
| verification | string | VERIFIED / PARTIAL / ERROR per page |
| video_candidates | object | Counts of service explainers and feature demos available |

## Error Handling

| Error | Action |
|-------|--------|
| URL timeout (15s) | Report timeout, skip URL, continue with remaining |
| HTTP error (4xx/5xx) | Log error, skip URL, note in manifest |
| No `requests` library | Exit with install instructions |
| Placeholder content detected | Mark page as PARTIAL verification |
| No services found | Flag for manual review — client may need different pages |

## Integration Points

- **client-manager** — Receives scan manifest during onboarding
- **video-engine** — Consumes verified manifest for content production
- **truth-finder** — Verification status aligns with confidence scoring
