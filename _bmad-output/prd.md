---
stepsCompleted:
  [
    'step-01-init',
    'step-02-discovery',
    'step-02b-vision',
    'step-02c-executive-summary',
    'step-03-success',
    'step-04-journeys',
    'step-05-domain',
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

## User Journeys

### Journey 1: Sarah — The Dentist on Autopilot (Primary — Happy Path)

**Who she is:** Sarah owns a dental practice with 3 chairs and 2 staff. She's booked out 3 weeks in advance but her Google Business Profile hasn't been updated since 2022, her website has broken links she doesn't know about, and she hasn't posted on Instagram in 4 months. She's paying $2,800/month to a web agency that sends a monthly PDF report she never reads. She heard about Synthex from another dentist at a conference.

**Opening Scene:** Sarah types her practice website URL into the Synthex health check at 10pm on a Tuesday after clinic closes. She's on her phone. Within 8 seconds she sees: Business Health Score 34/100. 7 GMB issues. 3 broken links. Her top competitor (3 suburbs away) scores 71. She feels a sting of recognition — she knew it was bad, but she didn't know how bad.

**Rising Action:** She clicks "Fix this for $249/month." Connects her Google account. Synthex pulls her GMB data, her Search Console rankings, and her existing website content automatically. An AI interview asks her 6 questions: _"What makes your practice different?" / "Who's your favourite type of patient?" / "What would you want a new patient to know before their first visit?"_ She types casual, honest answers in 4 minutes. Synthex generates her brand voice, a bio, and 3 social post drafts from her words.

**Climax:** Her Health Score jumps to 58. A green "First Win" card appears: _"Your GMB hours are now correct and your top 3 photos have been optimised. 73% of patients check Google before booking — you just improved your first impression."_ She screenshots it and sends it to her practice manager.

**Resolution:** Sarah checks in every Sunday for 10 minutes. She approves 2 posts, skips 1, adds a note about a new whitening special. The system posts at optimal times while she's with patients. At 90 days her score is 74. She's spent $249, not $4,300. She refers her physiotherapist neighbour.

**Requirements revealed:** GMB auto-repair workflows, health score live update, social post approval queue, brand voice capture, mobile-first dashboard, referral mechanic.

---

### Journey 2: Dave — The Tradie Who Nearly Quit (Primary — Edge Case / Recovery)

**Who he is:** Dave runs a plumbing business. His wife set up the Synthex account 3 weeks ago, got to the "Connect Google Search Console" step, didn't know what that was, and stopped. Dave has received 3 "15-Minute Monday" briefs since then, all saying the same thing: _"You're 1 step away from unlocking your ranking dashboard."_ Tonight he finally clicked.

**Opening Scene:** Dave is in his ute at 6:45am before his first job. He opens the email on his phone. The Monday brief shows his Health Score is still stuck at 29. It shows his competitor's Google listing with 47 reviews vs his 12. That's the motivator.

**Rising Action:** He taps "Complete this step." Synthex shows a 3-step guide with screenshots: _"Go to search.google.com/search-console → Add property → Copy this code."_ Dave follows it in 6 minutes. The system immediately pulls his ranking data. He sees he's ranking #1 for "emergency plumber [suburb]" but not appearing for "plumber [suburb]" — a huge gap. His Health Score unlocks to 51 and the ranking dashboard feature opens.

**Climax:** Synthex auto-generates a Google Business post targeting the missing keyword, pre-approved for him to publish in one tap. He taps publish. First post. First keyword-targeted content. He didn't write a word.

**Resolution:** Dave's wife now does the Sunday 10-minute check-in. Dave sees the results on his phone. He doesn't need to understand algorithms — the system does. He cancelled the $180/month SEO "retainer" he was paying someone on Gumtree who never explained what they were doing.

**Requirements revealed:** Progress-gated Monday brief, stalled-setup detection, step-by-step platform connection guides with screenshots, single-tap post approval, competitor ranking comparison.

---

### Journey 3: The Synthex Admin — Spotting Churn Before It Happens (Internal Ops)

**Who they are:** The Synthex ops/support team member reviewing the client dashboard. Not a developer — uses a simple admin interface.

**Opening Scene:** Monday morning. The admin dashboard shows 3 clients with Health Scores that dropped more than 10 points in the last 7 days. One is a café owner whose Google account disconnected (expired OAuth token). One is a barber who hasn't logged in for 19 days. One is an online seller whose last social post was 3 weeks ago.

**Rising Action:** The admin triggers a personalised "we noticed" re-engagement email for the barber. For the café owner, the system has already queued an automated token-refresh prompt. For the online seller, the admin flags them as "churn risk" and schedules a check-in call.

**Climax:** The café owner re-connects their account from the email prompt without needing support. The barber logs back in that evening after the re-engagement email. The online seller takes the call and reveals they've been on holiday — their account is fine.

**Resolution:** All 3 clients retained. The admin prevented 3 potential churns in 20 minutes without a developer or a CRM.

**Requirements revealed:** Admin churn-risk dashboard, Health Score trend monitoring, automated re-engagement triggers, OAuth token expiry detection, manual re-engagement tools.

---

### Journey 4: Marcus — The Cold Visitor Who Converts (Top of Funnel)

**Who he is:** Marcus owns a corner café. He Googled "how to improve my Google ranking" and found a Synthex blog post. There's a "Check your business health — free" button in the post. He clicks it.

**Opening Scene:** Marcus types his café URL. No account needed. 9 seconds later: Health Score 28/100. _"Your Google Business Profile is missing 4 key details that are costing you visibility. Your top 3 competitors in [suburb] average a score of 61."_ A competitor he recognises is listed by name with a score of 74.

**Rising Action:** Marcus reads the full report. 6 specific issues, each with a plain-English explanation of why it matters and what fixing it is worth (e.g., _"Complete GMB profiles get 7x more clicks — yours is 40% complete"_). At the bottom: _"Want us to fix all of this? $249/month. Setup takes one afternoon."_

**Climax:** He clicks sign up. The health check data pre-fills his onboarding — he doesn't start from zero. His score, his issues, his competitor gaps are already loaded. He's immediately in the "fix mode" flow.

**Resolution:** Marcus converts in the same session. The health check was both the marketing and the onboarding. He never saw a pricing page or a feature list — he saw his problem and the solution side by side.

**Requirements revealed:** Public health check (no login), report-to-signup conversion flow, pre-fill onboarding from health check data, competitor snapshot, plain-English issue explanations with business-value context.

---

### Journey 5: Julie — The Admin Who Runs It For The Boss (Delegated User)

**Who she is:** Julie is the receptionist at a physio clinic. The owner, Dr. Chen, set up Synthex during a quiet afternoon and then said _"Julie, can you just keep an eye on this?"_ Julie is not a marketer. She's organised, efficient, and has 20 minutes on Friday afternoons.

**Opening Scene:** Julie gets a Friday summary notification. _"3 posts ready to approve. Health Score unchanged at 67. One action available: add your Christmas hours to Google."_

**Rising Action:** Julie opens Synthex on her desktop. The 3 posts are already written — AI-generated from Dr. Chen's brand voice. She reads them, edits one slightly (changes "back pain" to "back issues" because Dr. Chen prefers that phrasing), approves all three. She updates the Christmas hours in 2 clicks.

**Climax:** All done. 11 minutes. She didn't need to know what hashtags to use, when to post, or how the Google algorithm works. The system handled everything — she just reviewed.

**Resolution:** Dr. Chen checks his score every Sunday from his phone. He sees it's at 72. He's never had to think about social media since signing up. Julie has never had to ask him what to post. The system has learned Dr. Chen's voice well enough that Julie rarely edits anything now.

**Requirements revealed:** Role-based access (owner vs. delegated user), approval workflow with edit capability, mobile view for owner / desktop for delegate, AI voice learning from edits and approvals, notification summary (not overwhelming detail).

---

### Journey Requirements Summary

| Capability                              | Journeys That Need It   |
| --------------------------------------- | ----------------------- |
| Public URL health check (no login)      | Marcus (J4)             |
| GMB auto-repair + issue workflow        | Sarah (J1), Marcus (J4) |
| Google Search Console connection guide  | Dave (J2)               |
| Brand voice capture (AI interview)      | Sarah (J1)              |
| Social post approval queue              | Sarah (J1), Julie (J5)  |
| Health Score live-updating              | All journeys            |
| Progress-gated Monday brief             | Dave (J2)               |
| Stalled-setup detection + re-engagement | Dave (J2), Admin (J3)   |
| Churn-risk admin dashboard              | Admin (J3)              |
| Role-based access (owner / delegate)    | Julie (J5)              |
| AI voice learning from edits            | Julie (J5)              |
| Report-to-signup conversion flow        | Marcus (J4)             |
| Competitor snapshot                     | Sarah (J1), Marcus (J4) |
| Mobile-first dashboard                  | Sarah (J1), Dave (J2)   |

## Domain-Specific Requirements

### Content Authenticity & Platform Fit

AI-generated content must never read as "AI slop." The system's content output quality standard is: indistinguishable from content a skilled human marketer would produce for that specific business. Key constraints:

- Long-form video (owner-recorded or stock) is the source asset; the system auto-adapts it into platform-optimised clips, captions, thumbnails, and posting formats per platform (TikTok vertical 9:16, Instagram Reels, YouTube Shorts, Facebook)
- Each platform adaptation respects that platform's native style, pacing, and audience behaviour — not a one-size crop
- Trend monitoring is a core system capability: the system must surface trending audio, formats, and topic angles relevant to the business's industry and apply them to content generation
- Posting times are AI-optimised per platform and per business audience, not generic defaults

### Compliance & Regulatory

- All national laws applicable to the client's jurisdiction apply (Australia as primary market; multi-region capability deferred)
- Data storage and handling is delegated to Supabase (third-party, SOC 2 compliant infrastructure)
- No bespoke data residency requirements at MVP; Supabase region selection satisfies baseline compliance
- Content posted via platform APIs must comply with each platform's Developer Policy and Community Standards — automated posting frequency limits must be respected

### Technical Constraints — Credential Security

Zero-knowledge model for critical credentials:

- Client API keys, OAuth tokens, and payment details are **never accessible to Synthex staff** — encrypted at rest via AES-256-GCM Vault (existing `lib/vault/`), org-scoped, no plaintext exposure
- Bank and credit card details handled exclusively by Stripe — Synthex never stores or touches payment card data (PCI DSS compliance via Stripe delegation)
- Internal team members have no access path to client API credentials or payment instruments

### Integration Requirements & Quota Awareness

- Google Business Profile API and Search Console API have per-project and per-user quota limits — clients must be educated to monitor their own Google Cloud Console quota usage
- Clients are responsible for maintaining valid OAuth authorisations; the system must detect token expiry and prompt re-authorisation clearly (not silently fail)
- Platform API rate limits (Meta, TikTok, LinkedIn, Google) must be respected; the system queues and schedules API calls within documented limits

### Risk Mitigations

| Risk                                     | Mitigation                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| AI content perceived as inauthentic      | Human approval gate on all posts before publishing; AI adapts to brand voice from real owner inputs |
| OAuth token expiry causes silent failure | Token expiry detection + immediate dashboard alert + re-auth prompt                                 |
| Platform API quota exceeded              | Queue-based posting with rate-limit awareness; client notification if queue is blocked              |
| Client cancels — data ownership          | Client data exportable on request; 30-day post-cancellation data retention then deletion            |
