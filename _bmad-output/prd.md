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
    'step-06-innovation',
    'step-07-project-type',
    'step-08-scoping',
    'step-09-functional',
    'step-10-nonfunctional',
    'step-11-polish',
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

The platform operates on a BYOK (Bring Your Own Key) model: clients connect their own API keys for AI, social platforms, and Google services. Synthex provides the orchestration layer, the guided journey, and the gamification engine. This model enables genuine $249/month Pro pricing (with a $99/month Promotional rate for the first two months) without cross-subsidising AI costs — a structural pricing advantage over all major incumbents.

The retention model is built into the onboarding: a first win must occur in session one. Subsequent engagement is driven by a Business Health Score (0–100, updated on each action), action-gated feature unlocks with celebration moments, and a weekly 15-Minute Monday brief. At 90 days, an auto-generated Story Replay becomes a shareable testimonial. Referral is built into the unlock system, making word-of-mouth a product mechanic rather than a marketing expense.

Five structural differentiators — URL-first onboarding, conversational story capture, BYOK pricing, action-gated progressive unlock, and the Business Health Score as retention lever — are detailed in the Innovation & Novel Patterns section below.

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

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Health-Check-as-Conversion-Engine**
The public URL health check is simultaneously a marketing tool, a lead-generation mechanism, and an onboarding pre-loader. No current marketing platform uses the diagnostic result itself as the sales page — the problem and the pitch are the same screen. This collapses the traditional funnel (awareness → interest → consideration → conversion) into a single moment.

**2. BYOK + Guided Orchestration at Consumer Price Points**
BYOK SaaS exists at the developer/enterprise tier (Vercel AI, AWS Bedrock). Applying it to non-technical SMB owners — with a guided wizard that abstracts all technical complexity — at $249/month is a novel positioning. The owner never knows they're "using an API key"; they just know their system works and they're not being overcharged for AI compute.

**3. Long-Form Video → Platform-Native Content Pipeline**
Existing tools (CapCut, Descript, Opus Clip) clip and caption long-form video. None combine that capability with: trend detection, platform-specific style adaptation, brand voice, business context, and a scheduled approval queue — all from a single source video. The innovation is the full pipeline, not any single step.

**4. Gamified Business Health as Retention Mechanic**
Using a single composite score (Business Health Score) as the product's core retention lever — not "posts published" or "followers gained" — is novel in the SMB marketing space. The score creates loss aversion (cancelling = losing your score history), social proof potential (shareable), and a clear north star that aligns user behaviour with platform value.

**5. Stalled-Setup Recovery as Designed Product Feature**
Most SaaS treats incomplete onboarding as a failure state to be fixed. Synthex treats it as an expected, designed journey moment — with the Monday brief as a re-engagement trigger tied to competitor comparisons (the strongest motivator for SMB owners). The "nearly quit" journey is a first-class product feature.

### Market Context & Competitive Landscape

Existing tools fall into two categories:

- **All-in-one social schedulers** (Buffer, Hootsuite, Later): No GMB, no website health, no AI content generation, no guided onboarding
- **Presence management platforms** (Yext, BrightLocal, Vendasta): Enterprise-priced, no social content creation, no AI-native generation, reseller-only distribution

Synthex CIS occupies the uncontested space between them — SMB-priced, AI-native, GMB + social + website in one guided journey.

### Validation Approach

| Innovation                      | Validation Method                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Health-check conversion rate    | A/B test health check CTA vs standard landing page — target ≥60% conversion from completed health check  |
| BYOK setup completion rate      | Track drop-off at each API connection step — target ≥80% completion of BYOK wizard                       |
| Video pipeline engagement       | Measure post approval rate — if owners approve >70% of AI-generated clips, pipeline quality is validated |
| Health Score as retention lever | Compare 90-day retention: clients who check score weekly vs. those who don't                             |

### Risk Mitigation

| Risk                                                                | Mitigation                                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| BYOK wizard too complex for non-technical owners                    | User testing with 5 SMB owners before launch; fallback: "Book a setup call" option at each step            |
| AI video clips feel generic / off-brand                             | Brand voice profile applied to all content; human approval required before any post publishes              |
| Health Score gaming (owners doing pointless actions to raise score) | Score algorithm weights outcomes (ranking improvement, review count) not just actions (connected accounts) |
| Competitor awareness causes discouragement not motivation           | Show competitor gap as opportunity ("You could rank here") not deficit ("You're losing")                   |

