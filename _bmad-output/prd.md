---
stepsCompleted:
  [
    'step-01-init',
    'step-02-discovery',
    'step-02b-vision',
    'step-02c-executive-summary',
    'step-03-success',
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

## Success Criteria

### User Success

**Session 1 win (must occur in first sitting):**

- All GMB issues surfaced by health check are acknowledged and at least one is actioned (claimed, corrected, or queued for fix)
- Website critical errors identified and at least one fix initiated
- One social post created, scheduled, and queued for publishing
- Business Health Score moves visibly from baseline (e.g., 20 → 45+) within first session

**30-day success:**

- AI has learned the client's tone, industry, and posting preferences from interactions
- Content suggestions are tailored (not generic) — client can see the system "knows" them
- Cancellation friction is high: the system holds personalised data, history, and a growing Health Score the client would lose. Switching cost is built-in.

### Business Success

| Milestone                        | Target                                                  |
| -------------------------------- | ------------------------------------------------------- |
| Health check → paid conversion   | ≥60% of users who complete the full health check flow   |
| Month-2 retention (starter pack) | ≥50% remain paying after promotional period ends        |
| Paying client milestones         | 50 → 100 → 200 → 500 → 1,000 clients                    |
| North star metric                | Business Health Score average across all active clients |

### Technical Success

**Day-1 connectivity (MVP gates — nothing ships without these working):**

- GMB status capture: current profile completeness, open issues, review score
- Google Search Console: current rankings, crawl errors, indexed pages
- LLM connection: client's own AI API key accepted and working (BYOK)
- Social pages: at least 2 platforms connected and post-scheduling functional

**Performance:**

- Public health check returns results in ≤10 seconds
- Dashboard loads in ≤2 seconds on 4G connection
- BYOK key validation confirms connection in ≤5 seconds

### Measurable Outcomes

- Health Score increases ≥20 points in first 30 days for 70% of active users
- ≥1 social post scheduled per week per active client after day 7
- ≥80% of clients complete the full onboarding journey (reach first unlock)

## Product Scope

### MVP — Minimum Viable Product

1. Public URL health check tool (GMB, website errors, rankings, competitor snapshot)
2. Conversational story capture (AI interview → brand profile auto-population)
3. GMB connection + issue resolution workflow
4. Google Search Console connection + ranking dashboard
5. BYOK LLM setup wizard (step-by-step key connection)
6. Social platform connections (≥2 platforms) + post scheduling
7. Business Health Score (0–100, live-updating)
8. Action-gated progressive unlock with celebration moments
9. CIS Hub page (unified entry point to all connected tools)
10. AI personalisation engine (learns preferences from interactions over time)

### Growth Features (Post-MVP)

- 15-Minute Monday weekly brief (email/SMS)
- Story Replay at 90 days (auto-generated progress documentary)
- Referral-as-unlock mechanic
- Notification Centre slide-out
- Loyalty Tier Card (Bronze → Platinum)
- Competitor Watch (live tracking, not just onboarding snapshot)

### Vision (Future)

- 100 Remotion educational videos + in-product HelpVideo component
- Explainer video sales funnel (video-first onboarding path for cold traffic)
- Full GMB automated posting (Google Posts via API)
- AI auto-drafts weekly content calendar without prompting
