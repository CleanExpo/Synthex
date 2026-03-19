---
stepsCompleted:
  [
    'step-01-init',
    'step-02-discovery',
    'step-02b-vision',
    'step-02c-executive-summary',
  ]
inputDocuments:
  - '.planning/STATE.md'
  - '.planning/PROJECT.md'
workflowType: 'prd'
briefCount: 0
researchCount: 0
brainstormingCount: 0
projectDocsCount: 2
classification:
  projectType: saas_b2b
  domain: marketing_automation
  complexity: medium
  projectContext: brownfield
---

# Product Requirements Document - Synthex Creative Intelligence Suite (CIS)

**Author:** Synthex Team
**Date:** 2026-03-19

## Executive Summary

Synthex Creative Intelligence Suite (CIS) is a guided online presence platform for small and medium business (SMB) owners who lack the time, budget, or expertise to manage their own website health, Google Business Profile, and social media marketing. CIS removes the setup barrier — the single largest cause of SMB marketing tool abandonment — by auto-populating a business's profile from a URL health check, capturing their story through a conversational AI interview, and guiding them through an action-gated journey of small, verifiable wins.

The platform operates on a BYOK (Bring Your Own Key) model: clients connect their own API keys for AI, social platforms, and Google services. Synthex provides the orchestration layer, the guided journey, and the gamification engine. This model enables genuine $99/month pricing without cross-subsidising AI costs — a structural pricing advantage over all major incumbents.

The retention model is built into the onboarding: a first win must occur in session one. Subsequent engagement is driven by a Business Health Score (0–100, updated on each action), action-gated feature unlocks with celebration moments, and a weekly 15-Minute Monday brief. At 90 days, an auto-generated Story Replay becomes a shareable testimonial. Referral is built into the unlock system, making word-of-mouth a product mechanic rather than a marketing expense.

### What Makes This Special

- **URL-first entry:** Drop in a URL → instant public health check → system auto-populates brand profile, content seeds, and competitor gaps. No blank-slate problem. The public health check tool also functions as the top-of-funnel lead generation machine, converting cold visitors to $99/month signups without any ad spend.
- **Conversational story capture:** AI-guided interview (5–7 questions) synthesises the business narrative into website copy, Google Business Profile content, and social post seeds. The owner talks; the system writes.
- **BYOK pricing model:** Clients supply their own Google, social, and AI API keys. Synthex charges for orchestration and guidance only. Real $99/month pricing, not a subsidised loss-leader.
- **Action-gated progressive unlock:** Features start closed. Each verifiable action (connected account, first post, GMB verified) unlocks the next tier with a celebration moment. No time-gating; no overwhelm.
- **Business Health Score:** Single 0–100 metric replacing vanity stats. Shareable. Emotionally meaningful. The product's north star metric for both user and platform.

## Project Classification

| Field               | Value                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| **Project Type**    | SaaS B2B — multi-tenant marketing platform                                                          |
| **Domain**          | Marketing Automation / AI Content (unregulated)                                                     |
| **Complexity**      | Medium — brownfield feature addition on mature codebase (131 Prisma models, live at synthex.social) |
| **Project Context** | Brownfield — existing platform; CIS adds unified hub, guided journey, and gamification layer        |