## Multi-Tenancy & Subscription Architecture

### Tenant Model

- One organisation per business owner — complete data isolation between tenants
- Tenant scoping applied at every database query (existing `organizationId` pattern in Synthex)
- Health check (pre-signup) operates outside tenant scope — public, session-less
- Post-signup: all data (brand profile, Health Score, connected accounts, post history, video assets) is org-scoped and non-portable between accounts

### Permission Matrix (RBAC)

| Role              | Access Level                                                                                                                    | Tier          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **Owner**         | Full access — settings, billing, all features, delegate management                                                              | Starter + Pro |
| **Delegate**      | Approve/edit posts, update GMB details, view Health Score — no billing, no settings, no API key management                      | Pro only      |
| **Synthex Admin** | Internal ops — churn dashboard, Health Score trends, re-engagement triggers — zero access to client credentials or payment data | Internal      |

Delegation is invite-based (owner enters delegate email → invite sent → delegate accepts → scoped access granted).

### Subscription Tiers

| Tier            | Price                  | Features                                                                                                                     |
| --------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Starter**     | $49/month              | URL health check, basic GMB, 1 social platform, Business Health Score, no delegation, no video, no BYOK                      |
| **Pro**         | $249/month             | Full platform — all integrations, Claude-assisted video pipeline, delegation, full analytics, all social platforms, BYOK LLM |
| **Promotional** | $99/month (months 1–2) | Pro at discounted rate — auto-upgrades to $249/month after 2 months                                                          |

Feature gating enforced server-side at API layer. UI reflects locked features with upgrade prompts — not hidden, just locked with clear upgrade path.

### Integration List

**Pro Pack — all required at launch:**

| Integration                 | Purpose                                                                  | API                           |
| --------------------------- | ------------------------------------------------------------------------ | ----------------------------- |
| Google Business Profile     | GMB health check, issue repair, posts                                    | Google My Business API v4     |
| Google Search Console       | Rankings, crawl errors, indexed pages                                    | Search Console API v1         |
| Meta (Facebook + Instagram) | Social posting, scheduling, analytics                                    | Meta Graph API v18+           |
| TikTok                      | Short-form video posting, trend data                                     | TikTok Business API           |
| LinkedIn                    | Professional audience posting                                            | LinkedIn Marketing API        |
| YouTube                     | Long-form video uploads, Shorts                                          | YouTube Data API v3           |
| Claude API (Anthropic)      | Video scripts, captions, brand voice, content generation, trend analysis | Anthropic Messages API — BYOK |
| Stripe                      | Billing, subscription management, promotional pricing                    | Stripe API (existing)         |

**Starter Pack — subset:** Google Business Profile (basic) + 1 social platform. No BYOK, no video, no delegation.

### Video Pipeline — Claude-Assisted

