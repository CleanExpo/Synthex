---
name: synthex-standards
description: >-
  Synthex Capability Uplift master reference. Contains the authoritative
  anti-patterns and replacement standards that override LLM defaults across
  ALL Synthex skills. ALWAYS read the relevant reference file before producing
  UI, content, chart, or code output. Activate on any visual, content, code,
  campaign, brand, analytics, or design task.
metadata:
  author: synthex
  version: '1.0'
  type: capability-uplift-master
  triggers:
    - design
    - ui
    - component
    - visual
    - content
    - campaign
    - post
    - code
    - route
    - api
    - database
    - query
    - chart
    - analytics
    - brand
    - typography
    - colour
    - color
    - layout
    - styling
    - image
    - prompt
context: fork
---

# Synthex Standards — Capability Uplift Master Reference

This skill overrides the LLM's baked-in default patterns with Synthex-specific
standards. Read the relevant reference file before producing any output.

## Reference Files

| Domain                                    | File                                | When to Use                      |
| ----------------------------------------- | ----------------------------------- | -------------------------------- |
| Visual design, typography, colour, layout | `references/aesthetic-standards.md` | Any UI / component / visual work |
| Charts, graphs, dashboards                | `references/data-viz-standards.md`  | Any data visualisation           |
| Content, voice, campaigns, posts          | `references/content-standards.md`   | Any content generation           |
| Code, API routes, database queries        | `references/code-standards.md`      | Any code production              |

## Core Principle

Every output-generating skill must explicitly name what it is NOT doing (the LLM
default) and what it IS doing (the Synthex standard). Generic is failure.
Specific is the standard.