Claude AI (via client's own Anthropic API key — BYOK) powers the Pro video pipeline:

- **Script generation**: Claude analyses business profile, current trends, and target platform to write posting scripts from the owner's raw talking points
- **Caption + hashtag writing**: Platform-native captions per channel — TikTok casual, LinkedIn professional, Instagram conversational
- **Content repurposing**: Long-form source video → platform-optimised clips (Remotion rendering, existing `lib/remotion/` infrastructure)
- **Trend detection**: Claude surfaces trending formats and topics relevant to the business's industry
- **Approval queue**: All AI-generated content requires one-tap human approval before publishing — no autonomous posting

**Platform format targets:**

| Platform                 | Format             | Duration |
| ------------------------ | ------------------ | -------- |
| TikTok / Instagram Reels | 9:16 vertical      | 15–60s   |
| YouTube Shorts           | 9:16 vertical      | ≤60s     |
| YouTube (long-form)      | 16:9 landscape     | 3–15min  |
| Facebook / LinkedIn      | 1:1 square or 16:9 | 30–90s   |

### Implementation Considerations

- **Vault (existing):** AES-256-GCM org-scoped credential storage handles all OAuth tokens and BYOK API keys — no new credential system needed
- **Remotion (existing):** `lib/remotion/` compositions already built — CIS adds SMB-specific templates
- **Subscription gates (existing):** Stripe + plan-based feature gates already implemented — CIS adds Starter/Pro checks
- **Multi-tenant patterns (existing):** `organizationId` scoping across all routes — all new CIS routes follow same pattern
- **New required:** GMB API integration, Google Search Console integration, Business Health Score engine, action-gated onboarding wizard, Claude-assisted video pipeline

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Experience MVP — the first release must deliver a complete, emotionally satisfying experience for an SMB owner in a single afternoon session. The goal is not a subset of features; it is a complete guided journey from zero to first win. Every MVP item below is essential to that moment.

**Resource Requirements:** Full-stack developer(s) familiar with Next.js 15, Supabase, Prisma, Remotion, and the Google/Meta/TikTok API ecosystems. AI integration experience (Anthropic Claude API) required for video pipeline. Existing Synthex codebase covers auth, billing, vault, and multi-tenancy — no greenfield infrastructure needed.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:** All 5 journeys (Sarah, Dave, Admin, Marcus, Julie) are supported at launch.

**Must-Have Capabilities:**

| #   | Capability                                                          | Tier                    | Rationale                                 |
| --- | ------------------------------------------------------------------- | ----------------------- | ----------------------------------------- |
| 1   | Public URL health check (no login, ≤10s)                            | Both                    | Top-of-funnel + onboarding pre-loader     |
| 2   | Health check → signup conversion flow (pre-fill)                    | Both                    | Eliminates blank-slate problem            |
| 3   | GMB connection + issue repair workflow                              | Starter + Pro           | Session-1 win anchor                      |
| 4   | Google Search Console connection + ranking dashboard                | Pro                     | Competitive motivation                    |
| 5   | Conversational story capture (AI interview → brand profile)         | Both                    | Owner talks; system writes                |
| 6   | BYOK LLM setup wizard (Anthropic API key)                           | Pro                     | Enables all AI features                   |
| 7   | Social platform connections — Meta bundle (Facebook + Instagram)    | Starter (1) / Pro (all) | Broadest Australian SMB reach             |
| 8   | Post creation, scheduling, and one-tap approval queue               | Both                    | Weekly engagement mechanic                |
| 9   | Business Health Score (0–100, live-updating)                        | Both                    | North star metric + retention lever       |
| 10  | Action-gated progressive unlock + celebration moments               | Both                    | Gamification retention model              |
| 11  | CIS Hub page (unified dashboard entry point)                        | Both                    | Single home for all tools                 |
| 12  | Claude-assisted video pipeline (script → clip → caption → schedule) | Pro                     | Core Pro differentiator                   |
| 13  | Invite-based delegation (Owner + Delegate roles)                    | Pro                     | Julie persona — Friday 20-minute workflow |
| 14  | Stalled-setup Monday brief (automated re-engagement email)          | Both                    | Dave persona — recovers near-churners     |

### Post-MVP Features (Phase 2 — Growth)

- TikTok, LinkedIn, YouTube integrations (after Meta bundle proven)
- 15-Minute Monday brief (weekly summary SMS/push, beyond email)
- Story Replay at 90 days (auto-generated progress documentary)
- Referral-as-unlock mechanic (word-of-mouth built into gamification)
- Admin churn-risk dashboard (Health Score trend monitoring, re-engagement triggers)
- Competitor Watch — live ongoing tracking (not just onboarding snapshot)
- Notification Centre slide-out
- Loyalty Tier Card (Bronze → Platinum based on Health Score milestones)

### Phase 3 — Expansion (Vision)

- Full GMB automated posting (Google Posts via API, no human approval needed)
- AI auto-drafts weekly content calendar without prompting
- 100 Remotion educational videos + in-product HelpVideo component
- Explainer video sales funnel (video-first cold traffic onboarding)
- Agency/multi-account tier (one login managing multiple business orgs)

### Risk Mitigation Strategy

**Technical risks:**

- Video pipeline complexity (Remotion + Claude + 4 platform upload APIs): mitigated by shipping Meta bundle only at launch; TikTok/YouTube/LinkedIn unlocked in Phase 2 after pipeline is proven
- GMB API verification requirements: clients guided through Google Cloud Console setup with step-by-step screenshots; "Book a setup call" fallback at each step
- BYOK wizard completion rate: if <80% completion, introduce a "do it for me" concierge option (Phase 2)

**Market risks:**

- If health check → Pro conversion is below 60%: $49 Starter tier acts as the catch — converts cold visitors who aren't ready for $249, then upgrades them over time
- If SMB owners find video pipeline too complex: approval-only mode (no video upload required) always available; video is Pro enhancement, not Pro requirement

**Resource risks:**

- If development resources are constrained: cut Phase 1 items 12 (video pipeline) and 13 (delegation) — they are Pro-only and can launch as "coming soon" gates without breaking the core Starter journey
- Absolute minimum viable release: items 1–11 (health check through CIS Hub) constitute a shippable experience

## Functional Requirements

### Business Health & Discovery

- **FR1:** Visitor can submit a business URL and receive a Business Health Score (0–100) with itemised issues — no account required
- **FR2:** System can surface the top 3 local competitors for any submitted URL and display their Health Scores alongside the submitter's
- **FR3:** Authenticated user can view their Business Health Score updating in real time as actions are completed
- **FR4:** System can calculate Health Score from outcome-weighted signals (GMB completeness, ranking position, review count, post frequency) — not action counts alone
- **FR5:** User can share their Business Health Score as a standalone card (image or link)

### Onboarding & Story Capture

- **FR6:** Visitor completing the public health check can convert to a paid account with their health check data pre-loaded — no re-entry required
- **FR7:** New user can complete a conversational AI interview (5–7 questions) that generates their brand voice profile, business bio, and initial content seeds
- **FR8:** User can progress through an action-gated onboarding journey where each completed step unlocks the next capability with a visible celebration moment
- **FR9:** System can detect when a user's onboarding journey has stalled and trigger a targeted re-engagement communication referencing their specific stuck step and competitor comparison
- **FR10:** System can send a weekly progress brief to users containing last week's summary, one recommended next action, and one win highlight

### Google Presence Management

- **FR11:** User can connect their Google Business Profile account and view all open issues (incomplete fields, unanswered reviews, incorrect hours, missing photos)
- **FR12:** User can action individual GMB issues (correct hours, update description, respond to reviews, add photos) from within the platform
- **FR13:** User can connect their Google Search Console account and view current keyword rankings, crawl errors, and indexed page count
- **FR14:** System can generate a Google Business Post targeting a keyword gap identified from the user's Search Console data
- **FR15:** User can view a side-by-side ranking comparison against their top local competitor for their primary keywords

### Social Media Management

- **FR16:** User can connect social platform accounts (Meta, TikTok, LinkedIn, YouTube) and authorise posting permissions
- **FR17:** User can create a social post with text, media, and platform-specific settings from a unified compose interface
- **FR18:** User can schedule a post to one or multiple connected platforms at a specified date and time
- **FR19:** User can view, edit, approve, or reject AI-generated post drafts before any content is published
- **FR20:** System can suggest optimal posting times per platform based on the user's audience and industry
- **FR21:** User can view post performance analytics (reach, engagement, clicks) across all connected platforms from a single dashboard
- **FR22:** System can detect trending content formats and topics relevant to the user's industry and surface them as content suggestions

### AI Video Pipeline

- **FR23:** Pro user can upload a source video (long-form) and receive platform-optimised clip variants (9:16, 16:9, 1:1) generated automatically
- **FR24:** System can generate a posting script, caption, and hashtag set for each clip variant using the user's brand voice and current platform trends
- **FR25:** Pro user can review, edit, and approve generated video clips and captions before scheduling
- **FR26:** System can process video content using the user's own Anthropic API key (BYOK) — Synthex does not supply or bill for AI compute
- **FR27:** User can configure their BYOK API key (Anthropic, and optionally other providers) via a guided setup wizard

### Account & Access Management

- **FR28:** User can register, log in, and manage their account using Supabase authentication (email/password and OAuth)
- **FR29:** Pro user can invite a delegate by email and assign them an approval-only role scoped to their organisation
- **FR30:** Delegate can approve, edit, and reject post drafts and update GMB business details — with no access to billing, settings, or API keys
- **FR31:** User can select a subscription tier (Starter $49/month or Pro $249/month) and manage billing via Stripe
- **FR32:** System can apply feature gates server-side based on subscription tier — locked features are visible with upgrade prompts, not hidden
- **FR33:** User can view and manage all connected platform OAuth authorisations and revoke any connection
- **FR34:** System can detect expired or revoked OAuth tokens and alert the user with a re-authorisation prompt before silent failure occurs

### Content & Brand Intelligence

- **FR35:** System can maintain and refine a brand voice profile for each organisation, learning from the user's edits and approvals over time
- **FR36:** User can view and edit their brand voice profile (tone, style, key phrases, topics to avoid)
- **FR37:** System can generate social post drafts, GMB posts, and video scripts consistent with the organisation's brand voice profile
- **FR38:** User can provide context updates (new product, promotion, seasonal change) that the system incorporates into subsequent content generation

### Admin & Operations (Internal)

- **FR39:** Synthex admin can view a dashboard showing all client organisations' Health Score trends, last-login dates, and connection status
- **FR40:** Synthex admin can flag a client as churn risk and trigger a manual or automated re-engagement workflow
- **FR41:** Synthex admin has zero access to any client's API keys, OAuth tokens, or payment instrument details

## Non-Functional Requirements

### Performance

- **NFR1:** Public health check returns a complete Business Health Score and issues list within ≤10 seconds for any submitted URL
- **NFR2:** All dashboard pages load within ≤2 seconds on a 4G mobile connection
- **NFR3:** BYOK API key validation (test connection) completes within ≤5 seconds
- **NFR4:** Post scheduling and approval queue updates reflect in real time (≤1 second) without requiring a page refresh
- **NFR5:** Video clip generation (Remotion rendering) completes within ≤5 minutes per clip; user receives a progress indicator — no silent hanging

### Security

- **NFR6:** All client API keys, OAuth tokens, and BYOK keys are encrypted at rest using AES-256-GCM and stored in the org-scoped Vault — no plaintext exposure at any layer
- **NFR7:** Synthex staff and internal systems have zero read access to client credential data — enforced by architecture, not policy alone
- **NFR8:** Payment card data is never stored or processed by Synthex — delegated entirely to Stripe (PCI DSS compliance via Stripe)
- **NFR9:** All data in transit is encrypted via TLS 1.2+ — no unencrypted API calls to or from connected platforms
- **NFR10:** Session tokens use httpOnly, Secure cookies — no JWT stored in localStorage or accessible to JavaScript
- **NFR11:** All mutation API routes require Zod validation, authentication, and org-scoped queries — no cross-tenant data access possible
- **NFR12:** OAuth token expiry is detected proactively (before a publishing failure) — clients are alerted at least 24 hours before a scheduled post would fail

### Scalability

- **NFR13:** The platform supports growth from 50 to 1,000 paying clients without architectural changes — Vercel serverless + Supabase connection pooling handles this range
- **NFR14:** The public health check tool supports concurrent usage by cold traffic without degrading response times — implemented as an edge function or isolated serverless route
- **NFR15:** Video pipeline rendering is queued — burst demand from multiple Pro users does not block the approval queue for others
- **NFR16:** Database queries are org-scoped and indexed on `organizationId` — query performance does not degrade as tenant count grows

### Accessibility

- **NFR17:** All dashboard and public-facing pages meet WCAG 2.1 AA contrast requirements — minimum 4.5:1 for normal text, 3:1 for large text
- **NFR18:** All interactive elements are keyboard-navigable with appropriate ARIA labels — the approval workflow (FR19) must be fully operable without a mouse
- **NFR19:** The mobile dashboard is fully functional on screens ≥375px width — no horizontal scrolling, touch targets ≥44px

### Integration Reliability

- **NFR20:** Platform integration failures (GMB, Search Console, Meta) surface a clear, actionable error message — never a generic error or silent failure
- **NFR21:** The system retries failed API calls to connected platforms up to 2 times with exponential backoff before surfacing an error to the user
- **NFR22:** Connected platform OAuth tokens are refreshed automatically when possible — manual re-authorisation is only required when the platform revokes access
- **NFR23:** All integrations comply with their respective platform developer policies — posting frequency limits and API quotas are enforced before calls are made, not after

---

_Document complete. 41 Functional Requirements · 23 Non-Functional Requirements · 5 User Journeys · MVP / Growth / Vision scope defined. Next: implementation planning._
