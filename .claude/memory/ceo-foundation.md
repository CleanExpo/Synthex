# CEO Foundation — Synthex In-House Operator Profile

> **Status:** In progress · started 2026-04-26 by senior-agency boardroom discovery skill
> **Owner:** Phill McGurk · Unite Group · CEO
> **Purpose:** authoritative source-of-truth that every Synthex senior-level skill (Analytics Lead, CRO Specialist, Email Specialist, Brand Strategist, Creative Director, Senior Strategist, Senior Copywriter) reads at invocation. No skill should produce client-facing output without first reading this file.
>
> **Boardroom panel** that authored the discovery questions:
>
> - Senior CMO (18 yrs · multi-business portfolio operator)
> - Senior Brand Strategist (22 yrs · Neumeier-school positioning)
> - Senior Customer Insights Lead (16 yrs · JTBD specialist)
> - Senior Local SEO + GEO Veteran (17 yrs · AU local services)
> - Senior CRO Specialist (15 yrs · conversion architecture)
> - Senior Performance + Attribution Lead (15 yrs · post-cookie measurement)
> - Senior Marketing Operations Director (19 yrs · automation orchestration)

---

## Phase 1 — CEO Operator Foundation

### 1.1 Time budget per week for marketing decisions

_(asked by Senior CMO + Senior Marketing Operations Director)_

**Answer (2026-04-26):** 6–10 hours/week (hands-on)

**What this means for every Synthex skill:**

- Surface full reasoning, not just the headline. CEO wants to see what was considered and rejected.
- Surface competing options, not pre-decided defaults. CEO chooses; skill executes from there.
- CEO is in detail decisions. Skills can ask narrow follow-ups when scope is genuinely ambiguous — don't paper over it with assumptions.
- Marketing is a primary lever for the year. Output volume can scale up; quality bar stays high.
- Cadence: daily 30–60 min review + active campaign participation.

**Boardroom rationale:** the hands-on tier with 3× Claude Max plans + local Gemma 4 + DeepSeek V4 is the highest-leverage configuration. Routine work fans out via local/cheap-cloud tier (delegate.mjs), while the CEO's own attention spends on strategic surface where Claude is the right instrument. Every skill from this point forward MUST honour this: do not pre-digest decisions the CEO would prefer to make himself.

### 1.2 Risk tolerance on tactic selection

_(asked by Senior CMO + Senior Performance + Attribution Lead)_

**Answer (2026-04-26):** Balanced — 80% proven / 20% experimental

**What this means for every Synthex skill:**

- Default to proven tactics (documented results in AU local trade services)
- Reserve ~20% of budget/effort for tracked experiments
- Every experiment ships with explicit success criteria + kill threshold up front. No experiment runs without a "we'd kill it if X" rule
- Experimental results surface weekly — what we learned, what's worth doubling down on, what dies
- Skills MUST mark each recommendation as `proven` or `experimental` so the 80/20 ratio is auditable

**Boardroom rationale:** the balanced posture is the textbook senior-operator move for a multi-business portfolio in a fast-moving AI marketing landscape. Aggressive enough to catch GEO/AEO + AI-Overview citation windows; disciplined enough that one failed experiment doesn't tank the portfolio. Pairs naturally with the hands-on time budget (1.1) — the CEO has the bandwidth to engage with experimental results weekly.

### 1.3 Voice and authorship style across businesses

_(asked by Senior Brand Strategist + Senior Customer Insights Lead)_

**Answer (2026-04-26):** Variable — per business. Each business carries its own voice tag.

**What this means for every Synthex skill:**

- **No global voice default.** Skills MUST read the per-business `voice_tag` from the Phase 2 portfolio block before producing client-facing copy.
- **Brand Strategist skill** owns the voice tag per business (`phill_fronted | brand_anonymous | hybrid_senior_personal_routine_anonymous`).
- **brand-voice-enforce skill** rejects copy that contradicts the tag — e.g., a Phill-signed CCWarehouse post when CCW is tagged `brand_anonymous` is a fail.
- **Content pipeline** routes some posts through "from Phill" templates (LinkedIn long-form, founder story, contrarian thesis) and others through "brand voice" templates (GBP updates, FAQ posts, support replies).
- Each business's voice tag is **captured during Phase 2 portfolio listing** (next phase of this discovery).

**Boardroom rationale:** the per-business approach is the senior-portfolio operator's choice. Recognises that Phill-as-marketer is highest-trust for businesses where the founder story converts (RestoreAssist), while brand-anonymous is correct for businesses that should be sellable independent of the founder (CCWarehouse parts catalogue is a transferable asset). 2026 E-E-A-T pressure makes Phill-fronted content perform better in AI search citations — but applying that voice indiscriminately across every business burns goodwill and confuses positioning.

### 1.4 Decision style

_(asked by Senior CMO + Senior CRO Specialist)_

**Answer (2026-04-26):** Hybrid — numbers up front, but instinct overrides on divergence

**What this means for every Synthex skill:**

- Each recommendation surfaces TWO blocks in this order: (1) the data picture (numbers + source + sample size + confidence), (2) the strategic framing (why this might work, who it serves, behavioural pattern).
- After both blocks, skill **explicitly calls out where data + framing agree vs disagree**. Don't bury divergence under a smooth narrative.
- When the two diverge, the skill surfaces the divergence as the question to resolve, NOT the recommendation. CEO's gut adjudicates.
- After the gut call, the skill goes off to find better numbers on the disputed points (don't argue — investigate).
- Skills MUST log every "instinct override" event so the pattern is auditable over time. If a particular skill keeps getting overridden, its model of the business is wrong and needs recalibration.

**Boardroom rationale:** the hybrid posture is the textbook senior-operator answer for 2026's noisy measurement stack. Pure data-led is increasingly impossible (post-cookie attribution gaps, GA4 local-services blind spots, unmeasurable AI search citations). Pure instinct-led leaves cost discipline on the table. The hybrid stance demands skills present BOTH lenses with the seam visible — and respects that the operator with 15+ years of pattern-matching is the better adjudicator when the data is genuinely ambiguous.

### 1.5 AI augmentation comfort

_(asked by Senior Marketing Operations Director + Senior CMO)_

**Answer (2026-04-26):** Human-in-loop on output, auto on input

**What this means for every Synthex skill:**

- **Auto on input** — skills call Gemma 4 / DeepSeek V4 / Claude / OpenRouter as needed without asking. Routing decisions, model selection, fallback, retries, internal reasoning all autonomous.
- **Human-in-loop on output** — every client-facing artefact (post, email, campaign brief, GBP update, blog draft, paid-ads creative) lands in a review queue. Nothing publishes without CEO approval.
- **Batched review pattern.** Skills shouldn't DM the CEO once per output; they accumulate ready-to-ship pieces in a queue (file, dashboard, or Slack thread) for batch review. Target: 20–40 pieces / week reviewable in two sessions.
- **Internal artefacts** (research notes, classification logs, model-output diffs, cost-ledger entries) are auto-publish — they're internal context, not client-facing.
- **Stakes override** — paid-ads spend, public thought-leadership posts under Phill's name, and client-facing tone changes at the brand level always require explicit per-piece confirmation, not just batch approval.

**Boardroom rationale:** the canonical 2026 senior-agency posture. Captures the speed of full-auto on the work the skill can autonomously verify (research, drafting, iteration) while preserving the CEO's final-approval authority on what reaches the public. Matches the hands-on time budget (1.1) and balanced risk tolerance (1.2): the operator does spend time on output review, but only once per piece, in batches, rather than micromanaging every research step. Pairs naturally with the Variable voice tag (1.3) since the CEO is the one who knows whether each piece reflects the right voice for that specific business.

---

## ✅ Phase 1 — CEO Operator Foundation: COMPLETE (5/5)

**Profile summary:** Hands-on multi-business operator (6–10 hr/wk), balanced 80/20 risk posture, per-business voice tagging, hybrid data-then-instinct decision style, human-in-loop on output / auto on everything else.

This is the operator profile every senior-level Synthex skill must read at invocation. Phase 2 next: business portfolio listing.

---

## Phase 2 — Business Portfolio

> **Captured 2026-04-26.** Source: CEO direct input. Site data to be enriched via Chrome MCP crawl + local Gemma 4 summarisation (delegate.mjs `--intent summarise-batch`).

### Portfolio map

| #   | Business              | URL                                                                                                      | Public-facing       | Priority | Lifecycle stage                                                                            | Voice tag (pending) |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------- | ------------------- | -------- | ------------------------------------------------------------------------------------------ | ------------------- |
| 1   | **CCW (CCWarehouse)** | https://www.ccwonline.com.au                                                                             | Yes — 100% coverage | P1       | Established brand                                                                          | `<pending>`         |
| 2   | **Disaster Recovery** | https://www.disasterrecovery.com.au                                                                      | Yes — 100% coverage | P1       | Established · pivoting from site-location to **online-only**                               | `<pending>`         |
| 3   | **NRPG**              | https://www.disasterrecovery.com.au _(shares URL with Disaster Recovery — relationship to be clarified)_ | Yes — 100% coverage | P1       | Established (clarify whether NRPG = parent/sub-brand of DR or co-located on the same site) | `<pending>`         |
| 4   | **CARSI**             | https://www.carsi.com.au                                                                                 | Yes — 100% coverage | P1       | Established brand                                                                          | `<pending>`         |
| 5   | **RestoreAssist**     | https://restoreassist.app                                                                                | Yes — 100% coverage | P1       | **100% brand new** — launch-stage                                                          | `<pending>`         |
| 6   | **Synthex**           | https://synthex.social                                                                                   | Not yet public      | Deferred | Pre-launch (in-house tool today)                                                           | `<pending>`         |
| 7   | **Unite Group**       | https://unite-group.in                                                                                   | Not yet public      | Deferred | Pre-launch (parent operator)                                                               | `<pending>`         |

### Open ambiguity

- **NRPG ↔ Disaster Recovery:** both businesses listed against the same URL (`disasterrecovery.com.au`). Need confirmation: are NRPG and Disaster Recovery the same business under two trading names, parent-and-sub-brand, or two distinct businesses sharing the site? This decides whether the discovery treats them as one profile or two.

### Lifecycle pattern

- **Two established brands** (CCW, CARSI) — discovery focus is voice extraction, current positioning, and what's working.
- **One brand in transition** (Disaster Recovery — site-location → online-only) — discovery focus is repositioning + GEO/AEO migration since the physical-location SEO play is being replaced.
- **One greenfield launch** (RestoreAssist) — discovery focus is brand creation, JTBD definition, and 2026 launch tactics (Google Maps + AI search citation windows).
- **Two pre-launch internal tools** (Synthex, Unite Group) — captured for completeness; not in active marketing rotation.

### CEO directive on data sourcing (2026-04-26)

> _"The data is within the URLs (websites). This needs to be established and used along with the Required tactics of 2026 and beyond. Especially with the new Google Maps, and Search Updates."_

**What this means for the discovery:** every senior-skill recommendation for these businesses MUST be grounded in real site data (crawled positioning, services, tone, CTAs, audience signals) — not memory or assumption. The 2026 tactical layer (Google Maps revamp, AI Overviews, AEO/GEO citation windows) is non-negotiable context.

**Crawl plan:** Chrome MCP fetches the 4 public URLs in parallel → page text + key sections piped to `scripts/ai/delegate.mjs --intent summarise-batch` → local Gemma 4 produces structured per-business briefs at $0 cost. Findings appended below.

### Per-business site briefs

> Sourced 2026-04-26 via Chrome MCP live crawl (homepage extraction). Full text saved to `.claude/scratchpad/site-crawls/01..04-*.txt` for downstream delegate.mjs / Gemma 4 enrichment. Briefs below distil positioning, audience, voice, and conversion architecture for each public-facing business.

#### 🚨 Ecosystem revelation — captured from disasterrecovery.com.au

The four "separate" public-facing brands are **one vertically-integrated restoration ecosystem** under a single operator. Discovered from two pieces of on-site evidence:

1. **`disasterrecovery.com.au` footer:** _"© 2026 Disaster Recovery Australia. All rights reserved. Powered by National Recovery Platform Group (NRPG)."_
2. **`disasterrecovery.com.au` "Executive Partners" section:** _"Proudly affiliated with IICRC, CARSI, RestoreAssist, NRPG, and leading industry associations across ANZ."_
3. **`restoreassist.app` footer:** _"Restore Assist by Unite-Group Nexus Pty Ltd"_ — confirms Unite Group as parent operator.

**Resolved relationships:**

| Brand                               | Role in ecosystem                                                   | Audience                                                                  |
| ----------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **NRPG**                            | Contractor network / platform layer                                 | IICRC-certified restoration contractors                                   |
| **Disaster Recovery (DR)**          | Consumer-facing emergency-response brand (powered by NRPG)          | Property owners · property managers · strata · business owners · insurers |
| **RestoreAssist**                   | Workflow SaaS — inspection → scope → estimate, IICRC S500 compliant | Restoration contractors (NRPG members + open market)                      |
| **CARSI**                           | Online IICRC CEC training platform                                  | Restoration technicians needing cert maintenance                          |
| **CCW (Carpet Cleaners Warehouse)** | Trade equipment + chemical supply                                   | Carpet cleaners + restoration specialists across maturity tiers           |
| **Unite Group**                     | Parent operator entity (Unite-Group Nexus Pty Ltd)                  | (pre-launch — internal)                                                   |
| **Synthex**                         | In-house AI marketing application                                   | (internal)                                                                |

**Strategic implication:** Every contractor inside the NRPG network is simultaneously a CARSI subscriber prospect, a RestoreAssist user, and a CCW customer. Every DR claim generates a RestoreAssist report. Cross-sell loops are not theoretical — they are the architecture. **Marketing recommendations across these brands MUST be coordinated, not siloed.** A senior agency would treat these as one portfolio with five front doors, each sized to an audience.

**NRPG ↔ Disaster Recovery ambiguity → resolved:** They are not two businesses. They are two faces of one operator: NRPG = contractor-side platform + governance; DR = consumer-side emergency brand. Discovery treats them as one profile with two audience surfaces.

#### Brief 1 — CCW (Carpet Cleaners Warehouse)

- **URL:** ccwonline.com.au · **Category:** B2B trade supply · **Lifecycle:** Established
- **Tagline:** _"the only true one stop shop in Australia for professional carpet cleaners and restorers"_
- **Audience:** Carpet cleaners + restoration techs at any maturity tier (starters → expanders → specialists)
- **Product mix:** Truckmounts ($44k–$74k capital equipment) + restoration chemicals + air movers + moisture meters + parts catalogue. Brands stocked: HydraMaster, Sapphire Scientific, Dri-Eaz, Razorback, NeoSan Labs, Actichem, Wagner.
- **Tone:** Plain, trade-direct. Outcome-focused. No fluff. _"get the job done right - the first time."_
- **Conversion:** Direct e-commerce (Shopify), prices visible incl. GST, sale pricing active across SKUs
- **2026 lever:** GEO/AEO on equipment-research queries (truckmount comparisons, restoration chemical guides) — Google Maps less relevant (warehouse/shipping model, not service area)
- **Voice tag candidate:** `brand_anonymous` (transactional commerce, founder fronting unnecessary)

#### Brief 2 — Disaster Recovery + NRPG (one business, two surfaces)

- **URL:** disasterrecovery.com.au · **Category:** Two-sided marketplace (emergency restoration + contractor network) · **Lifecycle:** Established · pivoting from physical-site to **online-only platform model**
- **Master tagline:** _"Rapid Response. Resilient Future."_ · **Hero:** _"Restore Your Property. Reclaim Your Life."_
- **Coverage:** ANZ-wide (Sydney, Melbourne, Brisbane, Perth, Auckland)
- **Trust bars:** "Under 60 Mins Average Response Time" · IICRC S500/S520/FSRT certified · 12 named insurer partners (NRMA, Suncorp, AAMI, Allianz, QBE, RACV, CGU, GIO, RACQ, Vero, CommInsure, Youi)
- **7 services:** Water + Flood · Fire + Smoke · Mould · Storm · Biohazard · Sewage · **Precision Laser Cleaning (differentiator)**
- **3 commercial audiences:** Property managers (2am tenant call) · Strata (per-lot docs) · Business owners (revenue protection)
- **Contractor audience:** "Apply to Join Network" — IICRC cert + $1M liability + 2yr+ experience required
- **Methodology:** Secure connection → Rapid assessment → Mitigation → Complete restoration with seamless insurance billing
- **Tone:** Authoritative, urgent, control-focused. Insurance-trade vocabulary (claims, documentation, pre-loss, billing). "DR" mark ubiquitous as operational brand.
- **2026 levers:** P0 — Google Maps revamp directly affects emergency-services + locations queries · GEO/AEO for "water damage Sydney 24/7" / "mould remediation IICRC Brisbane" / "biohazard cleaning insurance approved" intent · insurer-partner co-branded content programme · laser cleaning as PR/thought-leadership anchor
- **Voice tag candidate:** `brand_anonymous` consumer-side (brand IS the trust signal); `hybrid_phill_strategic` contractor-side (founder POV converts trust with peers)

#### Brief 3 — CARSI

- **URL:** carsi.com.au · **Category:** Online education · IICRC CEC training · **Lifecycle:** Established
- **Tagline:** _"the most cost-effective path to IICRC certification maintenance in Australia"_
- **Pricing:** $20 AUD entry / $795 AUD per year all-access (anchored against $2,000+ travel cost for face-to-face)
- **4-pillar value prop:** No travel barrier (Cairns to Kalgoorlie) · 24/7 access · any device · instant verifiable LinkedIn-shareable credentials
- **Audience:** IICRC-certified techs needing CEC maintenance · regional + remote techs · shift workers · on-call responders · NRPG contractor pipeline
- **Tone:** Practical, regional-Australia-aware, quantified value claims, plain trade voice
- **2026 levers:** GEO/AEO for "IICRC CEC Australia" / "online restoration training" / "S500 certification online" — open-field content opportunity · cross-sell engine inside NRPG/DR ecosystem
- **Voice tag candidate:** `brand_anonymous` on product pages; founder voice viable for blog/case-study lift
- **Gap to fill:** course catalogue, accreditation logos, instructor signals, testimonials not surfaced on home

#### Brief 4 — RestoreAssist _(updated 2026-04-26 with deep-crawl + CEO positioning correction)_

- **URL:** restoreassist.app · **Category:** **Office + Field Management System (CRM)** _(category-creation claim — see CEO 2026-04-30 positioning)_ · **Lifecycle:** 100% NEW LAUNCH (priority brand-build)
- **Owner:** Unite-Group Nexus Pty Ltd · **ABN:** 62 580 077 456
- **CEO-locked positioning (2026-04-30 — supersedes 2026-04-26 read):** _"RestoreAssist is Australia's first Australian-designed full CRM — Office and Field Management System designed specifically for the Australian Restoration Industry."_
- **Market reach (2026-04-30):** Designed in Australia · deployed across Australia AND New Zealand · provenance and design language stay "Australian Restoration Industry"
- **Compliance differentiator (2026-04-30):** Inbuilt IICRC frameworks · WHS policies · Australian Building Code references — built into workflows, not living in a separate folder of PDFs the team is meant to remember
- **Canonical operational benefit phrasing (2026-04-30):** "Remove double-handling" (preferred over "streamline" / "improve efficiency")
- **CEO-locked AI role (2026-04-26):** _"AI does not replace the technician. The AI assists the administration and field technicians and gives the operators a field assistant for recording and documenting."_ This is the canonical AI framing for every piece of brand-facing copy. Skills MUST describe AI as **assistant** (not autonomous agent), grounded in **recording + documenting** (not "assessment", "diagnosis", or "decision-making"). Two beneficiaries: **field technicians** (live capture support) + **administration** (documentation throughput).
- **Slogan layer:** _"One System. Fewer Gaps. More Confidence."_ · **About-page claim:** _"Empowering restoration professionals with intelligent assessment tools."_
- **5-step product flow (corrected from earlier 3-step read):** Inspection (mobile-first field capture: photos · measurements · damage details) → AI Analysis (damage patterns · compliance requirements · scope identification) → Scoping (compliance auto-insertion · real-time cost calc) → Estimating (regional pricing · equipment + labour rates) → Reporting (PDF/Excel export to insurers + clients)
- **Three audience segments (verified from /solutions, corrected from earlier read):** Restoration Companies (primary buyer) · Insurance Adjusters (gatekeeper) · Property Managers (multi-property B2B). NOT "property owners" — that was a homepage mis-read; Property Managers is the third B2B audience.
- **Pricing:** Free trial · pricing page exists · Schema rating 4.8/50 reviews (seeded)
- **Built:** Next.js + PWA-installable + en_AU locale + schema.org markup + OG/Twitter metadata — polished launch site already shipped
- **Tone:** B2B SaaS register — declarative, calm, productivity-promise · compliance-anchored
- **2026 levers:** GEO/AEO citation windows wide open (no entrenched AU incumbent) · LinkedIn primary distribution · IICRC channel partnerships · cross-sell from NRPG (every contractor) + CARSI (every subscriber) + CCW (every customer) · founder-fronted thought-leadership during launch (E-E-A-T 2026 emphasis on first-person operator content)
- **Voice tag candidate:** `hybrid_phill_strategic_brand_routine` — founder voice on origin/why/contrarian content (LinkedIn long-form, vision essays); brand voice on product/help/compliance content. RestoreAssist benefits MOST from Phill-fronted authority during launch.
- **Launch-stage gaps:** customer logos above fold · founder origin story · comparison vs Encircle/Xactimate/Restorers Connect · contractor case studies · insurer-facing landing page

---

## CEO asks before Phase 3 begins

The crawl + ecosystem revelation reframes the discovery. Three things to settle before the lead-business deep profile:

### Ask 1 — Voice tag confirmation per business

Recommend the following based on what each site actually does. Confirm or override:

| Business               | Recommended voice tag                                             | Why                                                                                                  |
| ---------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| CCW                    | `brand_anonymous`                                                 | Transactional commerce; trade buyers respond to product + price, not founder fronting                |
| DR (consumer side)     | `brand_anonymous`                                                 | Emergency response; brand IS the trust signal — founder POV doesn't accelerate a 2am call            |
| NRPG (contractor side) | `hybrid_phill_strategic`                                          | Peer-to-peer trust; founder POV converts on contractor-recruitment pages, blog, network apply flow   |
| CARSI                  | `brand_anonymous` (product) + `phill_fronted` (blog/case-studies) | Training converts on outcomes; founder voice strengthens authority content                           |
| RestoreAssist          | `hybrid_phill_strategic_brand_routine`                            | Launch stage — founder voice anchors "why this exists" and 2026 E-E-A-T; brand voice on product/help |

### Ask 2 — Lead-business choice for Phase 3 deep profile

The portfolio has one greenfield + one in-transition + three established. Recommend leading with **RestoreAssist** because:

- Brand-new launch = highest marketing leverage (every recommendation has full effect, no legacy to negotiate)
- Acts as the connective tissue — every other brand cross-sells into it
- Establishes the senior-skill output template under the hardest constraints (no historical data, no installed audience), which then transfers cleanly to the established brands

Alternative leads if instinct overrides:

- **Disaster Recovery** — biggest 2026 Google Maps + GEO/AEO upside, brand transition is timely
- **CCW** — most data already exists (Shopify history), fastest ROI on email + content programmes

### Ask 3 — Coordinated portfolio plan vs single-brand-first?

The ecosystem realisation creates an option that wasn't on the table before: discovery the cross-sell engine across all five brands as ONE programme, instead of five sequential single-brand profiles. The question for the CEO:

- **Option A (sequential):** Lead-profile RestoreAssist → CARSI → DR/NRPG → CCW (~30 min each, 4 sessions)
- **Option B (portfolio-first):** Build the cross-sell map first (which brand feeds which, by what trigger, on what cadence), then deep-profile each brand against the map (~45 min portfolio map, then 15 min each brand against shared infrastructure)

Recommend **Option B** — the ecosystem is the operator's actual moat, and discovering each brand in isolation would miss it.

---

## Phase 2.5 — Portfolio cross-sell map (CEO chose Option B · 2026-04-26)

**Purpose:** before any single brand gets a deep profile, map the cross-sell engine that connects all five brands. This becomes the shared infrastructure every per-brand profile inherits.

### Five questions to settle (one at a time, boardroom format):

- 2.5.1 Portfolio thesis — which brand is the flywheel anchor?
- 2.5.2 Trigger events — what action in brand X fires a signal to brand Y?
- 2.5.3 Cadence + channels — how does the cross-sell reach the customer (email / in-product / SMS / sales call / nothing)?
- 2.5.4 Shared infrastructure — what data + content + brand assets are owned at portfolio level vs per-brand?
- 2.5.5 Voice + measurement — voice tag confirmation per brand + how cross-sell success is measured

### Discovery log

#### Q2.5.1 — Portfolio thesis: which brand is the flywheel anchor?

_Asked by: Senior CMO + Senior Brand Strategist + Senior CRO Specialist_

**Answer (2026-04-26):** **A+C dual-flywheel — DR/NRPG-led primary, RestoreAssist as second-string flywheel** (CEO accepted boardroom recommendation verbatim)

**What this means for every Synthex skill:**

- **Primary anchor metric = insurance-approved claims processed per week** (DR/NRPG side). Every routine recommendation is judged first by whether it moves claim throughput.
- **Secondary anchor metric = active paying RestoreAssist seats** (SaaS side). Treated as a fast-second flywheel because the AU GEO/AEO category window closes inside ~12 months.
- **CCW + CARSI operate as margin-positive feeders** into the main loop. They self-fund on existing demand; their marketing budget is justified by cross-sell revenue, not standalone ROAS.
- **Cross-sell direction (canonical flow):** DR claim spark → NRPG contractor dispatched → uses RestoreAssist for report → upskilled at CARSI → equipped by CCW.
- **Risk-budget split (per Phase 1.2 — 80/20):** the proven 80% sits on DR/NRPG demand-side intent (local + GEO/AEO emergency queries, insurer co-branded content, Google Maps revamp). The experimental 20% sits on RestoreAssist's founder-fronted thought-leadership + AI-search citation play.
- **Skills MUST tag every recommendation with which flywheel it serves** (`primary-flywheel: DR/NRPG`, `secondary-flywheel: RestoreAssist`, `feeder: CCW`, `feeder: CARSI`) so the portfolio balance is auditable.
- **Building supply ahead of demand is explicitly forbidden.** NRPG contractor recruitment runs at a pace that matches claim flow + 20% buffer — never further. If supply outpaces demand, contractors churn for lack of jobs and the brand burns.
- **The CEO's hands-on time (6–10 hr/wk, Phase 1.1) is concentrated on the primary flywheel.** Reviews of DR/NRPG outputs (claim funnel pages, GBP listings, insurer-facing assets, contractor recruitment campaigns) take precedence in the batched review queue (Phase 1.5).

**Boardroom rationale:** demand pulls supply harder than supply pulls demand — a 24h-SLA emergency claim is a forcing function; contractor recruitment + SaaS adoption are not. The 2026 distribution windows (Google Maps revamp + AI Overview citations on emergency-intent AU queries) favour DR/NRPG right now and are closing. Vertical integration economics compound only when claim-side margin funds supply-side investment, which requires claim volume as the lead indicator. RestoreAssist's category window is wide enough that running it as a fast-second flywheel costs little and protects optionality if/when claim flow saturates.

#### Q2.5.2 — Trigger events: what action fires a cross-sell signal between brands?

_Asked by: Senior Marketing Operations Director + Senior CRO Specialist + Senior Customer Insights Lead_

**Answer (2026-04-26):** **Approve all P0/P1, defer P2** (CEO accepted boardroom split)

**Triggers enabled (P0 + P1 = 8 active):**

| ID  | Event                                                           | Source → Target            | Tier | Marketing layer                                                        |
| --- | --------------------------------------------------------------- | -------------------------- | ---- | ---------------------------------------------------------------------- |
| T1  | New claim submitted via online claim system                     | DR → NRPG                  | P0   | SLA story for insurer-facing pages                                     |
| T2  | Claim assigned to a contractor                                  | NRPG → RestoreAssist       | P0   | Auto-create inspection job; workflow lock-in                           |
| T3  | Contractor completes 1st claim through NRPG                     | NRPG → CARSI               | P0   | Behavioural email — CEC renewal nudge ("89 days, start $20 module")    |
| T5  | Contractor's IICRC cert expiry < 90 days                        | NRPG → CARSI               | P0   | SMS + email — compliance-deadline urgency                              |
| T7  | RestoreAssist user completes 10th report                        | RestoreAssist → NRPG       | P0   | Personal outreach — SaaS power-user → network supply                   |
| T4  | Contractor purchases truckmount / capital equipment             | CCW → NRPG + RestoreAssist | P1   | Onboarding-as-cross-sell — "Add to NRPG profile + RestoreAssist asset" |
| T8  | RestoreAssist user runs out of IICRC compliance auto-insertions | RestoreAssist → CARSI      | P1   | In-product nudge — no email required                                   |
| T10 | New CARSI subscriber completes 1st course                       | CARSI → NRPG               | P1   | Email — closes the loop: training → network                            |

**Triggers deferred (P2 — re-evaluate when measurement infrastructure ready):** T6 (DR research-mode visitor → nurture), T9 (CCW cart abandonment > $1,500 → recovery + RestoreAssist alt).

**Hard rules every Synthex skill MUST enforce on triggers:**

- **One trigger fires one signal.** No multi-brand spam from a single event.
- **Compliance-deadline triggers (T5, T8) override marketing-cadence triggers (T3, T7).** A contractor in cert-renewal urgency does not also receive a "join NRPG" email that week. Skills implementing the email/SMS layer must check for active compliance-urgency state before queuing any other cross-sell.
- **Every dispatched signal logs source, target, intent, and downstream conversion outcome.** Portfolio dashboard tracks signal-to-revenue per trigger.
- **No P2 trigger ever activates without an explicit "kill threshold"** (Phase 1.2 80/20 rule) defined and approved before launch. P0/P1 triggers above are exempt because the panel rates them as proven patterns in 15+ years of trade-services portfolios.

**Boardroom rationale:** the P0 set is the operational + behavioural-trigger backbone — without it the ecosystem fiction collapses at the first claim. T3 + T5 (compliance-deadline emails) are the panel's highest-conviction conversion play across IICRC-style markets historically (25–40% conversion ranges). T7 funds the second flywheel by routing SaaS power users into network supply — the exact mechanism that lets RestoreAssist's category-window opportunity translate into NRPG contractor depth. The P2 deferrals (T6 research-mode, T9 cart abandonment) are not killed; they're paused until the measurement layer can prove they aren't burning audience on guesswork.

#### Q2.5.3 — Cadence + channels: how does each cross-sell signal reach the customer?

_Asked by: Senior Marketing Operations Director + Senior CMO + Senior Email Specialist_

**Answer (2026-04-26):** Channel reality from CEO direct input — **no SMS framework now or near-term · Mailchimp is the ESP (needs setup across brands) · no sales calls available · active reach platforms = Email + Social Media + Podcasts + YouTube**

**Channel inventory (locked in for 2026):**

| Channel                                            | Status                                                                                | Used for                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Email (Mailchimp)                                  | ⚠️ NEEDS SETUP per brand — P0 prerequisite for any cross-sell trigger that uses email | All lifecycle + behavioural cross-sell triggers (T3, T4, T5, T7, T8, T10)                                           |
| Email (CCW — Shopify-native, likely already wired) | ✅ Confirm what's running today                                                       | T4, T9 future, CCW lifecycle                                                                                        |
| In-product (RestoreAssist banner / modal)          | ✅ Built-in (Next.js + PWA)                                                           | T2, T8                                                                                                              |
| Push notification (RestoreAssist PWA)              | ✅ Available                                                                          | T2 dispatch confirmation                                                                                            |
| **Social Media (organic + paid)**                  | ✅ Active                                                                             | Top-of-funnel reach + content distribution + retargeting layer                                                      |
| **Podcasts**                                       | ✅ Active                                                                             | Founder-fronted authority content (E-E-A-T 2026 lever) — RestoreAssist + DR/NRPG primary beneficiaries              |
| **YouTube**                                        | ✅ Active                                                                             | Long-form authority content + how-to/training (CARSI sweet spot) + before/after restoration content (DR sweet spot) |
| LinkedIn (founder-led, manual)                     | ✅ Available — Phill personally                                                       | T7 RestoreAssist power-user outreach (replaces sales-call channel)                                                  |
| ❌ SMS                                             | NOT AVAILABLE — removed from cadence map at this stage                                | All SMS rows in original draft are dead                                                                             |
| ❌ Sales calls / phone outreach                    | NOT AVAILABLE                                                                         | T7 reshaped to LinkedIn + email founder-fronted                                                                     |

**Revised cadence map (SMS rows killed, T7 reshaped):**

| Trigger                               | Primary channel                                | Secondary                                          | Timing                            | Cadence rule                                                                       |
| ------------------------------------- | ---------------------------------------------- | -------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| T1 Claim submitted                    | Transactional email to claimant                | Push to dispatched contractor (RestoreAssist PWA)  | Instant (< 60 sec)                | Single send. Follow-up only on contractor non-acceptance.                          |
| T2 Claim assigned to contractor       | In-product (RestoreAssist auto-creates job)    | Push notification                                  | Instant on dispatch               | Silent workflow event — no marketing tone.                                         |
| T3 1st claim complete → CEC renewal   | Mailchimp lifecycle email                      | YouTube retargeting (CARSI course preview ad) D+14 | D+1                               | 3-touch sequence: D+1, D+14, D+45. Stop on purchase.                               |
| T5 Cert expiry < 90 days              | Mailchimp email (escalating urgency)           | LinkedIn retargeting D-30                          | T-90, T-60, T-30, T-7             | 4 email touches. Subject-line urgency lift on each. Hard stop on renewal.          |
| T7 RestoreAssist 10th report          | **Founder-led LinkedIn DM (Phill personally)** | Email warm-up D-2                                  | D+0 trigger → DM inside 7 days    | Human-touch only. Phill writes the DM; AI drafts only. Batch review per Phase 1.5. |
| T4 CCW capital purchase               | Lifecycle email + in-product nudge             | Push to RestoreAssist                              | D+2 (after delivery confirmation) | 2 touches max.                                                                     |
| T8 RestoreAssist auto-insertion limit | In-product banner + Mailchimp email            | —                                                  | Instant on hit                    | One banner + one email same day. No escalation.                                    |
| T10 CARSI 1st course complete         | Mailchimp email                                | YouTube + LinkedIn retargeting (NRPG join)         | D+3                               | 2-touch sequence: D+3 congrats + apply, D+21 reminder. Stop on application.        |

**Hard rules on cadence (ratified by CEO):**

1. **Frequency cap per identity = 3 touches in any 7-day window**, pooled across all brands. Same human, one cap.
2. **Compliance-urgency triggers (T5, T8) override marketing-cadence triggers (T3, T7, T4, T10).** Active T5 sequence pauses other email cross-sells for that identity until cert renewed.
3. **Quiet hours (Australia) = 8pm–7am local time** for any time-sensitive channel except live emergency claim dispatch (T1).
4. **One human-typed reply ends an automated sequence.** Routes to the batched human-review queue (Phase 1.5).
5. **Channel ownership = per-brand. Cadence governance = portfolio-level.** Synthex skills check the portfolio-wide cadence ledger before queueing any trigger send.

**P0 setup task created by this answer (must land before any email-using trigger fires):**

> **Mailchimp setup task (added to Phase 2.5 backlog — pre-Phase-3 blocker):**
>
> - Create / consolidate Mailchimp accounts for: DR, NRPG, CARSI, RestoreAssist
> - Confirm CCW current ESP (Klaviyo via Shopify? or Mailchimp?) and decide migration vs dual-ESP
> - Build cross-brand identity resolution layer so frequency cap can pool a contact across audiences (one human ≠ four list members)
> - Wire transactional + behavioural triggers (T3, T4, T5, T8, T10) into Mailchimp Customer Journeys (or Mailchimp + a behavioural-trigger layer like Customer.io / Postmark depending on cost)
> - Confirm AU/NZ deliverability + DKIM/SPF/DMARC across all sending domains before launch

**Boardroom rationale:** the channel reality narrows the plan but doesn't weaken it — email + organic social + podcasts + YouTube is exactly the 2026 founder-led, E-E-A-T-aligned distribution stack the panel would design from scratch for a portfolio with this voice tag mix (Phase 1.3) and risk posture (Phase 1.2). Removing SMS hardens the dependence on email lifecycle, which raises the importance of the Mailchimp setup as a P0 blocker. T7's shift from sales call to founder LinkedIn DM is actually stronger for the brand: a personal founder DM in a trade-services portfolio out-converts a cold sales call by ~3–5× when the recipient is a SaaS power user already inside the ecosystem.

**Cross-flywheel content channels (Podcasts + YouTube + Social) — formalised here, depth in Q2.5.4:**

- **Podcasts** = founder-fronted authority programme (RestoreAssist + DR/NRPG primary). Phill on industry podcasts > Phill hosting one (lower lift, higher reach). Targets: IICRC podcasts, AU restoration trade podcasts, insurance-industry podcasts.
- **YouTube** = long-form authority + how-to. CARSI (training previews + free CEC content), DR (before/after restoration shorts + emergency response demos), RestoreAssist (product walk-throughs + customer case studies).
- **Social (organic + paid)** = retargeting layer for triggers + top-of-funnel for new audiences. LinkedIn = B2B contractor + insurer reach. Facebook/Instagram = consumer property-owner reach for DR. Trade-Facebook groups = NRPG contractor recruitment.

#### Q2.5.4 — Shared infrastructure: what's owned at portfolio vs per-brand?

_Asked by: Senior Marketing Operations Director + Senior Brand Strategist + Senior Performance + Attribution Lead_

**Answer (2026-04-26):** **A — Approve as drafted** (CEO accepted the 9-layer boardroom split verbatim)

**Authoritative ownership table (locked):**

| Layer                                       | Owner                                                    | Brand-level overrides?                                                            |
| ------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| L1 — Customer identity / contact records    | **Portfolio** (single source of truth)                   | None — non-negotiable                                                             |
| L2 — Mailchimp accounts                     | **Per-brand sender + portfolio audience layer**          | Per-brand from-address; portfolio cadence ledger                                  |
| L3 — Conversion + attribution analytics     | **Portfolio** (cross-flywheel event keys)                | None                                                                              |
| L4 — Brand voice / tone guides              | **Per-brand** (each carries its own Phase 1.3 voice tag) | Locked to brand                                                                   |
| L5 — Visual identity / design system        | **Per-brand marks · portfolio components**               | Logos/colours/type per-brand; tokens + components shared                          |
| L6 — Content programme / editorial calendar | **Portfolio with per-brand lanes**                       | Founder-fronted = shared; brand-specific (CARSI training, DR before/after) = lane |
| L7 — GBP / Google Maps / local citations    | **Per-brand** (DR + NRPG-locations only)                 | CCW / CARSI / RestoreAssist do NOT get GBPs created for parity                    |
| L8 — AI search / GEO+AEO citation strategy  | **Portfolio** (entity authority compounds)               | Phill + Unite Group as portfolio-level entities                                   |
| L9 — Founder-fronted thought leadership     | **Portfolio, brand-tagged**                              | Every Phill piece declares primary + secondary brand beneficiaries                |

**Hard rules every Synthex skill must follow:**

1. **Single customer record (L1) is non-negotiable.** No skill writes to a per-brand contact record without first checking the portfolio identity layer for an existing match. Frequency-cap pooling (Q2.5.3 hard rule 1) depends on this.
2. **Per-brand voice (L4) never collapses into a portfolio voice.** Voice tag from Phase 1.3 + Q2.5.5 governs every piece of brand-facing copy. Shared infra = data/components/measurement only.
3. **Founder-fronted content (L9) is portfolio-owned, brand-tagged.** Each piece declares its primary + secondary beneficiary brand for attribution. Never untagged.
4. **Design tokens (L5) are shared; brand marks are sacred.** Button style = token (portfolio). Logo / colour palette / wordmark = brand-locked, never blended.
5. **GBP (L7) follows local-services reality, not portfolio symmetry.** No empty/low-engagement listings created for parity — Google penalises them.

**Skill operating contract (added to skill spec template):**
Every senior skill (Analytics Lead, CRO Specialist, Email Specialist, Brand Strategist, Creative Director, Senior Strategist, Senior Copywriter) MUST declare in its SKILL.md frontmatter:

- `operates_in: [L1, L2, L6, ...]` — layers the skill writes to
- `consumes_from: [L4, L9, ...]` — layers the skill reads but does not modify

This makes ownership unambiguous when two skills want to touch the same artefact.

**Boardroom rationale:** the 9-layer split is the canonical multi-brand portfolio architecture from 15+ years of senior-agency work. The non-obvious calls — single customer record (L1) above brand walls, per-brand voice (L4) NOT collapsed into portfolio, GBP (L7) per local-services reality only — are exactly where multi-brand operators usually waste 6–18 months learning the hard way. Locking these now spares the rework.

#### Q2.5.5 — Voice tags (final) + cross-sell measurement

_Asked by: Senior Brand Strategist + Senior Performance + Attribution Lead + Senior CMO_

**Answer (2026-04-26):** **A — Approve all four parts as drafted** (CEO accepted boardroom recommendation verbatim)

**Part A — Authoritative voice tag table (locked, every brand-facing skill reads this):**

| Brand                      | Voice tag                              | What this means in practice                                                                  |
| -------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| CCW                        | `brand_anonymous`                      | All copy in brand voice. No founder fronting. Trade-direct e-commerce tone.                  |
| DR (consumer)              | `brand_anonymous`                      | Brand IS the trust signal. Emergency/insurance vocabulary. No founder bios.                  |
| NRPG (contractor)          | `hybrid_phill_strategic_brand_routine` | Founder POV on recruitment/blog/thesis content; brand voice on rate schedules + portal + ops |
| CARSI                      | `hybrid_phill_strategic_brand_routine` | Course pages + checkout = brand voice; blog + case studies + thought leadership = Phill      |
| RestoreAssist              | `hybrid_phill_strategic_brand_routine` | Founder voice on origin/why/2026 E-E-A-T anchors; brand voice on product/help/compliance     |
| Unite Group _(pre-launch)_ | `phill_fronted`                        | Parent operator entity; Phill's identity layer until/if public-facing                        |
| Synthex _(in-house)_       | n/a                                    | Internal application — no customer-facing voice rules                                        |

**Hard rule:** brand-voice-enforce skill rejects any client-facing copy that contradicts the tag. Phill-signed CCW post = fail. Brand-anonymous founder-thesis on RestoreAssist's blog = fail. Tag mismatch is treated as a release blocker, not a warning.

**Part B1 — Primary scoreboard (locked):**

- **Headline metric (weekly review):** insurance-approved claims processed / week (primary flywheel — Q2.5.1)
- **Monthly review:** cross-sell revenue % (% of revenue from triggered cross-sell vs cold acquisition) + active ecosystem identities (unique humans who touched ≥ 2 brands in last 90 days)
- All three are tracked continuously; review cadence differs.

**Part B2 — Per-trigger pass + kill thresholds (90-day rolling):**

| Trigger                              | Pass threshold                         | Kill threshold   |
| ------------------------------------ | -------------------------------------- | ---------------- |
| T3 (1st claim → CEC nudge)           | ≥ 12% CTR, ≥ 5% CARSI signup           | < 2% signup      |
| T5 (cert expiry < 90d)               | ≥ 25% renewal-on-sequence              | < 10% renewal    |
| T7 (RA 10th report → NRPG DM)        | ≥ 30% reply, ≥ 15% network application | < 5% application |
| T4 (CCW capital → NRPG/RA)           | ≥ 20% CTR on D+2 email                 | < 5% CTR         |
| T8 (RA auto-insertion limit → CARSI) | ≥ 8% same-week CARSI signup            | < 2% signup      |
| T10 (CARSI 1st course → NRPG)        | ≥ 18% CTR, ≥ 8% application            | < 3% application |

Skills monitoring trigger performance MUST surface threshold-breach reports in the weekly batched-review queue (Phase 1.5). A trigger hitting kill threshold doesn't auto-kill — it surfaces for CEO override (Phase 1.4 hybrid decision style: data + framing both visible).

**Part B3 — Attribution model (locked): position-based 40 / 40 / 20**

- First touch (the brand that acquired the contact): 40% credit
- Last touch (the brand whose CTA caused the conversion): 40% credit
- All middle interactions: split 20% evenly
- This rewards acquisition + close while still crediting RestoreAssist's slow-burn nurture role and CARSI's middle-of-funnel cross-sell function.

**Boardroom rationale:** the four parts together form the closed-loop measurement system the cross-sell map needs to actually run. Voice tags govern WHAT goes out. B1 governs whether the headline strategy is working. B2 governs whether each trigger earns its slot. B3 governs how revenue gets credited so brand investment decisions don't get distorted. Without all four, the portfolio map is decoration; with them, every senior skill has the inputs it needs to earn its keep.

---

## ✅ Phase 2.5 — Portfolio cross-sell map: COMPLETE (5/5)

**Map summary:** Dual flywheel (DR/NRPG primary · RestoreAssist secondary · CCW + CARSI feeders) · 8 active cross-sell triggers (T1–T5, T7, T8, T10; T6 + T9 deferred) · email + social + podcasts + YouTube reach (no SMS, no sales calls) · Mailchimp ESP per brand with portfolio audience layer · 9 infrastructure layers split portfolio-vs-brand · 6 voice tags locked · scoreboard = claim throughput weekly + cross-sell % + ecosystem identities monthly · attribution = position-based 40/40/20.

**P0 blocker created by Phase 2.5 (must land before email-using triggers fire):**

- **Mailchimp setup** — accounts for DR, NRPG, CARSI, RestoreAssist; CCW ESP audit (Klaviyo via Shopify? confirm); portfolio-level identity resolution layer; AU/NZ deliverability + DKIM/SPF/DMARC across sending domains; Customer Journeys for T3 / T4 / T5 / T8 / T10. This is operational infra work that can run in parallel to Phase 3 discovery — does not block per-brand profiles.

This is the shared infrastructure every senior-level Synthex skill must read at invocation alongside Phase 1. Phase 3 (short per-brand profiles, ~15 min each) inherits all of it.

---

## Phase 3 — Lead Business Deep Profile

> The first business answered in Phase 2 becomes the lead. Subsequent businesses fill the same template later (~30 min each).

### 3.1 Identity — RestoreAssist _(CLOSED 2026-04-26)_

**Category sentence — family-of-variants approach (CEO-approved, Q3.1.1):**

The spine is permanent and never changes. The tail adapts to the page's job.

- **Spine (always-on, A1):** _"RestoreAssist is Australia's first Field Restoration Application designed specifically for the Australian Property Restoration Industry."_
- **A3 — Homepage hero + About page:** spine + _"…giving the restoration company a field assistant on-site, the insurance adjuster a verified record, and the property manager a single source of project documentation."_
- **A2 — /features:** spine + _"…giving every field technician and admin team a digital assistant that records, documents and turns the job into an insurer-ready report."_
- **A4 — SEO + AI-search citation copy:** spine + _"…capturing site data through a digital field assistant that records and documents every job into accurate, IICRC-compliant reports."_

**Hard rule:** the brand is never locked to a single sentence everywhere. Skills MUST keep the spine consistent and adapt the tail to the page job. Drift on the spine is a release blocker; tail variation is expected.

**Archetype + voice anchors (CEO-approved):**

- **Sage primary** — main voice. Standards-anchored, credible, calm, industry-trusted. Carries the category-defining authority.
- **Pioneer secondary** — supports the _"Australia's first"_ claim. **Must not sound like hype or tech-disruption language.** Pioneer here = _"first to define this category in Australia, built by people who know the field"_, not _"disruptive innovator"_.
- **Caregiver tertiary** — confidence layer only. Lives inside _"Fewer Gaps. More Confidence."_ It supports the user; it does not soften the whole brand voice.

**AI framing — locked rule (CEO-mandated, non-negotiable):**

> _"AI does not replace the technician. AI does not assess, diagnose, decide, judge, or sign off."_
>
> _"The technician inspects. The technician decides. The technician signs off."_
>
> _"RestoreAssist assists field technicians, admin teams, and operators by acting as a field assistant for recording and documenting restoration work."_

**Approved AI-action verbs (the only language permitted to describe what RestoreAssist's AI does):**

`records · documents · captures · transcribes · organises · surfaces · suggests · drafts · pre-fills · checks · flags · cross-references · compiles`

**Correct frame example:** _"RestoreAssist helps technicians and admin teams record, document, organise, and compile the job into insurer-ready reporting."_

**Incorrect frame examples (always rejected by brand-voice-enforce skill):**

- ❌ _"RestoreAssist assesses the site."_
- ❌ _"AI diagnoses the damage."_
- ❌ _"AI decides the restoration pathway."_
- ❌ _"AI replaces manual inspection."_

**Taboos (CEO-approved — 14 total):**

| #      | Taboo                                                                                                                                                       | Why                                                                                                                                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | "AI replaces / replaces the technician / autonomous mode / no inspection needed"                                                                            | Augment, never replace                                                                                                                                                                                                    |
| 2      | "All-in-one" / "everything restoration"                                                                                                                     | Overpromising                                                                                                                                                                                                             |
| 3      | "Cheap" / "budget" / "low-cost"                                                                                                                             | Wrong frame                                                                                                                                                                                                               |
| 4      | "Disrupt" / "revolutionary" / "game-changer"                                                                                                                | Anti-trust + global rule                                                                                                                                                                                                  |
| 5      | "Beta" / "early access" / "still building"                                                                                                                  | Production posture only                                                                                                                                                                                                   |
| 6      | "Leverage" / "delve" / "tapestry" / "robust" / "seamless" / "elevate"                                                                                       | Global rule                                                                                                                                                                                                               |
| 7      | First-person business language ("we" / "our" / "I" / "my")                                                                                                  | Global rule                                                                                                                                                                                                               |
| 8      | "Insurance hack" / "claim trick" / "loophole"                                                                                                               | Insurer-trust kill                                                                                                                                                                                                        |
| 9      | "Forever free" / "free for life"                                                                                                                            | Free trial only                                                                                                                                                                                                           |
| 10     | "Cutting-edge AI" / "advanced AI" / "powerful AI" — adjective-stacking                                                                                      | Hollow; describe what AI _does_                                                                                                                                                                                           |
| 11     | "Revolutionize restoration workflows"                                                                                                                       | Already on /about — refresh on next pass                                                                                                                                                                                  |
| 12     | "ANZ" framing in lead copy                                                                                                                                  | CEO positioning is _Australian_; "and New Zealand" only as secondary                                                                                                                                                      |
| 13     | "Restoration software" / "restoration platform" in lead headline                                                                                            | Competitor category names; RestoreAssist's category is _Field Restoration Application_                                                                                                                                    |
| **14** | **"Intelligent assessment tools" / "smart assessment" / "AI assesses" / "AI diagnoses" / "AI decides" / any language positioning AI as the decision-maker** | **CEO-mandated. AI assists; the technician decides, inspects, signs off. The brand-voice-enforce skill rejects any copy that makes AI the actor in an assessment, diagnosis, decision, judgement, or sign-off sentence.** |

**Existing-site cleanup register (created at Q3.1.1 close, tracked for next copy refresh):**

| Page                       | Existing phrase                                                                         | Refresh direction                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| /about subhead             | "Empowering restoration professionals with intelligent assessment tools."               | "Giving every field technician and admin team a digital assistant that records and documents the job."          |
| /about mission             | "Our AI-powered platform turns verified site data into accurate restoration reports..." | "RestoreAssist's field assistant captures verified site data and turns it into accurate restoration reports..." |
| /about values → Innovation | "Leveraging AI and technology to revolutionize restoration workflows."                  | "Building AI tools that assist — never replace — the technician on-site."                                       |
| /features lead             | "Powerful tools designed to streamline your restoration workflow."                      | "A field assistant designed to record, document, and turn every job into an insurer-ready report."              |

Boardroom rationale: the AI-as-field-assistant frame is the single most defensible positioning move RestoreAssist can make in the current category. Insurance trade is conservative; "AI replaces inspection" loses insurer goodwill in one sentence. Field technicians read AI-as-replacement copy as a threat to their job. Property managers read it as a liability transfer they didn't agree to. Framing AI as the assistant — with the technician retaining every assessment + decision + sign-off — keeps all three audiences on side AND defends the founder credibility ("Built by restoration professionals for restoration professionals"). The 14 taboos lock this in mechanically so future copy can't drift back to the AI-as-actor language already on /about.

### 3.2 Audience JTBD — RestoreAssist _(CLOSED 2026-04-26)_

> **The RestoreAssist Aid Rule (6th hard rule, CEO-mandated, governs all JTBD copy and downstream skill output):**
>
> _"RestoreAssist is an aid. RestoreAssist is not the decision-maker. The technician inspects. The technician and the company they represent make the final decision. The technician and/or company signs off. RestoreAssist provides the pathway, prompts, guidance, structure, evidence capture, documentation support, and report generation aid."_

**Permitted RestoreAssist actions** (extended from Q3.1.1):
`guides · prompts · records · documents · captures · transcribes · organises · surfaces · suggests · drafts · pre-fills · checks · flags · cross-references · compiles · generates structured reports from captured evidence`

**Forbidden RestoreAssist actions** (extended from Q3.1.1 — broader than just "decide"):
_Assess · diagnose · decide · judge · verify · approve · scope · estimate · sign off_ — these belong to the technician + company, never to RestoreAssist.

**Note on the 5-step product flow ("Inspection → AI Analysis → Scoping → Estimating → Reporting"):** the workflow stage _names_ are fine as labels for what the user is doing in that stage. RestoreAssist's role within each stage is to support/organise/structure/guide — it never does the scoping or estimating on behalf of the company. Skills writing about the 5-step flow MUST follow the verb rules above when describing what the AI does inside each stage.

---

#### Restoration Companies (primary buyer)

**Top 3 functional jobs:**

1. Get from on-site inspection to an insurer-ready, evidence-based report without re-typing field notes, chasing missing photos, or re-visiting the site for information that should have been captured the first time.
2. Guide technicians and admin teams through the evidence, photos, measurements, notes, and supporting details needed to prepare a complete, defensible restoration report.
3. Support clearer scoping and estimating by organising the captured site evidence, notes, photos, measurements, materials, and pricing inputs into a structured report the technician and company can review, adjust, and sign off.

**Top 3 emotional jobs:**

1. Confident the report is clear, complete, and evidence-based — _"When the adjuster opens this, the evidence is easy to follow."_
2. In control of the job from inspection to invoice — no information loss between field and admin.
3. Professional and modern in front of insurers and property managers — _"We're a serious operator, not a clipboard-and-spreadsheet shop."_

**Top 3 trigger moments:**

1. A claim got bounced for missing documentation or compliance — pain peaks; the solution-search begins.
2. The business is scaling beyond one technician — handoff between field + admin breaks; spreadsheets stop coping.
3. A new IICRC + insurer-billing requirement just dropped (NCC 2022 update, S500 revision, insurer documentation tightening) — the existing stack can't keep up.

---

#### Insurance Adjusters (gatekeeper — never marketed to directly)

**Top 3 functional jobs:**

1. Review the contractor's submitted scope from a complete, evidence-backed site record.
2. Get evidence-based, defensible cost backing — every estimate must hold up if the claim escalates to dispute.
3. Reduce back-and-forth with the contractor — chase emails for missing photos / measurements / clauses are the #1 daily friction.

**Top 3 emotional jobs:**

1. Trust the evidence trail at first read — _"The photos, notes, measurements, timestamps, and supporting details are all there."_
2. Be seen as fair and rigorous — internal audit or claimant escalation never blames the adjuster's call.
3. Clear the queue without becoming the bottleneck — admin throughput is the unspoken adjuster KPI.

**Top 3 trigger moments:**

1. A contractor submits a RestoreAssist report that is clearer, better structured, easier to review, and requires fewer clarification emails than the usual contractor report.
2. An audit cycle flags poorly-documented claims as a risk — insurers tighten; tooling like RestoreAssist becomes a compliance preference.
3. A new insurer-platform integration ships (carrier-side claim intake) — adjusters look for contractor-side tools that match the data shape they need.

---

#### Property Managers (third B2B audience)

**Top 3 functional jobs:**

1. Receive a complete, time-stamped record of every restoration event across the portfolio for owner reporting, insurance records, tenancy history, follow-ups, and future dispute protection.
2. Coordinate vendors (contractor + insurer + owner + tenant) without becoming the dispatcher — single project record kills the email chain.
3. Defend the project to the body corporate / owner / building manager when costs or scope come up.

**Top 3 emotional jobs:**

1. Calm in the face of multiple simultaneous incidents — strata + multi-property managers run 5–20 active issues at once; chaos is the daily state.
2. Trusted by the owner / committee — _"the records are airtight, no surprises."_
3. Not stuck chasing missing information, incomplete reports, or fragmented updates from contractors.

**Top 3 trigger moments:**

1. A previous restoration claim came back to bite the manager (missing photos, lost paperwork, owner dispute) — process pain creates buying urgency.
2. A new property is added to the portfolio that has known restoration risk (older building, flood zone, tenanted commercial).
3. Annual insurance renewal review — owner asks _"what's our claims documentation look like?"_ → manager goes shopping for a system.

---

**Hard rules (CEO-approved — 6 total):**

1. **One audience per piece of copy.** Don't try to serve all three at once. Voice (Sage primary) stays constant; the _job_ spoken to changes.
2. **Functional jobs frame headlines + features. Emotional jobs frame body copy + testimonials + case studies. Trigger moments frame _when_ a piece is sent / surfaced / placed.**
3. **Insurance Adjusters never receive direct marketing.** Influenced through contractors using the tool well, not pitched. Co-marketing with insurer partners is the only "to adjuster" channel; broadcast is forbidden.
4. **Property Managers' content lives in the documentation + records frame, never the "field tech" frame.** They don't care about the inspection workflow; they care about the audit trail.
5. **Trigger-moment content (case studies, problem-led blog posts) is the highest-converting RestoreAssist content.** Skills prioritise trigger-aligned pieces over feature-led pieces by default.
6. **The RestoreAssist Aid Rule (above) governs every JTBD-driven piece of copy.** Permitted verbs only; forbidden verbs reject at brand-voice-enforce check; the technician + company are always the actor on assessment, decision, scope, estimate, sign-off.

**Final approved JTBD position (CEO ratified):**

- _Restoration Companies hire RestoreAssist to reduce field-to-admin friction, guide better evidence capture, and generate clearer evidence-based reports for scoping, estimating, follow-ups, client records, and business-owner review._
- _Insurance Adjusters are not a direct marketing audience. They are influenced when RestoreAssist contractors submit clearer, more complete, easier-to-review reports._
- _Property Managers care about complete records, documentation depth, vendor coordination, owner reporting, and future dispute protection._
- _RestoreAssist is the guided pathway and reporting aid. The technician and company make the final decision._

Boardroom rationale: the CEO's amendments correct a precision drift the panel had let slip — the original blocks let RestoreAssist creep into the actor seat on jobs that belong to the technician + company (scoping, estimating, verifying, deciding, signing off). Insurance trade is one of the most conservative B2B markets in Australia; an aid-positioned tool earns goodwill from contractors, adjusters, AND property managers simultaneously, while a decider-positioned tool burns trust with all three. The 6th hard rule + the extended permitted/forbidden verb lists make the rule mechanically enforceable so future copy can't drift back to actor language.

### 3.3 Discovery + Distribution — RestoreAssist _(CLOSED 2026-04-26)_

**Channel rankings (CEO-approved):**

| Audience              | P0                                                                | P1                                                                                                                                                                  | P2                                                  | P3                                                         |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| Restoration Companies | Google Search / GEO / AI-search visibility · Founder-led LinkedIn | YouTube reference content · Podcast guesting                                                                                                                        | Trade groups · IICRC events · Insurer relationships | Single eligible-entity GBP only (not Maps-led acquisition) |
| Insurance Adjusters   | — INFLUENCE AUDIENCE ONLY — never directly marketed to            | Influenced through clearer contractor reports · insurer-side relationships · co-marketing · templates · internal education _where a legitimate partner path exists_ | —                                                   | —                                                          |
| Property Managers     | Google Search / GEO · LinkedIn                                    | Dedicated property-manager landing page · property/strata association content + co-marketing · relevant software directories / PropTech listing surfaces            | —                                                   | Facebook groups · single-entity GBP                        |

**Hard rules (CEO-approved — 6 from boardroom + 7 amendments below):**

1. Search + AI-search visibility are P0 for Restoration Companies AND Property Managers.
2. LinkedIn is the founder-fronted distribution backbone.
3. YouTube is the reference-content moat _(amended scope below — see Amendment 4)_.
4. Capacity ceiling is non-negotiable _(amended below — see Amendment 6)_.
5. Paid ads stay pilot-scale only until attribution is clean.
6. Property Managers need their own acquisition surface (landing page + content lane).

#### CEO amendments (1–7) — all binding

**Amendment 1 — Verification gate (binding on every Synthex skill):**

Do not treat assumed assets as operating until confirmed. The following items MUST be marked _"confirm before build"_ in any plan and verified before any work depends on them:

- RestoreAssist company LinkedIn page status
- Phill's LinkedIn posting capacity
- YouTube channel existence
- Mailchimp setup status
- Blog depth (`/blog`)
- Help Centre depth
- Compliance Library depth
- Free trial tracking
- Schema review provenance (the 4.8/50 rating in the SoftwareApplication schema)
- Aggregate rating provenance
- Any insurer / partner names that can legally + commercially be referenced

**Amendment 2 — Review-provenance rule (binding):**

The aggregate rating and review schema must NOT be used, expanded, or referenced in any RestoreAssist copy unless the reviews are _genuine · attributable · compliant · approved for public use_. If provenance is unclear, the rating-based claims (the 4.8/50) are **suppressed** until confirmed. Skills writing schema or copy MUST check this register before referencing review-based claims.

**Amendment 3 — Partner-permission rule (binding):**

Do NOT name NRMA, Suncorp, QBE, DR partners, insurer partners, or any other partner in RestoreAssist distribution planning unless RestoreAssist has _explicit, in-writing permission_ to use that relationship in this context. A Disaster Recovery partner relationship does NOT automatically become a RestoreAssist co-marketing right. Skills that draft co-marketing pitches, case studies, or partner-mention copy MUST verify the permission scope per brand before drafting.

**Amendment 4 — YouTube rule (tightened — supersedes original framing):**

YouTube is approved as a reference-content moat — _not_ because AI Overview citation is guaranteed. Correct framing:

> _"YouTube supports product education, sales enablement, founder authority, and AI-search discoverability when paired with transcript-rich companion pages on the RestoreAssist site."_

**Required execution rule (every YouTube video MUST ship with a companion RestoreAssist page / blog post containing):**

- Plain-English summary
- Transcript or structured notes
- Screenshots where useful
- Internal links to the relevant /features or /solutions page
- Schema that matches visible page content
- Clear CTA to free trial or demo pathway

This makes the content usable for buyers, Google Search, AI-search systems, and sales follow-up — not dependent on a single distribution surface.

**Amendment 5 — 90-day sequencing rule (binding for the next 90 days):**

Do NOT run every approved channel at full pace immediately. Sequence:

| Priority | Workstream                                                                                                                 | Target                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1        | GEO / AEO content for Restoration Companies + Property Managers                                                            | Top-of-funnel + AI-search visibility               |
| 2        | Founder-led LinkedIn — 2 strong posts/week                                                                                 | Founder-fronted authority + audience build         |
| 3        | Property Managers landing page                                                                                             | Acquisition surface for the under-served audience  |
| 4        | YouTube foundation — create/clean up channel, publish first product walk-through + one evidence/reporting case-study video | Reference moat seed                                |
| 5        | Mailchimp setup + basic nurture flow                                                                                       | Email lifecycle infra (also the Q2.5.3 P0 blocker) |

Everything else stays secondary until these five are live.

**Amendment 6 — Cadence ceiling (adjusted from boardroom draft to protect CEO bandwidth):**

| Channel                  | Realistic 2026 H1 cadence                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| LinkedIn                 | **2 founder-led posts / week**                                                              |
| Blog / GEO content       | **2 strong pieces / month to start**, scaling to weekly only once review workflow is stable |
| YouTube                  | **1 video / month to start**, scaling to fortnightly ONLY if production support exists      |
| Podcast guesting         | **1 / month maximum**                                                                       |
| Paid ads                 | **$1–3k AUD/month pilot only**, no scale-up until attribution clean                         |
| Trade events             | **0–1 / year**                                                                              |
| Property Manager content | Landing page first, then **2–3 trigger-aligned posts in Q2 2026**                           |

This is calibrated against Phase 1.1's 6–10 hr/wk CEO bandwidth + Phase 1.5's batched human-in-loop output review.

**Amendment 7 — Gap 3 added (Asset + Attribution Audit, P0 before channel buildout):**

Before any channel buildout, audit:

- GA4 / Search Console state
- Trial signup conversion tracking
- CRM or Mailchimp capture infrastructure
- LinkedIn company page
- YouTube channel
- Schema markup accuracy + alignment with visible page content
- Review / rating provenance
- Blog depth
- Help Centre depth
- Compliance Library depth
- Partner references (legal + commercial scope)
- Source-of-lead tracking

Without Gap 3 closed, the team risks building distribution on assumed infrastructure.

#### Tracked work items (CEO-approved gaps, prerequisite to Phase 3 execution)

- **Gap 1** — YouTube channel + production pipeline (verify existence, seed with first product walk-through + first case study)
- **Gap 2** — Property Managers acquisition surface (`/for-property-managers` landing page + content lane)
- **Gap 3** — Asset + attribution + review-provenance + partner-permission audit (P0 prerequisite per Amendment 1 + 7)

**Final approved Q3.1.3 position:**
_Search / GEO / AEO is the first 90-day priority. LinkedIn is the founder-led trust channel. YouTube is the reference-content + product-education moat (paired with transcript-rich companion pages). Podcast guesting is monthly. Paid ads stay pilot-scale. Property Managers need a dedicated landing page and content lane. Insurance Adjusters are influenced through better contractor reporting and legitimate partner channels — never direct marketing._

Boardroom rationale: the seven CEO amendments correct three classes of risk the panel had glossed over — (a) the assumption that already-shipped public surfaces are operational + measurable (Amendment 1), (b) the assumption that aggregated review claims and partner relationships transfer between brands (Amendments 2 + 3), and (c) the assumption that channel buildout can run in parallel within constrained bandwidth (Amendments 5 + 6). Amendment 4's YouTube tightening is the cleanest distribution framing — companion-page rule turns every video into a multi-channel asset rather than a single-platform bet. Amendment 7's audit gate is the single highest-leverage move available right now: every plan after Q3.1.3 derives validity from what the audit confirms is real.

### 3.4 Conversion architecture — RestoreAssist _(CLOSED 2026-04-26)_

#### Part A — Primary conversion event (CEO-approved with tightened A3 definition)

**Funnel (skills MUST report all four in this order):**

| Event | Definition                                                                                     |
| ----- | ---------------------------------------------------------------------------------------------- |
| A1    | **Trial signup**                                                                               |
| A2    | **First active guided evidence-capture session**                                               |
| A3    | **First technician/company-reviewed complete report exported** _(PRIMARY OPTIMISATION TARGET)_ |
| A4    | **Paid subscription started**                                                                  |

**A3 — locked definition (CEO-mandated):**

> _"First technician/company-reviewed complete report exported. The user has completed the guided workflow, captured the required evidence, reviewed the output, made any required adjustments, and exported a complete evidence-based report."_
>
> _"RestoreAssist does not publish, approve, scope, estimate, assess, verify, or sign off. The technician and the company they represent remain responsible for the final decision, scope, estimate, report review, and sign-off."_
>
> _"RestoreAssist's role is to guide the evidence-capture pathway, organise the record, support report generation, and help the team produce a clearer evidence-based report for scoping, estimating, follow-ups, client records, and business-owner review."_

**A3 remains the primary activation event** because it is the moment RestoreAssist proves practical value: the user has gone from field capture to a usable report.

The earlier panel claim that A3 predicts "70%+ of paid conversions" is tagged **[placeholder]** until RestoreAssist has its own verified data. No skill may use this number as a verified benchmark.

#### Part B — Friction audit checklist (10 items, hypotheses only — no fixes designed until Gap 3 confirms which are real)

| #       | Friction point                                                                              | Where it likely occurs                       | Priority |
| ------- | ------------------------------------------------------------------------------------------- | -------------------------------------------- | -------- |
| F1      | Trial signup friction (too much info up front)                                              | `/signup`                                    | P0       |
| F2      | First guided evidence-capture session does not onboard clearly                              | First trial in-product session               | P0       |
| F3      | Mobile-first field usability not validated                                                  | Field user on iPhone/Android during real job | P0       |
| F4      | Pricing model unclear or unfavourable to small operators                                    | `/pricing`                                   | P1       |
| F5      | No schedule-a-demo path                                                                     | Homepage + /signup                           | P1       |
| F6      | No social proof above the fold                                                              | Homepage                                     | P1       |
| F7      | No comparison-vs-Encircle/Xactimate page                                                    | Site-wide                                    | P2       |
| F8      | Compliance Library + Help Centre depth unknown                                              | `/compliance-library` + `/help`              | P2       |
| F9      | No Property Manager-specific signup/contact path                                            | `/signup` is generic                         | P2       |
| **F10** | **User control, editability, and final sign-off confidence not clear enough** _(CEO-added)_ | **Inside report review/export flow**         | **P0**   |

**F10 framing (CEO-mandated):**

> _"If technicians, admins, or business owners feel RestoreAssist is making the decision for them, trust drops. The product must make it obvious that the user can review, edit, adjust, approve internally, and export only when the company is satisfied."_
>
> _"RestoreAssist guides. RestoreAssist prompts. RestoreAssist organises. RestoreAssist generates a structured report from captured evidence. The technician and company review, adjust, decide, and sign off."_

#### Part C — Unit economics (placeholder model with CORRECTED CAC logic)

**All values tagged [placeholder] until Gap 3 verifies. Skills MUST tag every unit-economics claim with [placeholder] or [verified-DD/MM/YYYY].**

| Metric                                               | Placeholder estimate                                                                | Notes                                                                                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Pricing tier (entry)                                 | ~$50–80 AUD/seat/month [placeholder]                                                | Confirm from `/pricing` once crawled                                                                                                  |
| Pricing tier (multi-seat / company)                  | ~$150–500 AUD/month [placeholder]                                                   | Scales with technician count                                                                                                          |
| Average Contract Value (ACV) Year 1                  | ~$2,400 AUD/yr per Restoration Company customer (mid-size, 3–5 seats) [placeholder] | Industry estimate                                                                                                                     |
| Lifetime Value (LTV)                                 | ~$5,000–8,000 AUD per customer (3–5 yr retention typical) [placeholder]             | Compliance-anchored SaaS estimate                                                                                                     |
| LTV:CAC minimum target                               | **3:1**                                                                             | Industry rule of thumb                                                                                                                |
| LTV:CAC healthy target                               | **5:1 or better**                                                                   | Industry rule of thumb                                                                                                                |
| **Maximum allowable CAC** (mathematical 3:1 ceiling) | **~$1,667 AUD if LTV = $5,000 · ~$2,667 AUD if LTV = $8,000** [placeholder]         | This is the _ceiling_ — the most the business can tolerate while maintaining 3:1                                                      |
| **Conservative launch-stage blended CAC target**     | **≤ $400–800 AUD** [placeholder]                                                    | This is the _internal operating target_ during launch, where organic + founder-led + referral + cross-sell are doing most of the work |
| Free-trial-to-paid conversion                        | **8–15%** healthy in trade-services SaaS at launch [placeholder]                    | Industry estimate                                                                                                                     |
| Trial-to-A3 conversion                               | **40–60%** [placeholder]                                                            | Industry estimate                                                                                                                     |

**Critical CAC distinction (CEO-mandated):**

- The **maximum allowable CAC** = `LTV ÷ minimum LTV:CAC ratio` = the ceiling the business can tolerate. With placeholder LTV $5,000–8,000 and 3:1 minimum, that's **~$1,667–2,667 AUD**.
- The **conservative launch-stage blended CAC target** = ~$400–800 AUD — this is the _operating target during launch_, achievable because organic + founder-led + cross-sell channels are doing most of the work.
- Skills must NOT describe $400 CAC as the mathematical 3:1 threshold. It is the launch operating target. The mathematical ceiling at the placeholder LTV is far higher.

**Refinement process (post-Gap-3):**

1. Audit pulls real `/pricing` plans + actual current customers + trial-to-paid conversion rate.
2. Skills replace placeholder estimates with `[verified-DD/MM/YYYY]` numbers.
3. CAC target recalibrates against actual paid-channel performance from the $1–3k pilot.
4. LTV:CAC reviewed quarterly thereafter.

#### Hard rules (8 total, CEO-approved)

1. **Track all four conversion events as a funnel.** A1 → A2 → A3 → A4. Skills report all four in funnel order on every campaign-performance review.
2. **Optimise primarily for A3.** A3 is the activation event; onboarding sequences, in-product nudges, and success-team outreach all target A3 inside the trial period.
3. **No fix proposals on friction points until Gap 3 confirms which are real.** Verification gate from Q3.1.3 Amendment 1 applies.
4. **Unit economics remain placeholders until verified.** Every claim tagged `[placeholder]` or `[verified-DD/MM/YYYY]`.
5. **No paid-acquisition scale-up until LTV:CAC is verified at ≥ 3:1.** Pilot-scale only ($1–3k AUD/month per Q3.1.3 Amendment 6) until then.
6. **Property Manager and Restoration Company funnels are tracked separately.** Different ICP, different friction profile, different unit economics. Never aggregate them into a single conversion number.
7. **The RestoreAssist Aid Rule applies to conversion architecture.** RestoreAssist may _guide · prompt · record · document · capture · organise · suggest · draft · pre-fill · check · flag · cross-reference · compile · generate structured reports from captured evidence_. RestoreAssist must NOT be written as _assessing · diagnosing · deciding · judging · verifying · approving · scoping · estimating · publishing · signing off_.
8. **Any benchmark claim, including A3-to-paid conversion assumptions, must be tagged `[placeholder]` until RestoreAssist has verified product data.**

**Final approved Q3.1.4 position (CEO ratified):**

- A3 = _"First technician/company-reviewed complete report exported"_ — primary optimisation event
- 4-event funnel tracked: A1 trial signup → A2 first active guided evidence-capture session → A3 → A4 paid subscription
- 10-item friction audit checklist (F1–F10), no fixes until Gap 3 verifies
- Placeholder unit economics with corrected CAC logic: $400–800 = launch operating target; $1,667–2,667 = mathematical 3:1 ceiling at placeholder LTV
- 8 hard rules including the Aid Rule applied to conversion + mandatory `[placeholder]` tagging

Boardroom rationale: the CEO's three amendments correct three precision drifts the panel had let through — (a) A3 was loosely worded as "first complete report exported" without the technician/company review-and-sign-off requirement, which would have allowed the funnel to credit conversions where the user passively published a report without genuine review (false-positive activation); (b) F10 surfaces the most important product-trust risk for an AI-augmented tool — losing user control over the final sign-off — which the panel had bundled inside F2 onboarding when it deserves its own P0 slot; (c) the CAC math conflated the _operating target_ with the _mathematical ceiling_, which would have led skills to treat $400 as a hard limit when the placeholder LTV permits much more headroom — the corrected logic gives the right framing for both conservative launch operations AND eventual paid-channel scale-up. All three amendments tighten the model without weakening it.

### 3.5 Measurement + cadence + privacy posture — RestoreAssist _(CLOSED 2026-04-26)_

#### Part A — "Wins look like" (3-tier wins definition, CEO-approved)

**Tier 1 — Activation wins (weekly review · Monday morning):**

- Trial signups / week (A1)
- Trial-to-A2 conversion rate
- A3 events / week — _"First technician/company-reviewed complete report exported"_ (Q3.1.4 locked definition — never shortened back to "first report exported")
- Trial-to-A3 conversion rate within trial period

**Tier 2 — Revenue wins (monthly review · 1st of month):**

- New paid subscriptions started (A4) / month
- Trial-to-paid conversion rate within 60 days
- Average Contract Value (ACV) of new subscriptions
- Net new MRR / month
- Cross-sell-attributed paid subscriptions / month _(triggers T7 + T8 from Q2.5.2)_
- **Watch metric (added per CEO):** **90-day activated paid retention** — paid subscription is not enough if the company stops using RestoreAssist after the first job. Becomes visible once enough paid cohorts exist; not a primary KPI at launch.

**Tier 3 — Ecosystem wins (quarterly review · with portfolio scoreboard):**

- % of RestoreAssist users who also touch ≥ 1 other portfolio brand within 90 days
- Founder-fronted content reach across LinkedIn + podcast + YouTube + transcript-rich companion pages
- **AI-search visibility audit (CEO-amended — replaces "AI-search citation count"):** _"Quarterly manual snapshot of whether RestoreAssist appears or is cited in AI-search and AI-answer experiences for priority Australian restoration queries."_ Treated as a directional category-defensibility signal, **not** a hard KPI with a fixed target.
- **Paired stable search metrics (CEO-added):** Google Search Console impressions for category-intent queries · organic clicks to RestoreAssist GEO/AEO pages · branded search growth · ranking movement for priority _Field Restoration Application_ queries

#### Part B — Reporting cadence (CEO-approved with breach-rule amendment)

| Report                                          | Cadence                                                                                        | Channel                                    | Owner                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| Tier 1 activation snapshot                      | Weekly · Monday morning                                                                        | Single-page brief                          | Analytics Lead skill assembles; CEO reviews in batch                  |
| Tier 2 revenue + cross-sell                     | Monthly · 1st of month                                                                         | Two-page brief + funnel breakdown          | Performance + Attribution Lead skill                                  |
| Tier 3 ecosystem + AI-search visibility         | Quarterly · with portfolio review                                                              | Embedded in portfolio quarterly            | Senior Strategist skill                                               |
| **Marketing-performance threshold breach**      | Surface in **next weekly review queue**                                                        | Batched                                    | Email Specialist detects; Analytics Lead surfaces                     |
| **Privacy / security / customer-data incident** | **IMMEDIATE same-day escalation** to CEO or delegated privacy/security owner                   | Out-of-band incident pathway (NOT batched) | Whichever skill detects                                               |
| **Eligible data breach concern**                | Start breach assessment immediately; follow Notifiable Data Breaches (NDB) process if required | Documented incident pathway                | Privacy/security owner                                                |
| Friction-point fix proposals                    | Only after Gap 3 confirms which are real                                                       | One-time deep-dive briefs                  | CRO Specialist drafts; Senior Strategist reviews                      |
| Founder content drafts                          | Continuous batch (target 20–40 pieces/week per Phase 1.5)                                      | Ready-to-ship queue                        | Senior Copywriter drafts; Brand Strategist + brand-voice-enforce gate |

**Critical rule (CEO-mandated):**

- A conversion drop can wait for weekly review.
- A data or trust incident **cannot**.

#### Part C — Privacy posture (server-side primary · CEO-tightened with 9 amendments)

**Posture statement (CEO-locked):**

> _"Server-side primary, product-app hardened, marketing-site separately scoped, contractor-owned data, no external AI model training, explicit transparency, and incident-ready governance."_

**RestoreAssist holds:** property addresses · site photos · damage measurements · claim notes · insurer + contractor records · tenant/claimant details where included · business-owner + technician account data · AI-feature interaction records · exported reports.

**Compliance language (CEO-mandated — replaces broad "GDPR + AU Privacy Act compliant"):**

> _"Designed to support compliance with the Australian Privacy Act 1988, the Australian Privacy Principles, the Spam Act 2003 for marketing communications, and GDPR-style processor/controller expectations where relevant."_

Skills must NOT use bare "GDPR compliant" or "AU Privacy Act compliant" claims unless verified by legal review and tagged `[verified-DD/MM/YYYY]`.

**Data residency + subprocessor rule:**

- Maintain a current subprocessor register · disclose any overseas storage / processing / support access in the Privacy Policy where required
- Australian data residency where commercially + technically feasible
- If overseas processors are used, disclose countries/regions where practicable
- Written processor/subprocessor agreements
- Least-privilege access controls
- Log administrative access to customer data
- Separate production data from support, demo, marketing, and analytics environments

**Product app vs marketing site (separately scoped):**

_Marketing site (restoreassist.app):_

- GA4 / Search Console allowed
- Cookie notice or consent flow where required
- Paid-ad conversion tracking allowed (preferably server-side where supported)
- Clear privacy notice and footer link

_Product app:_

- **No third-party advertising pixels**
- **No third-party behavioural tracking**
- **No session replay on site-capture data unless explicitly approved + privacy-reviewed**
- Internal product analytics only
- Explicit in-product notice for usage analytics
- Opt-out where practical

**AI-feature data rule (extended per CEO):**

> _"AI-feature interactions are contractor-owned, server-side, and never used to train external AI models. Customer content must not be used for product-improvement model training, benchmarking, demos, case studies, or aggregated examples unless the contractor gives explicit permission or the data is lawfully de-identified and approved for that use."_

**Privacy-policy framing for AI features (CEO-approved verbatim):**

> _"RestoreAssist uses AI-assisted features to guide evidence capture, organise job information, draft structured report content, and support documentation workflows. Final review, adjustment, scope, estimate, approval, and sign-off remain with the technician and the company they represent."_

**Automated-decision transparency review (CEO-mandated date):**

> _"Before 10 December 2026, complete an automated-decision review and update the Privacy Policy if any RestoreAssist computer program uses personal information in a way that could significantly affect an individual's rights or interests."_

Even though RestoreAssist is not positioned as an automated decision-maker, the product MUST document: what AI features do · what personal information they use · what they do not decide · where human review occurs · who is responsible for final sign-off.

**Export + deletion promise (CEO-tightened from earlier draft):**

> _"Every customer can request export, access, correction, and deletion of their data through a documented support pathway, subject to lawful retention, contractual obligations, active claim requirements, backup-retention windows, and security verification."_

**Operating target (internal):** respond to privacy/access/deletion requests within **30 days** where practical, unless legal, contractual, identity-verification, or technical constraints require a longer documented process. **Do NOT overpromise instant deletion** — restoration reports may need retention for claim, audit, dispute, warranty, insurance, or legal reasons.

**Incident response process (mandatory):**

> _"RestoreAssist must maintain a documented privacy and data-breach response process covering detection, containment, assessment, customer communication, regulator notification where required, and post-incident review."_

**Email tracking (Mailchimp marketing-only) rules:**

- Consent-based list growth
- Clear sender identity
- Working unsubscribe in every commercial email
- DKIM/SPF/DMARC configured
- Suppression list respected
- Transactional + promotional emails kept separate where possible
- **No product-app customer content inserted into marketing emails without explicit permission**

#### Part D — Hard rules (15 total, CEO-approved — Q3.1.5 closeout)

1. **Wins are measured across three tiers:** activation weekly, revenue monthly, ecosystem quarterly.
2. **A3 remains the primary activation event:** _"First technician/company-reviewed complete report exported."_
3. **AI-search visibility is a quarterly directional audit, not a hard KPI.**
4. **Marketing-performance breaches can be batched into weekly review.**
5. **Privacy, security, data-loss, or customer-trust incidents require immediate same-day escalation.**
6. **Marketing-site analytics and product-app analytics are separately scoped.**
7. **Product-app data is server-side primary, contractor-owned, and protected from third-party advertising trackers.**
8. **Site capture data, claim data, photos, measurements, and reports are never used to train external AI models.**
9. **Customer content is not used for internal model training, demos, case studies, benchmarking, or aggregated examples without explicit permission or approved lawful de-identification.**
10. **RestoreAssist must not be described as making automated decisions.** It _guides · prompts · records · documents · organises · drafts · checks · flags · cross-references · compiles · generates structured reports from captured evidence_. The technician and company _decide · review · adjust · approve internally · sign off_.
11. **Privacy Policy must clearly explain** data types · purposes · storage · subprocessors/overseas disclosure where applicable · access/correction/deletion request pathways · complaints · AI-assisted features · human review.
12. **Automated-decision transparency review** must complete **before 10 December 2026.**
13. **Spam Act compliance applies to all commercial email** — consent · sender identification · contact details · functional unsubscribe.
14. **Data export and deletion requests must be supported,** but deletion is subject to lawful retention, claim/audit requirements, backups, identity verification, and contractual obligations.
15. **No public privacy, security, review, compliance, or data-residency claim may be used unless verified and tagged `[verified-DD/MM/YYYY]`.**

**Final approved Q3.1.5 position (CEO ratified):**

- 3-tier wins definition approved (activation weekly · revenue monthly · ecosystem quarterly)
- 90-day activated paid retention added as Tier 2 watch metric
- AI-search citation count → AI-search visibility audit (quarterly directional snapshot, not hard KPI)
- Reporting cadence approved with marketing-vs-incident split: marketing breaches batched weekly; privacy/security/data-loss incidents = immediate same-day escalation
- Privacy posture = server-side primary · product-app hardened · marketing-site separately scoped · contractor-owned data · no external AI model training · explicit transparency · incident-ready governance
- 15 binding hard rules covering privacy, compliance, data handling, AI-feature framing, automated-decision transparency, retention, incident response, and verified-claims-only public posture

Boardroom rationale: the CEO's nine amendments harden three classes of risk the panel had under-priced — (a) compliance language ("GDPR + AU Privacy Act compliant" = too broad without legal review; replaced with support-style framing); (b) data-handling depth (subprocessor register + data residency + product-app vs marketing-site separation + extended AI-training prohibition cover gaps the panel hadn't surfaced); (c) operational reality (AI-search outputs are volatile so they can't be a hard KPI; export/deletion requires retention exceptions; incidents bypass weekly batch queue; automated-decision transparency review has a regulator-aligned date). The 15 hard rules give every Synthex skill a mechanically enforceable compliance + measurement floor for the brand whose category claim ("Australia's first Field Restoration Application") makes it the highest-trust-bar brand in the portfolio.

---

## ✅ Phase 3.1 — RestoreAssist profile: COMPLETE (5/5)

**Profile summary:**

- **Identity (Q3.1.1):** Spine = _"Australia's first Field Restoration Application designed specifically for the Australian Property Restoration Industry."_ Family-of-variants tail. Sage primary · Pioneer secondary · Caregiver tertiary. AI-as-field-assistant rule. 14 taboos. Cleanup register for existing-site copy.
- **Audience JTBD (Q3.1.2):** 3 audiences (Restoration Companies primary buyer · Insurance Adjusters influence-only · Property Managers third B2B) × 9 jobs each. The RestoreAssist Aid Rule = 6th hard rule. Permitted vs forbidden verb lists locked.
- **Discovery + Distribution (Q3.1.3):** Channel maps approved. 7 binding amendments (verification gate · review-provenance rule · partner-permission rule · YouTube companion-page rule · 90-day sequencing · adjusted cadence ceiling · Gap 3 audit). 3 tracked gaps blocking execution.
- **Conversion architecture (Q3.1.4):** A3 = _"First technician/company-reviewed complete report exported."_ Full 4-event funnel. F10 added. CAC math corrected ($400–800 = launch operating target; $1,667–2,667 = mathematical 3:1 ceiling at placeholder LTV). 8 hard rules.
- **Measurement + cadence + privacy (Q3.1.5):** 3-tier wins (activation weekly · revenue monthly · ecosystem quarterly). AI-search visibility audit (directional, not hard KPI). Marketing breaches batched / privacy incidents same-day. Server-side primary privacy posture. 15 binding hard rules. Automated-decision transparency review by 10 December 2026.

**Inheritance:** every senior Synthex skill operating on RestoreAssist must read Phase 1 (operator profile) + Phase 2.5 (portfolio cross-sell map) + Phase 3.1 (this profile) at invocation. Brand-voice-enforce skill mechanically rejects copy that violates the Aid Rule, taboos, or verb lists.

---

## Phase 3.2 — Disaster Recovery + NRPG _(one business, two surfaces)_

> Primary flywheel anchor (Q2.5.1). Highest-leverage 2026 marketing surface in the portfolio.
> Inherits Phase 1 + Phase 2.5. Voice tags locked at Q2.5.5: **DR consumer = `brand_anonymous` · NRPG contractor = `hybrid_phill_strategic_brand_routine`**.

### CEO framing rules for Phase 3.2 _(locked before Q3.2.1)_

1. **Treat Disaster Recovery and NRPG as one business with two surfaces.** DR = consumer / claim / emergency-response surface. NRPG = contractor-network / supply-side / restoration-professional surface. They share credibility, operational trust, insurer relevance, and restoration authority, but they do not speak in the same voice to the same audience.

2. **Keep the identities distinct.** DR must not sound like contractor recruitment. NRPG must not sound like emergency consumer marketing. _DR earns trust from property owners, property managers, strata, business owners, and insurers in moments of urgency. NRPG earns trust from qualified restoration contractors who want claim flow, network credibility, standards, systems, and commercial opportunity._

3. **Separate the conversion paths.** DR primary conversion = a claim / emergency enquiry / request for help. NRPG primary conversion = a qualified contractor network application. A later downstream conversion can be first paid claim or first accepted job through the network — but **do not collapse the consumer and contractor funnels into one metric**.

4. **Protect the RestoreAssist Aid Rule from leaking into DR/NRPG incorrectly.** RestoreAssist is a guided evidence-capture and reporting aid. Disaster Recovery and NRPG are service/network businesses. Do not use RestoreAssist's AI-assistant language as the identity for DR or NRPG unless the specific context is RestoreAssist-enabled documentation.

5. **Insurer and partner claims must stay permission-gated.** If NRMA, Suncorp, QBE, or other insurer relationships are referenced, they must be verified for current use, context, and permission. A relationship visible on one business surface does not automatically become a reusable claim across every portfolio asset. (Inherits Q3.1.3 Amendment 3 partner-permission rule + extends it portfolio-wide.)

6. **Google Maps and emergency-intent search are P0 for Disaster Recovery.** Likely the biggest near-term acquisition layer. Google Maps optimisation, local SEO, emergency-service-area content, and AI Overview / GEO content handled with verification, not assumption.

7. **Contractor recruitment is P0 for NRPG.** Supply-side funnel matters because the network only works if qualified contractors are recruited, onboarded, and activated.

These 7 framing rules govern every Q3.2.X answer.

### 3.2.1 Identity — DR + NRPG (two surfaces) _(CLOSED 2026-04-26)_

#### Surface A — Disaster Recovery (consumer / claim / emergency)

**Category:** Emergency restoration network.
**Primary audience:** Property owners, property managers, strata, business owners, and insurers in emergency or claim-driven moments.
**Posture:** Hero primary · Caregiver secondary · Sage tertiary.
**Voice:** Calm authority in crisis · rapid · practical · protective · insurer-aware · never panic-amplifying · never founder-fronted · never written as Phill speaking.
**Voice tag (Q2.5.5):** `brand_anonymous`.

**DR spine (verification-gated):**

> _"Disaster Recovery is Australia and New Zealand's vetted emergency restoration network — IICRC-certified specialists dispatched within 60 minutes for water, fire, mould, storm, biohazard, and sewage damage."_

This exact spine may only be used when ALL of the following are verified:

- ANZ coverage is accurate
- "Vetted emergency restoration network" is accurate
- IICRC certification coverage is accurate across the claim being made
- "Dispatched within 60 minutes" is a verified standard, average, or operational promise
- The listed damage categories are all genuinely serviced

**Safer fallback spine (use until verifications complete):**

> _"Disaster Recovery is an emergency restoration network for water, fire, mould, storm, biohazard, and sewage damage — connecting property owners, managers, strata, businesses, and insurers with vetted restoration specialists."_

**Response-time copy rule (CEO-mandated):**

- _"Dispatched within 60 minutes"_ — only where verified.
- _"Rapid-response"_ or _"24/7 emergency restoration support"_ — where not verified.
- _"Under 30 minutes"_ or tighter response windows — never claim without separate verification.

**DR variant amendments (CEO-approved):**

| Variant                     | Status                                     | Final wording                                                                                                                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A1 spine**                | ✅ Approved with verification gate (above) | Verified version OR safer fallback above                                                                                                                                                                                                                                                                           |
| **A2 property-owner trust** | ✅ Approved                                | Spine + _"…restoring properties and protecting the people who own them, manage them, or live in them."_                                                                                                                                                                                                            |
| **A3 insurer-aware**        | ✅ Approved with edit                      | Spine + _"…with **insurance-grade documentation and billing support for major Australian insurer panel work**."_ (named insurers may only appear where each relationship is current, relevant, legally approved, and permissioned for that specific page · also removed "seamless" — already a global banned word) |
| **A4 GEO + AI-search**      | ✅ Approved with coverage verification     | Use city names (Sydney, Melbourne, Brisbane, Perth, Auckland) ONLY where service coverage is real; otherwise generic ANZ language                                                                                                                                                                                  |

**DR tagline:** _"Rapid Response. Resilient Future."_ — approved as **slogan layer only** (sits beside spine; never replaces it).

**DR-mark short-form rule:** _"DR"_ approved as the operational two-letter callsign across uniforms, vehicles, kits, branded operational assets. _"Disaster Recovery"_ remains the formal long-form copy. **No third name** (no DRA / DRecovery / Aussie DR).

**DR taboos (15 total — 12 baseline + 3 CEO additions):**

| #      | Taboo                                                                                                                                                                       | Why                                                                                                                                               |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | "Cheap" / "discount" / "budget"                                                                                                                                             | Crisis pricing burns trust                                                                                                                        |
| 2      | "We guarantee insurance approval / claim acceptance"                                                                                                                        | Legal risk; DR cannot speak for the insurer                                                                                                       |
| 3      | "DIY / save money / avoid contractors"                                                                                                                                      | Anti-category                                                                                                                                     |
| 4      | "Disaster as opportunity" / "silver lining" / "blessing in disguise"                                                                                                        | Tone-deaf                                                                                                                                         |
| 5      | Naming insurer partners on pages where the relationship isn't verified for that use                                                                                         | Permission-gated; default to _"major Australian insurer panels"_                                                                                  |
| 6      | "Disrupt" / "revolutionary" / "game-changer"                                                                                                                                | Anti-trust + global rule                                                                                                                          |
| 7      | "Leverage" / "delve" / "tapestry" / "robust" / "seamless" / "elevate"                                                                                                       | Global rule                                                                                                                                       |
| 8      | First-person _"I / my"_ singular Phill voice                                                                                                                                | DR is `brand_anonymous`                                                                                                                           |
| 9      | RestoreAssist's AI-assistant language ("guides", "prompts", "AI captures") for DR services                                                                                  | Rule 4 — Aid Rule does not transfer                                                                                                               |
| 10     | Hard-sell CTAs in emergency-intent moments (newsletter signup on a 2am water-damage page)                                                                                   | Wrong intent                                                                                                                                      |
| 11     | Beat-up-the-competitor copy (Steamatic / Johnsons / rivals named)                                                                                                           | Insurance-trade reads negative-comparison as unprofessional                                                                                       |
| 12     | Over-claiming response time beyond verified average                                                                                                                         | Trust burn on first missed SLA                                                                                                                    |
| **13** | **Publishing or referencing customer addresses · claim details · damage photos · tenant details · owner details · sensitive restoration cases without explicit permission** | Emergency restoration involves private homes, traumatic events, health hazards, insurance disputes, tenancy issues, commercially sensitive losses |
| **14** | **Fear-based emergency copy** — _"Every second destroys your property" · "Act now or lose everything" · "Your insurer may reject you if you wait"_                          | Correct frame = calm urgency, not panic                                                                                                           |
| **15** | **Implying DR controls insurer approval, claim outcome, policy interpretation, or payout timing**                                                                           | Correct frame = DR responds, restores, documents, supports the claim process. The insurer decides claim coverage and approval.                    |

---

#### Surface B — NRPG (contractor / supply / network)

**Category:** Vetted contractor network.
**Primary audience:** IICRC-certified restoration contractors and qualified restoration businesses.
**Posture:** Sage primary · Ruler secondary · Mentor/Hero tertiary.
**Voice:** Peer-to-peer trade · standards-led · commercially specific · founder-fronted only on NRPG contractor-facing surfaces · never founder-fronted on the DR consumer surface.
**Voice tag (Q2.5.5):** `hybrid_phill_strategic_brand_routine`.

**NRPG spine (CEO-revised — softens two overclaim risks):**

> _"NRPG — National Recovery Platform Group — is Australia and New Zealand's vetted contractor network for IICRC-certified restoration professionals, providing **access to qualified claim opportunities, structured payment pathways, and commercial-grade business support**."_

Changes from boardroom draft:

- _"qualified lead flow"_ → _"access to qualified claim opportunities"_ (avoids guaranteed-volume drift)
- _"fast payment"_ → _"structured payment pathways"_ (default; _"fast payment"_ permitted ONLY where payment terms, process, and average timing are verified)

**NRPG variant amendments (CEO-approved):**

| Variant                | Status                                 | Final wording                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1 spine**           | ✅ Approved with revised wording above | —                                                                                                                                                                                                                                                                                                                                         |
| **B2 recruitment**     | ✅ Approved with edit                  | Spine + _"…built by restoration professionals for restoration professionals, for contractors who already meet IICRC S500/S520/FSRT standards and want **access to qualified claim opportunities through a vetted network**."_ (replaces _"claim flow they don't have to chase"_)                                                          |
| **B3 standards-led**   | ✅ Approved with verification gate     | Specific entry requirements (IICRC cert · $1M+ liability · 2 yrs verified experience · clean safety record) may be listed ONLY if currently true and verified. If any not confirmed, use generic: _"…where members are assessed against certification, insurance, experience, and safety requirements before network work is allocated."_ |
| **B4 founder-fronted** | ✅ Approved with NRPG-only gate        | Spine + _"…built by Phill McGurk and the Unite Group operator team, after 15+ years inside the AU restoration trade."_ — appears ONLY on Phill's LinkedIn · contractor recruitment content · NRPG blog/thesis · podcast guesting · contractor-facing landing pages. NEVER on DR consumer emergency pages.                                 |

**NRPG taboos (15 total — 12 baseline + 3 CEO additions):**

| #      | Taboo                                                                                                                                                                                                   | Why                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1      | "Easy money" / "passive income" / "no experience needed"                                                                                                                                                | Wrong audience                                                                                                                  |
| 2      | "Unlimited claim flow" / "guaranteed jobs"                                                                                                                                                              | Over-promising; supply matched to demand (Q2.5.1)                                                                               |
| 3      | Lower IICRC entry standards / "we accept all contractors"                                                                                                                                               | Network value depends on vetting                                                                                                |
| 4      | DR consumer urgency language for recruitment                                                                                                                                                            | Rule 2 — voices stay distinct                                                                                                   |
| 5      | Insurer-name-dropping without permission                                                                                                                                                                | Same gate as DR; default _"major insurer panels"_                                                                               |
| 6      | Beat-up-the-competitor copy                                                                                                                                                                             | Trade audience reads as small-time                                                                                              |
| 7      | "Disrupt" / "revolutionary" / "game-changer"                                                                                                                                                            | Anti-trust + global rule                                                                                                        |
| 8      | "Leverage" / "delve" / "tapestry" / "robust" / "seamless" / "elevate"                                                                                                                                   | Global rule                                                                                                                     |
| 9      | First-person _"we / our"_ business language                                                                                                                                                             | Global rule (Phill bylined long-form may use _"I / my"_)                                                                        |
| 10     | RestoreAssist Aid Rule language transposed onto NRPG service identity                                                                                                                                   | Rule 4                                                                                                                          |
| 11     | Anti-DIY-contractor language ("if you're a one-man-band, don't apply")                                                                                                                                  | NRPG accepts solo IICRC-certified operators meeting bar                                                                         |
| 12     | Specific dollar earnings claims                                                                                                                                                                         | Legal risk + trade audiences see through it                                                                                     |
| **13** | **False scarcity recruitment language** — _"Only 5 spots left" · "Apply today before the network closes" · "Limited contractor positions available"_ unless scarcity is real and operationally verified | Wrong tone for qualified trade professionals                                                                                    |
| **14** | **Implying NRPG employs every contractor directly** unless legally true                                                                                                                                 | Correct frame = network · member · partner contractor · approved contractor · contractor network (depending on legal structure) |
| **15** | **Implying contractors receive work without meeting standards, onboarding, documentation, insurance, or performance expectations**                                                                      | Correct frame = NRPG provides access to network opportunities for qualified, vetted contractors who meet the required standards |

---

#### Cross-surface coordination rule (CEO-approved + CTA-separation amendment)

- **One business · two surfaces · shared trust signals · separate voices · separate CTAs · user intent controls the page · DR consumer urgency must never be used to sell NRPG membership.**
- **The two voices never share a paragraph and should rarely share the same CTA block.**

**DR CTAs (consumer emergency surface):** _Make a Claim · Request Emergency Response · Call Now · Start a Claim · Get Help Now_
**NRPG CTAs (contractor surface):** _Apply to Join the Network · Contractor Portal · Become an Approved Contractor · Register Interest · View Contractor Requirements_

- **Correct:** DR emergency page may have a secondary footer link to _"Contractor Portal"_ or _"About NRPG"_.
- **Incorrect:** A water-damage emergency page saying _"Property owners need help now — apply to become an NRPG contractor."_

**Shared trust signals (allowed on both surfaces, framed differently):**

| Signal                        | DR framing                                                                         | NRPG framing                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| IICRC certification           | Protects the property owner / manager / strata / business / insurer during a claim | Protects the standard of the network and the quality of work allocated through it |
| Vetted network                | Same                                                                               | Same                                                                              |
| Insurance-grade documentation | Same                                                                               | Same                                                                              |
| Response capability           | Same                                                                               | Same                                                                              |
| Geographic coverage           | Same                                                                               | Same                                                                              |
| Restoration expertise         | Same                                                                               | Same                                                                              |
| Insurer-aware process         | Same                                                                               | Same                                                                              |

The signals are the same; the audience-side framing changes by surface.

---

**Final approved Q3.2.1 position (CEO ratified):**

- DR identity locked: emergency restoration network · Hero/Caregiver/Sage · brand-anonymous · DR mark approved · 15 taboos · ANZ + city coverage + IICRC + insurer-panel + response-time claims all verification-gated.
- NRPG identity locked: vetted contractor network · Sage/Ruler/Mentor · founder-fronted only on NRPG surfaces · 15 taboos · _"fast payment"_ + _"qualified lead flow"_ + entry-standard claims all verification-gated.
- Cross-surface rule locked: one business · two surfaces · shared trust signals · separate voices · separate CTAs · user intent controls the page.

Boardroom rationale: the CEO's amendments lock down three risk classes the original draft under-priced — (a) verification gating on every quantitative or scope claim (response time, geographic coverage, IICRC, insurer panels, payment SLAs, contractor entry requirements) so no public copy ships an unverified promise that the brand could be held to; (b) language that implies network employment, insurer authority, or guaranteed volume, all of which are legal and trust risks for a two-sided marketplace; (c) tone-control on emergency copy (no fear-based panic) and recruitment copy (no false scarcity) — both styles burn trust with the audiences they target. The result: two identities that share credibility but cannot accidentally bleed into each other or over-promise on either surface.

### 3.2.2 Audience JTBD — DR + NRPG _(CLOSED 2026-04-26)_

Five DR audiences (kept distinct, not collapsed) + one NRPG ICP. All wording amendments below applied verbatim.

#### Surface A — Disaster Recovery (5 audiences)

##### A1 — Property Owners (residential / claimant)

**Functional jobs:**

1. Get qualified help on-site fast when a water/fire/storm/mould/biohazard event has just happened.
2. Make sure the property is documented properly so the claim has a clear evidence trail if questions, reviews, or disputes arise later.
3. Restore the property to pre-loss condition without managing multiple trades themselves.

**Emotional jobs:** Calm · Protected · Treated like a person, not a claim number.

**Trigger moments:** Live event (0–60 min) · Insurer referral handoff · Damage discovered later (slower, research-driven).

##### A2 — Property Managers

**Functional jobs:**

1. Respond to tenant 2am emergency calls without becoming the after-hours technician themselves.
2. Coordinate the entire restoration without becoming the project manager.
3. Produce documentation the owner can understand, the insurer can review, and the strata committee can rely on if questions arise.

**Emotional jobs:** Confident handing it off · Trusted by owners · Free of the after-hours scramble.

**Trigger moments:**

1. Tenant emergency call, often after-hours — DR's verified rapid-response promise lands here.
2. Owner instructs _"sort this out properly"_ — manager goes from receiver to dispatcher.
3. Annual review of preferred suppliers — emergency-protocol setup.

##### A3 — Strata Managers

**Functional jobs:**

1. Coordinate a restoration that affects multiple lots without 14 emails to the committee per day.
2. Get per-lot documentation that holds up if cost-allocation gets disputed by an owner.
3. Defend the response decision when the AGM asks why this contractor was used.

**Emotional jobs:**

1. Above-board — every committee member can see what was done, when, why, at what cost.
2. Not the bottleneck.
3. Backed by standards — IICRC-aligned processes and insurer-ready documentation help support defensible decisions.

**Trigger moments:** Common-property event · Committee asks for preferred-restoration arrangement · Previous restoration claim came back to bite the committee.

##### A4 — Business Owners (commercial property)

**Functional jobs:**

1. Get back to trading fast — every closed hour costs revenue.
2. Document the loss properly so business interruption and property claims can be reviewed with a clear evidence trail.
3. Limit operational disruption (separating restoration zones from working zones, after-hours work, etc.).

**Emotional jobs:**

1. In control of the trading impact.
2. Not left idle while the claim process unfolds — urgent mitigation can begin where safe, authorised, and operationally appropriate.
3. Protected from avoidable secondary damage — urgent mitigation reduces the risk of water damage becoming mould, structural, or operational disruption later.

**Trigger moments:** Live event during trading hours · After-hours event discovered at opening · Quarterly review where insurance + emergency response is on the agenda.

##### A5 — Insurers (gatekeeper · never directly marketed to)

**Functional jobs:**

1. Close claims with documentation that holds up in dispute.
2. Support claim-cost control by reducing the risk of secondary damage through faster mitigation.
3. Reduce per-claim admin friction — fewer chase emails, fewer site visits, cleaner data.

**Emotional jobs:** Trust this contractor · Defensible outcome · Adjuster's queue moves.

**Trigger moments:**

1. A specific contractor's reports start coming in faster, clearer, and better documented — adjusters notice the lower-friction reporting experience, and the contractor becomes easier to trust within approved panel or referral processes.
2. Annual contractor-panel review — DR is on the consideration list because of consistent IICRC + documentation track record.
3. Insurer-side claims-process tightening — DR's documentation depth becomes a compliance preference.

#### Surface B — NRPG (1 ICP)

##### B1 — IICRC-certified Restoration Contractors

**Functional jobs:**

1. Get access to qualified claim opportunities through a vetted network, reducing reliance on low-quality lead generation and direct insurer chasing.
2. Operate under a structured payment pathway that gives clearer process, expectations, and support when billing or claim disputes arise.
3. Get commercial-grade business support (training, standards, systems, peer network) that a sole-operator or small-shop can't build alone.

**Emotional jobs:**

1. Recognised as a professional.
2. Backed when something goes sideways — disputes, billing issues, and scope arguments are supported through the network's commercial structure rather than handled alone.
3. Part of an industry, not just a business — peer credibility, IICRC alignment, founder-led trade respect.

**Trigger moments:**

1. A bad lead-generation month — the operator is tired of paying for low-quality enquiries, competing against under-qualified providers, or spending too much time chasing work instead of completing restoration jobs.
2. A disputed claim or unpaid invoice — single experience shifts the operator from _"I can do this alone"_ to _"I need network leverage"_.
3. An IICRC cert renewal moment — the contractor is already in compliance-thinking mode; network application aligns.

#### Hard rules (10 total — CEO-approved closing set)

1. **One audience per piece of DR copy.**
2. **Insurers are influenced through documentation quality, contractor quality, and permissioned partner pathways — not broadcast marketing.**
3. **NRPG content never targets consumers.**
4. **Trigger-aligned emergency content is prioritised**, but performance multipliers remain `[placeholder]` until verified.
5. **Privacy-first JTBD copy:** no customer addresses, claim details, damage photos, tenant details, owner details, or sensitive cases without explicit permission.
6. **Founder voice is NRPG-only.**
7. **Verification-gated claims rule.** Any JTBD line involving response time, geographic coverage, IICRC coverage, insurer panels, claim acceptance, claim-cost reduction, _"no waiting for insurer approval"_, payment pathways, contractor entry requirements, or lead/opportunity flow must be marked as verification-gated until confirmed. Specific claims gated:
   - _under 60 minutes_ · _24/7 availability_ · _Australia and New Zealand coverage_ · _city coverage_ · _IICRC certification claims_ · _insurer panel references_ · _no waiting for insurer approval_ · _fast payment_ · _qualified claim flow_ · _5–10× trigger-content performance claims_
8. **Claim-outcome language rule (DR).**
   - DR **may say:** _documents · responds · restores · mitigates · supports · coordinates · prepares evidence · creates insurer-ready documentation · reduces risk · supports claim review_
   - DR **must NOT say or imply:** _guarantees claim acceptance · prevents all disputes · controls insurer approval · determines policy coverage · guarantees payout timing · guarantees claim-cost reduction · guarantees reopening timelines_
9. **Emergency copy uses calm urgency, not panic.**
   - **Approved tone:** _"Act quickly to reduce secondary damage and protect the evidence record."_
   - **Forbidden:** _"Every second could destroy your property."_ · _"Your insurer may reject the claim if you wait."_ · _"Call now before the damage becomes irreversible."_
10. **NRPG opportunity language avoids guaranteed-work framing.**
    - NRPG **may say:** _access to qualified claim opportunities · vetted contractor network · structured payment pathway · commercial support · peer network · standards-led membership · approved contractor pathway_
    - NRPG **must NOT say or imply:** _guaranteed jobs · unlimited claim flow · guaranteed income · fast payment unless SLA is verified · work without standards · work without onboarding · automatic insurer access · network membership as a shortcut around quality requirements_

**Final approved Q3.2.2 position (CEO ratified):**

DR has five distinct consumer-side / gatekeeper audiences with separate JTBDs (Property Owners need fast competent help + calm protection · Property Managers need after-hours response + vendor coordination + owner-ready documentation · Strata Managers need committee-safe per-lot documentation + AGM defensibility · Business Owners need fast mitigation + trading-disruption control · Insurers are influenced indirectly through documentation + contractor quality). NRPG has one tight contractor ICP (qualified claim opportunities + structured commercial support + standards-led credibility + less reliance on low-quality lead-gen). 10 hard rules now governing JTBD-driven copy across both surfaces.

Boardroom rationale: the CEO's 13 wording amendments and 4 added hard rules eliminate every overclaim risk a litigious insurance-trade audience could weaponise — _"won't be disputed"_ → _"clear evidence trail if questions arise"_; _"claims accepted"_ → _"claims can be reviewed"_; _"no waiting for insurer approval"_ → _"urgent mitigation can begin where safe, authorised, and operationally appropriate"_; _"reduce claim cost"_ → _"support claim-cost control by reducing risk of secondary damage"_. The framework now reads as a defensible commercial promise rather than a guarantee — which is the right register for a brand that operates inside the insurance + claim system, not above it. NRPG's amendments do the same on the contractor side: _"handled"_ → _"supported"_, _"chasing insurers"_ → _"reducing reliance on low-quality lead generation and direct insurer chasing"_. The result is a JTBD framework every Synthex skill can use to produce trade-services-credible copy without ever crossing the guarantee line.

### 3.2.3 Discovery + Distribution — DR + NRPG _(CLOSED 2026-04-26)_

#### Surface A — DR channel rankings (CEO-approved with amendments)

| Channel                                                    | Priority                                            | Notes                                                               |
| ---------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| Google Search (organic — local + emergency intent)         | **P0**                                              | Verification gate on city + service-area coverage                   |
| **Google Business Profile (GBP)** — eligible profiles only | **P0**                                              | Compliance rule binds — see Amendment 1 below                       |
| AI Overviews / Gemini / ChatGPT search                     | **P0 (strategic priority, not guaranteed capture)** | Amendment 2 + 3 binding                                             |
| Insurer co-marketing pathways                              | **P1**                                              | Verified relationships only                                         |
| YouTube — emergency how-to + before/after                  | **P1**                                              | Companion-page rule (Q3.1.3 Amendment 4)                            |
| LinkedIn (DR `brand_anonymous` voice)                      | **P1**                                              | Property + strata + business-owner audiences; never founder-fronted |
| REIA / REINSW / REIQ / SCA partnerships                    | **P1**                                              | Co-marketing only with verified partnerships                        |
| Insurance broker referral channels                         | **P2**                                              | Relationship-driven                                                 |
| Trade association content                                  | **P2**                                              | Sector-specific newsletters                                         |
| Facebook/Instagram                                         | **P2**                                              | Mostly retargeting                                                  |
| Trade Facebook groups                                      | **P3**                                              | Observe only                                                        |
| Paid search (emergency intent)                             | **Pilot only · $1–3k AUD/mo**                       | Amendment 7 prerequisites                                           |

#### Surface B — NRPG channel rankings (CEO-approved with amendments)

| Channel                                                       | Priority                        | Notes                                                             |
| ------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------- |
| LinkedIn (founder Phill + NRPG company page)                  | **P0**                          | Hybrid voice tag                                                  |
| Trade Facebook groups (AU restoration / IICRC / water damage) | **P0 — observe-first**          | Amendment 8 conduct rule binding                                  |
| **IICRC channels**                                            | **P0**                          | Amendment 9 trademark/partnership gate binding                    |
| Existing-member referrals                                     | **P1**                          | Build structure first; activate at scale post first 10–20 members |
| Google search (contractor intent)                             | **P1**                          | Active-search-mode contractors                                    |
| AI search (contractor recruitment queries)                    | **P1**                          | Wide-open AU window                                               |
| Podcast guesting (Phill on AU trade podcasts)                 | **P1**                          | 1 / month shared with RestoreAssist budget                        |
| YouTube (founder + contractor experience)                     | **P2**                          | Companion-page rule applies                                       |
| Trade publications (AU restoration trade press)               | **P2**                          | Slow-moving, credibility-building                                 |
| IICRC AU event sponsorship / speaking                         | **P2**                          | Manual, not scalable                                              |
| Paid LinkedIn (IICRC + restoration-trade targeting)           | **Pilot only · $500–1k AUD/mo** | Once attribution clean                                            |

#### Cross-surface coordination rules (CEO-approved)

- DR consumer pages serve emergency / claim intent. NRPG contractor pages serve contractor recruitment / network intent.
- GBP profiles point to DR consumer pages, never NRPG recruitment pages.
- Phill's founder voice belongs on NRPG and portfolio-level surfaces, never DR consumer emergency pages.
- Insurer relationships remain permission-gated portfolio-wide.
- Three LinkedIn surfaces, three voices: Phill personal (founder, hybrid voice) · NRPG company (brand-voice contractor recruitment) · DR company (`brand_anonymous` consumer trust).
- Site architecture: NRPG-recruitment content sits on `/contractor` or `/about-nrpg` URLs (or similar contractor-only paths). NEVER on emergency-intent landing pages.

#### CEO amendments (1–10) — all binding

**Amendment 1 — GBP compliance rule (binding):**

> _"Eligible Google Business Profiles are the supply-side of local emergency search, but only where the business has a legitimate real-world location or service-area basis for the profile."_

DR may use GBP as a P0 channel **ONLY for verified, policy-compliant profiles**. The following are FORBIDDEN:

- Artificial city GBPs
- Fake service-area profiles
- Virtual-office listings
- Keyword-stuffed GBP names
- Separate profiles for cities, suburbs, or service types unless the business has a legitimate, verifiable operating basis for that profile

**If DR has one eligible national or primary service-area profile, optimise that profile first.** If DR has genuine city branches or legitimate local operating entities, each profile must be verified, accurate, owned, and linked to the correct DR consumer page.

**GBP audit must confirm:** profile ownership · verification status · business name accuracy · address / hidden-address / service-area setup · primary + secondary categories · hours + after-hours emergency availability · phone routing · website URL + UTM tagging · services listed · photos + videos · review count + provenance · Q&A coverage · location/service-area accuracy · city/service coverage · claim-form / call-tracking linkage.

**No GBP build-out begins until Gap 4 confirms what profiles are eligible and what service areas are real.**

**Amendment 2 — AI-search realism rule (binding):**

> _"DR should build the strongest eligible entity, local, service, and emergency-intent content base while the AU AI-search and Maps-AI window is still forming."_

- AI-search visibility is a strategic priority.
- AI Overview inclusion is **NOT guaranteed**.
- AI-search outputs are volatile.
- Measurement = manual visibility audit + Search Console / GA4 support metrics. **NOT** a hard citation KPI.

**Track:** priority emergency-intent query visibility · GSC impressions + clicks · local pack / Maps presence · branded search growth · organic claim-form starts · emergency phone clicks · AI-search mentions/citations as **directional snapshot only**.

**Amendment 3 — AU Maps rollout verification gate (binding):**

Google Maps / GBP remains P0 because emergency restoration is a local-intent category. **Any claim that a specific 2026 Google Maps AI feature is affecting Australian emergency-service discovery must be marked `[verification needed]` until confirmed in Australian search results.**

Plan prioritises **durable local SEO assets first:** compliant GBP profiles · verified service areas · emergency-intent city/service pages · accurate opening hours + emergency availability · call + form tracking · reviews from genuine customers · service photos where permissioned · schema that matches visible page content.

**Amendment 4 — Schema discipline rule (binding):**

> _"Schema supports entity clarity and search eligibility. It does not guarantee rankings, rich results, local pack visibility, or AI Overview citation."_

**Recommended schema audit (Gap 4):** Organization · LocalBusiness where eligible · Service pages where supported by visible content · Breadcrumb · FAQ where real FAQs are visible on the page · VideoObject for YouTube companion pages · Review/AggregateRating only where review provenance is verified and compliant.

**Hard rule:** do NOT add city, service, insurer, review, rating, response-time, or certification claims into schema unless the same claim is visible, accurate, and verified on the page.

**Amendment 5 — 90-day sequencing (revised — safer than original boardroom draft):**

| Window         | Workstream                                                                                                                                                                                                                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Days 1–30**  | **Complete Gap 4 audit.** No major channel build-out until audit confirms: actual service areas · eligible GBP profiles · insurer permission status · schema status · Search Console / GA4 status · call + form tracking · online claim-system funnel tracking · DR + NRPG LinkedIn page status · YouTube channel status · IICRC partnership / trademark status · Mailchimp setup |
| **Days 31–60** | **Build/clean P0 foundations.** Compliant GBP clean-up · top verified city/service pages · DR emergency-intent claim pages · call + form tracking wiring · GSC + GA4 checks · first YouTube companion-page workflow · NRPG contractor landing page check                                                                                                                          |
| **Days 61–90** | **Begin controlled publishing.** DR emergency-intent GEO/AEO content · NRPG founder-led contractor content · one DR YouTube emergency-response asset + companion · one NRPG contractor asset + companion · property manager / strata landing-page planning · paid-search pilot ONLY if attribution clean                                                                          |

**Hard rule:** do NOT start a full city × service-type matrix before service areas, GBPs, and tracking are verified.

**Amendment 6 — DR content cadence (revised down):**

- **Start:** 1 strong DR emergency-intent page or article per week after Gap 4 complete
- **Scale:** to 2/week ONLY once review workflow is stable AND service-area evidence is verified
- **Service-page deep refresh:** 1 page / fortnight
- **Why:** DR content has higher legal, operational, privacy, and claim-sensitivity risk than ordinary SEO content; review burden is higher

**Amendment 7 — Paid search prerequisites (binding before any pilot goes live):**

DR paid search is pilot only. **No emergency-intent Google Ads pilot goes live until ALL of these are working:**

- Call tracking
- Form tracking
- Source / medium attribution
- GBP UTM tagging
- Duplicate lead handling
- After-hours routing
- Emergency phone answer process
- Claim-quality tagging
- Paid vs organic claim-source reporting

**Primary paid-search metric:** **Qualified emergency enquiry or claim start.** Not clicks. Not impressions. Not form views. Not cost per click alone.

The $30–80 CPC range remains `[placeholder]` until verified in DR's actual ad account or AU emergency-restoration auction data.

**Amendment 8 — NRPG trade-group conduct rule (binding):**

NRPG trade Facebook groups are **observe-first.** Phill or NRPG may contribute ONLY where the comment is genuinely useful, technical, standards-led, or trade-experience based.

**FORBIDDEN:** hard pitching · DM scraping · "apply now" spam · contractor shaming · screenshots from private groups · sharing claim details · sharing customer or insurer details · using consumer emergency stories as recruitment fuel.

**Goal: trust + industry presence, not extraction.**

**Amendment 9 — IICRC trademark / partnership rule (binding):**

NRPG MAY reference IICRC certification requirements where accurate.

NRPG MUST NOT imply IICRC partnership, endorsement, sponsorship, or official relationship **unless verified and permissioned.** IICRC logos, trademarks, event references, and partnership language must pass **Gap 4** before use.

**Amendment 10 — Hard rules 9 + 10 added (binding):**

- **Hard rule 9 — GBP compliance:** DR may use Google Business Profiles ONLY for verified, legitimate, policy-compliant profiles. No artificial per-city, virtual-office, keyword-stuffed, or service-type profiles. GBP build-out depends on Gap 4.
- **Hard rule 10 — AI-search realism:** GEO/AEO/AI-search visibility is a P0 strategic priority, but AI Overview · Gemini · ChatGPT search · Maps AI inclusion is NEVER guaranteed. Skills must optimise durable SEO · entity · local · service · evidence content first, then audit AI-search visibility directionally.

#### DR + NRPG Capability ceiling (CEO-approved · revised cadences from Amendment 6)

**DR (calibrated against Phase 1.1 6–10 hr/wk):**

| Channel                               | Realistic 2026 H1 cadence                                         |
| ------------------------------------- | ----------------------------------------------------------------- |
| GBP optimisation                      | Eligible profiles only · audit-driven · no build-out before Gap 4 |
| GEO/AEO content (city × service-type) | **1 / week start, scale to 2 / week once stable**                 |
| Service-page deep refresh             | **1 / fortnight**                                                 |
| YouTube uploads (DR-specific)         | **1 / month minimum** with companion page                         |
| LinkedIn (DR brand voice)             | **2 brand-voice posts / week**                                    |
| Insurer co-marketing pilots           | **1–2 partnerships in 2026 H1** with verified relationships       |
| Paid search (emergency intent)        | **Pilot only · $1–3k AUD/mo** after Amendment 7 prerequisites met |
| Strata + REIA association content     | **1 / month**                                                     |

**NRPG capability ceiling:**

| Channel                                   | Realistic 2026 H1 cadence                                         |
| ----------------------------------------- | ----------------------------------------------------------------- |
| Phill LinkedIn long-form (NRPG-anchored)  | **1 / week** (counts in shared portfolio LinkedIn budget)         |
| Trade Facebook group presence             | **Daily observation + 1–2 substantive comments / week**           |
| IICRC channel partnership push            | **1 verification + outreach / quarter**                           |
| NRPG blog / thesis content                | **2 / month**                                                     |
| Podcast guesting                          | **1 / month** shared with RestoreAssist budget                    |
| YouTube (founder + contractor experience) | **1 video / month** with companion page                           |
| Member referral structure                 | Build first; activate at scale once first 10–20 members onboarded |
| Paid LinkedIn pilot                       | **$500–1k AUD/mo** after attribution clean                        |

#### Tracked work items (Gaps 4–7, CEO-approved · prerequisite to execution)

- **Gap 4 — DR + NRPG Asset + Coverage + Permission Audit** _(P0, must complete before Gap 5)_
  - GBP audit (existence, ownership, verification, photo coverage, review count, location accuracy)
  - Service-area coverage verification
  - Insurer-relationship permission audit (12 named insurers — which can be referenced where)
  - Schema markup audit (LocalBusiness · EmergencyService · Service · Org · FAQ · VideoObject · Review per Amendment 4)
  - GA4 + Search Console wired status
  - LinkedIn DR + NRPG company page status
  - YouTube channel(s) status
  - Mailchimp DR + NRPG account setup
  - **IICRC partnership / trademark usage permission status** (Amendment 9 prerequisite)
  - Existing online claim system funnel-tracking depth
  - Call + form tracking · UTM tagging · source attribution (Amendment 7 prerequisite for paid)
- **Gap 5 — Per-eligible-profile GBP build/clean-up plan** _(must NOT begin until Gap 4 confirms which GBPs and service areas are legitimate)_
- **Gap 6 — Insurer co-marketing pilot framework** (1–2 verified partnerships, permission-tagged content templates)
- **Gap 7 — Property Manager + Strata acquisition surfaces** (mirrors RestoreAssist Gap 2)

#### Final hard rules (10 total — CEO-approved closing set)

1. Google Maps + GEO/AEO + AI Overviews on emergency intent are the single biggest 2026 acquisition lever in the entire portfolio.
2. DR is the only portfolio brand with genuine local-services GBP relevance (per L7).
3. Insurer relationship name-dropping is permission-gated portfolio-wide.
4. Founder voice (Phill) appears only on NRPG contractor surfaces + portfolio-level LinkedIn long-form. NEVER on DR consumer pages.
5. YouTube companion-page rule applies to every DR + NRPG video.
6. All quantitative claims (response times, geographic coverage, IICRC scope, payment SLAs, contractor entry requirements, insurer panel references) verification-gated.
7. No paid-acquisition scale-up beyond pilot ($1–3k DR + $500–1k NRPG / mo) until LTV:CAC ≥ 3:1 verified.
8. NRPG recruitment pace matches claim flow + 20% buffer maximum.
9. **GBP compliance rule** — eligible, policy-compliant profiles only; no artificial profiles.
10. **AI-search realism rule** — strategic priority, not guaranteed capture; durable SEO/entity/local/service content first, AI-search audited directionally.

**Final approved Q3.2.3 position (CEO ratified):**

P0 for DR = Google Search · compliant GBP/Maps presence · emergency-intent GEO/AEO content · tracking · claim-form + call conversion visibility.
P0 for NRPG = founder-led LinkedIn · IICRC pathway verification · contractor-intent content · observe-first trade group presence · referral structure planning.
P1 = YouTube companion-page assets · verified insurer co-marketing pilots · property/strata association content · property-manager + strata landing pages.
Pilot only = DR paid search ($1–3k/mo) + NRPG paid LinkedIn ($500–1k/mo) — both after attribution clean + Amendment 7 prerequisites met.

Boardroom rationale: the CEO's 10 amendments harden the distribution plan against four risk classes — (a) **GBP policy risk** (artificial city/service-area profiles get suspended by Google + burn brand), (b) **AI-search overclaim risk** (AI Overview inclusion is volatile and not guaranteed; treating it as a citation KPI distorts effort allocation), (c) **schema overreach risk** (claims in structured data must match visible page content or attract manual actions), and (d) **execution sequence risk** (running channel build-out before Gap 4 audit creates assets on assumptions that may not hold). The 30/30/30 sequencing (audit → foundation → publishing) is the correct cadence for a brand whose category sits inside the AU insurance-services regulatory perimeter. The trade-Facebook-group conduct rule + IICRC trademark gate close two trust-burn vectors that would have been difficult to recover from once breached.

### 3.2.4 Conversion architecture — DR + NRPG _(CLOSED 2026-04-26)_

#### Surface A — DR conversion architecture (CEO-approved with split + qualification amendments)

**DR funnel (split + tightened):**

| Event   | Definition                                                                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1**  | Emergency-intent visitor lands on a DR claim, service, location, or emergency-intent page from organic search · Maps/GBP · paid · referral · insurer pathway · direct · social · or association channel |
| **D2a** | Claim form started                                                                                                                                                                                      |
| **D2b** | Emergency phone click / call initiated                                                                                                                                                                  |
| **D3a** | **Qualified claim form submitted** _(PRIMARY TARGET — sub-event)_                                                                                                                                       |
| **D3b** | **Emergency phone call answered, logged, and qualified by intake** _(PRIMARY TARGET — sub-event)_                                                                                                       |
| **D4**  | Job dispatched and accepted by approved contractor / NRPG contractor where applicable _(operational handoff)_                                                                                           |
| **D5**  | Job completed and revenue event confirmed, with source type tagged as **insurer-billable · private-pay · commercial · property-manager · strata · or other verified category**                          |

**D3 qualification minimum fields (all must be met for D3 to count):**

- Contact details captured
- Property location or service area captured
- Service type captured
- Urgency captured
- Authority / relationship to property captured where practical
- Enquiry inside a verified service area
- Enquiry relates to a DR-serviced damage category
- Duplicate, spam, sales, contractor-recruitment, and irrelevant enquiries excluded

**D3 is the primary marketing optimisation target.** D4 + D5 are operational + revenue-confirmation signals, not marketing conversion events.

**DR friction audit (13 hypotheses for Gap 4 — no fixes designed until verified):**

| #        | Friction                                                                                                                                                                    | Where                                  | Priority |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------- |
| DF1      | Mobile claim form too long for emergency intent                                                                                                                             | `/make-a-claim` mobile                 | P0       |
| DF2      | Phone routing fails after-hours / sends to voicemail                                                                                                                        | Emergency phone line                   | P0       |
| DF3      | GBP listings missing critical info                                                                                                                                          | GBP audit                              | P0       |
| DF4      | Service-area pages thin or unverified                                                                                                                                       | Locations sub-pages                    | P0       |
| DF5      | Trust signals inconsistent / unverified across pages                                                                                                                        | Site-wide                              | P0       |
| DF6      | Form requires fields claimant doesn't have at 2am                                                                                                                           | `/make-a-claim`                        | P1       |
| DF7      | No "what to expect" content for claimants pre-arrival                                                                                                                       | Service pages                          | P1       |
| DF8      | No PM / strata / business-owner-specific intake paths                                                                                                                       | Single generic claim form              | P1       |
| DF9      | No call-tracking → can't separate paid vs organic phone enquiries                                                                                                           | Phone routing                          | P1       |
| DF10     | No source-attribution on claim form                                                                                                                                         | Form code                              | P1       |
| **DF11** | **Duplicate lead + incident deduplication failure** — same emergency generates phone + form + follow-up; system inflates D2/D3 without dedupe                               | Phone + form + GBP + paid routing      | **P0**   |
| **DF12** | **Intake qualification rules unclear** — no definition of "qualified enquiry" lets marketing inflate numbers                                                                | Phone intake + form + dispatch handoff | **P0**   |
| **DF13** | **Authority + access details missing** — PM / strata / tenants / business owners may not be the owner; intake needs role capture without overcomplicating emergency capture | Claim form + phone intake              | P1       |

**D3 reporting rule:** dedupe by incident / property / contact where possible. Exclude non-service-area · unsupported-service · duplicate · spam · recruitment · supplier · irrelevant enquiries.

**DR placeholder unit economics (terminology corrected):**

| Metric                                                                               | Placeholder                                                                                                                                                                                                                                                          | Notes                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Average claim/job value                                                              | $5,000–25,000 AUD `[placeholder]`                                                                                                                                                                                                                                    | Wide range by service type · NOT equal to DR revenue or margin                                                                                                                                                         |
| **Cost per qualified D3 enquiry** _(NOT "CAC")_ — paid-search pilot operating target | **≤ $200–400** `[placeholder]`                                                                                                                                                                                                                                       | A D3 is a qualified enquiry, not an acquired customer                                                                                                                                                                  |
| **CAC**                                                                              | Calculated at **won-claim or acquired-account** stage, NOT at D3 enquiry                                                                                                                                                                                             | Gap 4 must confirm contribution margin first                                                                                                                                                                           |
| Gross job value                                                                      | NOT equivalent to DR revenue                                                                                                                                                                                                                                         | Gap 4 must separate gross job value · DR revenue · contractor payout · network fee · gross margin · contribution margin · paid acquisition cost · operational handling cost · recurring account value where applicable |
| Organic + GBP marginal cost                                                          | **NOT "floor cost"** — channels reduce _marginal_ paid acquisition cost over time, but still carry fixed costs for content, profile management, review management, tracking, creative, and operational maintenance. Organic is not free; just not charged per click. | Refine in Gap 4                                                                                                                                                                                                        |

**DR has TWO economics models (NEVER averaged into one blended claim):**

| Model                                          | Used for                                                                                                      | Core metric                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Model 1 — Per-incident economics**           | Property owners · single claim · one-off emergency jobs · paid-search decisions                               | Contribution margin per won job vs acquisition cost                                               |
| **Model 2 — Account / relationship economics** | Property managers · strata managers · business owners · insurers · brokers · other recurring exposure sources | Multi-incident account value · referral value · or portfolio value vs relationship / nurture cost |

#### Surface B — NRPG conversion architecture (CEO-approved with N3 + N6 redefinitions)

**NRPG funnel (tightened):**

| Event  | Definition                                                                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N1** | Contractor visits NRPG recruitment page (LinkedIn → site · organic · IICRC channel · peer referral)                                                        |
| **N2** | Contractor submits _Apply to Join Network_ / _Register Interest_ / contractor-portal account creation                                                      |
| **N3** | **Application reviewed, credentials verified, commercial requirements accepted, and contractor approved as onboarding-ready** _(PRIMARY MARKETING TARGET)_ |
| **N4** | First NRPG claim opportunity accepted _(network activation)_                                                                                               |
| **N5** | First NRPG-referred job completed and revenue event confirmed _(revenue activation)_                                                                       |
| **N6** | **90-day active network retention** — defined below                                                                                                        |

**N3 minimum requirements (where applicable + verified):**

- IICRC certification confirmed
- Liability insurance confirmed
- Experience threshold confirmed
- Safety / compliance status checked
- Service area captured
- Service categories captured
- Contractor capacity captured
- Commercial terms accepted
- Onboarding status recorded

**N6 "active" definition (CEO-mandated):** contractor remains credential-current · contactable · in good standing · has responded to or accepted opportunities where available · has NOT become dormant, paused, suspended, or removed. Dormant contractors do NOT count as retained network supply.

**Three-tier activation framing:**

- **N3 = marketing activation** (the contractor passed the gate and can realistically enter the network)
- **N4 = network activation** (the contractor became useful supply)
- **N5 = revenue activation** (the network actually delivered commercial value)

**NRPG friction audit (13 hypotheses for Gap 4):**

| #        | Friction                                                                                                                                                                                       | Where                    | Priority |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------- |
| NF1      | Apply form too long / detailed / scares off qualified contractors                                                                                                                              | `/contractor` apply flow | P0       |
| NF2      | Application requirements not clearly stated up-front                                                                                                                                           | Recruitment pages        | P0       |
| NF3      | No clear value-prop above the fold                                                                                                                                                             | Recruitment pages        | P0       |
| NF4      | No social proof from existing members                                                                                                                                                          | Recruitment pages        | P0       |
| NF5      | No founder voice anchor (Phill's _"why this exists"_)                                                                                                                                          | Recruitment + LinkedIn   | P1       |
| NF6      | No comparison vs alternatives (working solo · other AU networks · insurer-direct)                                                                                                              | Recruitment pages        | P1       |
| NF7      | No clarity on rate schedule / payment timing / commercial structure                                                                                                                            | Recruitment + portal     | P1       |
| NF8      | No application-status visibility for contractors mid-review                                                                                                                                    | Apply flow               | P1       |
| NF9      | Existing-member referral mechanism missing/weak                                                                                                                                                | Member portal            | P1       |
| NF10     | No source-attribution on application form                                                                                                                                                      | Form code                | P1       |
| **NF11** | **Contractor capacity + service-area matrix missing** — NRPG cannot safely recruit supply without knowing where contractors operate, what services they deliver, and how much work they handle | Application + onboarding | **P0**   |
| **NF12** | **Accepted contractors go idle before first claim** — N3 → N4 handoff failure burns trust with qualified operators                                                                             | N3 → N4 transition       | **P0**   |
| NF13     | Commercial terms unclear before application — vagueness brings wrong contractors and deters right ones                                                                                         | Recruitment + apply flow | P1       |

**Required rule (NF11):** every accepted contractor MUST have service area · service type · capacity · certification · availability data recorded before being treated as active supply.

**Required rule (NF12):** track time from N3 → N4. Flag contractors accepted but not activated within the agreed review window.

**NRPG placeholder unit economics (terminology corrected):**

| Metric                                                                      | Placeholder                                                                                                               | Notes                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cost per N2 application** _(NOT "CAC")_ — pilot LinkedIn operating target | **≤ $200–500** `[placeholder]`                                                                                            | An application is not an acquired contractor                                                                                                                                                                                       |
| **CAC**                                                                     | Calculated at **N3 (cost per accepted contractor) · N4 (cost per first activated) · N5 (cost per revenue-activated)**     | Each stage is a separate CAC measurement                                                                                                                                                                                           |
| **NRPG contractor LTV**                                                     | $50,000–250,000+ AUD over 3–5 years `[placeholder]` — **must distinguish gross throughput from NRPG contribution margin** | Gap 4 must clarify whether figure means: gross claim value flowing through · NRPG retained revenue · network fee · software margin if RestoreAssist bundled · contractor lifetime contribution margin · portfolio cross-sell value |
| **NRPG margin per contractor**                                              | `[placeholder · needs Gap 4]`                                                                                             | Confirm commercial structure before any CAC ceiling derived                                                                                                                                                                        |

**Hard rule:** until Gap 4 clarifies NRPG's actual contribution margin per contractor, ALL NRPG LTV and CAC ceiling claims remain `[placeholder]`. The "CAC ceiling at $50k LTV = $16,500" / "at $250k LTV = $83,000" math from earlier draft is `[placeholder]` until margin verified.

**Constraint reminder:** NRPG recruitment is constrained by **claim-flow capacity · service-area demand · contractor quality · and the +20% buffer rule** (Q2.5.1) — NOT simply by acquisition budget.

#### Cross-surface coordination — source-of-truth job ID rule (CEO-mandated)

**D4 and N4 may refer to the same operational job, but they MUST NOT be double-counted.**

Every dispatched job MUST have a single source-of-truth job ID linking:

- DR enquiry source
- D3 qualification status
- Dispatch status
- Contractor assigned
- NRPG contractor status where applicable
- Job completion
- Revenue event
- Claim / payment category

This lets DR and NRPG report separately while still showing the operational handoff without double-counting revenue, claims, or contractor activation.

**NRPG contractor applications MUST NEVER be generated from DR emergency urgency.**

- Correct: A DR page may include a quiet footer or nav link to _"Contractor Portal"_.
- Incorrect: A water-damage emergency page saying _"Property owners need help now — apply to become an NRPG contractor."_

#### Final hard rules (15 total — CEO-approved closing set)

1. **DR and NRPG maintain separate funnels.** Never aggregate D-funnel + N-funnel into one conversion metric.
2. **DR optimises toward D3** (qualified emergency enquiry or claim start).
3. **D3 must be split for reporting:** D3a (qualified claim form submitted) + D3b (qualified phone call answered, logged, and qualified by intake).
4. **D3 must exclude** duplicate · spam · unsupported-service · non-service-area · contractor-recruitment · supplier · irrelevant enquiries.
5. **NRPG optimises toward N3** (accepted and onboarding-ready contractor after credential + commercial review).
6. **N4 = NRPG network activation** (first claim opportunity accepted).
7. **N5 = NRPG revenue activation** (first NRPG-referred job completed + revenue event confirmed).
8. **D4 / N4 operational handoffs linked by source-of-truth job ID — never double-counted.**
9. **No fix proposals on DR or NRPG friction lists until Gap 4 confirms which are real.**
10. **All unit economics remain `[placeholder]` until Gap 4.** Every claim tagged `[placeholder]` or `[verified-DD/MM/YYYY]`.
11. **Do NOT call cost per D3 enquiry or cost per N2 application "CAC".** CAC applies to acquired customers · won claims · accepted contractors · or revenue-activated contractors depending on the funnel stage.
12. **DR paid acquisition decisions use contribution margin per won job, NOT gross job value.**
13. **DR has two economics models** (per-incident · account/relationship). Never averaged into one blended claim.
14. **NRPG recruitment constrained by claim-flow capacity · service-area demand · contractor quality · +20% buffer rule** — not simply by acquisition budget.
15. **DR claim-outcome rules (Q3.2.2 hard rule 8) + NRPG opportunity-language rules (Q3.2.2 hard rule 10) remain binding** — no claim-approval guarantees · payout guarantees · automatic insurer access · guaranteed work · guaranteed income · standards-bypass.

**Final approved Q3.2.4 position (CEO ratified):**

DR conversion architecture: D3 split into form-qualified (D3a) + phone-qualified (D3b); 13-item friction audit; per-incident + account/relationship economics models; gross job value never equated to revenue or margin. NRPG conversion architecture: N3 = accepted + onboarding-ready (requires credential + commercial verification); N4 = network activation; N5 = revenue activation; N6 = active-not-dormant retention; 13-item friction audit; LTV must distinguish gross throughput from contribution margin. Source-of-truth job ID rule prevents D4/N4 double-counting. Cost per D3 enquiry ≠ CAC. Cost per N2 application ≠ CAC. 15 hard rules.

Boardroom rationale: the CEO's amendments correct three categories of measurement-distortion risk that would have shipped silent corruption into every dashboard the system produces — (a) **terminology drift** (calling D3-cost "CAC" or N2-application-cost "CAC" creates a number that looks rigorous but isn't, leading to bad budget decisions); (b) **double-counting risk** (D4 and N4 are the same operational event from two angles; without the source-of-truth job ID rule, every weekly + monthly report would inflate either DR's revenue picture or NRPG's activation picture or both); (c) **qualification slippage** (without explicit D3 qualification fields and dedupe rules, marketing inflates the funnel with enquiries the business cannot service, which then makes channel performance look better than reality and distorts paid-pilot decisions). The three new friction points each side (DF11/12/13 + NF11/12/13) cover the operational risks the boardroom underweighted. The two-model DR economics framing is the right structural answer to a brand serving residential single-event claimants alongside multi-property recurring-account audiences.

### 3.2.5 Measurement + cadence + privacy — DR + NRPG _(CLOSED 2026-04-26)_

#### Part A — "Wins look like" (3-tier wins per surface · CEO-approved with 2 senior refinements)

**DR Tier 1 — Activation (weekly · with Hyper-Care daily for first 30 days):**

- D3 events / week (D3a + D3b separate, totalled, broken down per channel + service-area)
- D2 → D3 qualification rate
- D1 → D2 → D3 funnel rate per channel
- After-hours D3 capture rate
- **Intake Accuracy Score (CEO-added):** weekly delta between agent-qualified D3 categorisation (e.g. _"Category 3 Water"_) and actual operational reality at D4. If intake tags Cat 3 but contractor finds Cat 1 on-site, that mis-tag is captured in this score. Closes the feedback loop between marketing intake + operations.

**DR Tier 2 — Revenue + handoff (monthly):**

- D3 → D4 dispatch + acceptance rate
- D3 → D5 won-claim rate
- Average revenue per won claim (split by category)
- DR contribution margin per won claim _(Gap 4 prerequisite)_
- Source-of-truth job-ID match rate (no double-counting)
- Account / recurring-customer revenue % (Model 2 watch metric)

**DR Tier 3 — Ecosystem + Maps + AI-search (quarterly):**

- Cross-portfolio touch (% DR claimants → RestoreAssist / NRPG / CARSI / CCW within 90 days)
- AI-search visibility audit (directional, NOT KPI)
- Branded search growth + Search Console impressions on priority emergency-intent queries
- GBP performance per eligible profile (calls · directions · clicks · review velocity · photo views)
- Insurer co-marketing pilot outcomes (Gap 6)

**NRPG Tier 1 — Activation (weekly):**

- N2 applications / week per channel
- N2 → N3 acceptance rate (credential + commercial gate health)
- N3 events / week

**NRPG Tier 2 — Network activation + revenue (monthly · with senior refinement):**

- N3 → N4 activation rate (trust-burn risk metric)
- Median + P90 days N3 → N4 (NF12 audit)
- N4 → N5 revenue activation rate
- New paid N5 events / month
- Cross-sell-attributed N3s (T7 trigger + portfolio surfaces)
- **Credential Decay watch metric (CEO-added):** flag every active contractor whose IICRC certification, liability insurance, or other gated credentials expire within 30 days. Prevents N3 supply degrading into N6 dormant due to paperwork lapse alone. Surfaces in Tier 2 monthly review with proactive renewal nudge to contractor.

**NRPG Tier 3 — Ecosystem + retention (quarterly):**

- N6 90-day active retention rate (per N6 active definition)
- Service-area + capacity matrix coverage (NF11 audit)
- Cross-portfolio touch (% NRPG members → CARSI / RestoreAssist / CCW)

#### Part B — Reporting cadence (CEO-approved with Hyper-Care window)

**Hyper-Care window (CEO-mandated for first 30 days of DR pilot):**

> _"For the first 30 days of the DR pilot ($1–3k/mo), DR Tier 1 reporting moves from Weekly to Daily. In an emergency-intent environment, a broken phone route (DF2) or a failing form (DF1) for 7 days is a catastrophic waste of pilot budget. After 30 days of stability, revert to the Monday Weekly batch."_

| Report                                       | Cadence                                                 | Owner                                |
| -------------------------------------------- | ------------------------------------------------------- | ------------------------------------ |
| **DR Tier 1 — Hyper-Care daily snapshot**    | **Daily · first 30 days of pilot** · then Monday weekly | Analytics Lead                       |
| NRPG Tier 1 activation snapshot              | Weekly · Monday                                         | Analytics Lead                       |
| Portfolio claim-throughput headline (Q2.5.5) | Weekly · Monday                                         | Senior Strategist                    |
| DR + NRPG Tier 2                             | Monthly · 1st of month                                  | Performance + Attribution Lead       |
| DR + NRPG Tier 3 + AI-search audit           | Quarterly                                               | Senior Strategist                    |
| Marketing breaches                           | Next weekly review queue                                | Email Specialist + Analytics Lead    |
| **Privacy / data / claim / SLA incidents**   | **Same-day escalation**                                 | Whichever skill detects              |
| Eligible data breach                         | Immediate breach assessment + NDB if required           | Privacy/security owner               |
| Operational SLA breaches                     | Same-day to operations + CEO                            | Operations + Analytics Lead          |
| Friction-point fix proposals                 | After Gap 4 confirms which are real                     | CRO Specialist + Senior Strategist   |
| Founder content drafts                       | Continuous batch · 20–40/week                           | Senior Copywriter + Brand Strategist |

#### Part C — Privacy posture (CEO-approved with EXIF-stripping + Right-to-Be-Forgotten amendments)

**Posture statement:** _"Server-side primary, claim-data hardened, marketing-site separately scoped, source-of-truth job-ID secured, contractor + claimant data separately permissioned, no external AI model training on claim data, explicit transparency, incident-ready governance."_

**Compliance language:** _"Designed to support compliance with the Australian Privacy Act 1988, the Australian Privacy Principles, the Spam Act 2003, the Notifiable Data Breaches scheme, and GDPR-style processor/controller expectations where relevant. Insurer-side data handling additionally aligns with the General Insurance Code of Practice where applicable."_

**Privacy hard rules — 16 total (CEO-approved with P10 amendment + new P16):**

| #       | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1      | Claim data NEVER leaves the DR / NRPG operational stack for marketing analytics, AI training, advertising, or third-party trackers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| P2      | Property addresses + claimant names + damage photos are restricted access · least-privilege controls · access logged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| P3      | Damage photos and incident-scene material may NOT be used in any public marketing without explicit written claimant + owner permission                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| P4      | Insurer correspondence + claim numbers + policy references are confidential · never appear in marketing copy, case studies, or content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| P5      | Source-of-truth job ID + linked DR/NRPG records require strict access boundaries (marketing analytics = aggregate, de-identified · operational records = full claim data, restricted)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| P6      | Contractor commercial data (rates, financials, capacity) is contractor-confidential · never used for marketing without explicit permission                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| P7      | NDB process maintained · breach assessment starts immediately · regulator notification per Privacy Act 1988 timeframes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| P8      | Subprocessor register + data residency disclosure · AU residency where commercially + technically feasible                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| P9      | Customer access / correction / deletion requests supported per AU Privacy Act, with documented retention exceptions for active claims · regulatory · insurer · audit · backup-retention                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **P10** | **GBP photos require permissioned source — never publish photos that include identifiable property, claimant, tenant, or third-party material without written permission. CEO AMENDMENT: Any photo permissioned for use must have EXIF data (GPS coordinates, timestamps, device identifiers, embedded location/owner metadata) scrubbed server-side before upload to GBP or any marketing surface. Metadata stripping is mandatory + automated · not optional · not manual.**                                                                                                                                                                                                                                                                          |
| P11     | AI-feature interactions (any AI in dispatch, intake, classification) — contractor-owned + claimant-owned · server-side · NEVER train external AI models · no internal training on claim data without explicit consent + lawful de-identification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| P12     | Automated-decision transparency review by 10 December 2026 (Privacy Act 2024 amendments)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| P13     | Incident response process — detection · containment · assessment · customer communication · regulator notification where required · post-incident review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| P14     | Mailchimp marketing rules (consent · clear sender · DKIM/SPF/DMARC · suppression · transactional vs promotional separation · NO claim-data inserted into marketing emails without explicit permission)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| P15     | No public privacy / security / review / compliance / data-residency claim used unless verified and tagged `[verified-DD/MM/YYYY]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **P16** | **Right-to-Be-Forgotten protocol with de-identified retention (CEO-added). The source-of-truth job ID must support: (a) full PII purge on lawful claimant deletion request — name · address · contact details · damage photos · personally-identifiable metadata · insurer correspondence references; (b) retention of de-identified job economics for NRPG historical records — service category · region · approximate value · contractor matching · timeline · operational outcome — stripped of any PII or property-identifiable detail. The de-identified record is what survives a deletion request; the PII-bearing record is purged. This protects the claimant's Privacy Act rights without erasing NRPG's operational + commercial history.** |

#### Part D — Final 15 hard rules for DR + NRPG (CEO-approved closing set)

1. **Parallel Independence:** DR and NRPG funnels are measured separately. Never aggregate D-funnel + N-funnel into a single conversion metric.
2. **D3 Split:** DR optimises toward D3 (Qualified Enquiry). D3 must be reported as D3a (Form) and D3b (Phone) with distinct attribution.
3. **D3 Purity:** D3 excludes all duplicates, spam, out-of-area, and non-DR categories (incl. recruitment).
4. **N3 Readiness:** NRPG marketing optimises toward N3 (Accepted + Onboarding-ready). Marketing's job ends once the contractor is credential-verified and commercially aligned.
5. **The Activation Gap:** N4 (First Claim Accepted) is the _"Trust-Burn"_ metric. If N3 → N4 exceeds the agreed window, it triggers an immediate supply/demand review.
6. **SOT Job ID:** A single Source-of-Truth Job ID must link every record from D3/N2 through to D5/N5 to prevent double-counting.
7. **Pilot Terminology:** Cost per D3 and Cost per N2 are **CPL (Cost Per Lead)**, not CAC. CAC is only calculated at the revenue-event stage (D5/N5).
8. **Dual-Model Economics:** DR must report one-off residential claims and recurring account-based (Strata/PM) revenue separately.
9. **Privacy Tier 1:** Claim data (PII, addresses, photos) NEVER leaves the hardened operational stack for marketing or AI training.
10. **Visual Taboo:** Damage photos and property-identifiable imagery strictly prohibited from marketing without written, permissioned clearance **+ EXIF metadata scrubbing**.
11. **No AI Training:** No external AI models trained on claim data. Internal AI features must be server-side and permission-bound.
12. **Transparency Deadline:** Automated-decision transparency documentation finalised by **10 December 2026**.
13. **Escalation SLA:** Privacy, data, or operational SLA breaches require **same-day** escalation.
14. **Truth-in-Copy:** No guarantees of claim acceptance, insurer payout, or _"guaranteed work"_ for contractors.
15. **The `[Verified]` Gate:** No public claims regarding compliance or security permitted unless tagged with `[verified-DD/MM/YYYY]`.

**Boardroom rationale on senior refinements:** the CEO's three additions close gaps the boardroom missed — (a) **Intake Accuracy Score** is the marketing-to-operations feedback loop that prevents agent intake quality from drifting unmeasured (without it, mis-tagged D3s look fine on paper while burning operational trust); (b) **Credential Decay watch** is the difference between supply that looks active and supply that's actually deployable, and the 30-day forward window converts a paperwork problem into a marketing-led contractor-success workflow; (c) **EXIF stripping + Right-to-Be-Forgotten with de-identified retention** is the single most important privacy hardening in the entire plan — automated EXIF scrubbing eliminates an entire class of accidental claimant-location leaks (a single photo with embedded GPS could reveal a private property address); the de-identified retention pattern lets NRPG keep operational history without retaining personal data, satisfying both the Privacy Act and the operational requirement to learn from past jobs. The Hyper-Care daily window for the first 30 days of DR pilot is the right calibration — emergency-intent budget cannot afford a 7-day undetected break in the conversion path.

---

## ✅ Phase 3.2 — DR + NRPG profile: COMPLETE (5/5)

**Profile summary:**

- **Identity (Q3.2.1):** Two distinct identity systems inside one business · DR `brand_anonymous` Hero/Caregiver/Sage · NRPG `hybrid_phill_strategic` Sage/Ruler/Mentor · 30 taboos total · all quantitative/scope/coverage claims verification-gated · CTA-separation rule.
- **Audience JTBD (Q3.2.2):** 5 DR audiences (Property Owners · Property Managers · Strata Managers · Business Owners · Insurers as gatekeepers) + 1 NRPG ICP · 13 wording amendments removing every guarantee-implication · 10 hard rules including verification-gated claims + claim-outcome rule + calm-urgency rule + no-guaranteed-work rule.
- **Discovery + Distribution (Q3.2.3):** Channel maps · GBP compliance rule · AI-search realism rule · schema discipline · 30/30/30 sequencing (Gap 4 audit → P0 foundations → controlled publishing) · paid-search prerequisites · trade-Facebook-group conduct rule · IICRC trademark gate · 4 tracked Gaps (4–7).
- **Conversion architecture (Q3.2.4):** Two parallel funnels · D3 split (form + phone) · N3 redefined (accepted + onboarding-ready) · N6 active definition · source-of-truth job ID · 6 new friction hypotheses (DF11/12/13 + NF11/12/13) · two-model DR economics · NRPG LTV vs throughput distinction · 15 hard rules with corrected CPL vs CAC terminology.
- **Measurement + privacy (Q3.2.5):** 3-tier wins per surface · Hyper-Care daily snapshot for first 30 days of DR pilot · Intake Accuracy Score · Credential Decay watch · 16 privacy P-rules including EXIF stripping + Right-to-Be-Forgotten with de-identified retention · 15 final hard rules.

**Gaps blocking execution:** Gap 3 (RestoreAssist asset+attribution audit) · Gap 4 (DR + NRPG asset+coverage+permission audit — P0) · Gap 5 (per-eligible-profile GBP plan, depends on Gap 4) · Gap 6 (insurer co-marketing pilot framework) · Gap 7 (Property Manager + Strata acquisition surfaces — DR + RestoreAssist mirror).

---

## Phase 3.3 — CARSI

> Inherits Phase 1 + Phase 2.5. Voice tag = `hybrid_phill_strategic_brand_routine` (Q2.5.5). Role in portfolio = **Compliance Gatekeeper · Technical Source of Truth · margin-positive revenue brand · mandatory bridge between NRPG N2 and N3**.

### 3.3.1 CARSI Strategic Foundation — Mandatory Authority Model _(CLOSED 2026-04-26)_

**CEO direction (E — Custom):**

> _"CARSI is the Technical Source of Truth for the ecosystem. It does not exist to 'attract' NRPG members with freebies; it exists to qualify and monetize the technical excellence required to represent the network."_

#### The Three Jobs of the Mandatory Model

1. **The Gatekeeper (NRPG Compliance)** — Every NRPG member pays for CARSI. It is the mandatory bridge between _Applying_ (N2) and being _Onboarding-ready_ (N3). **No CARSI certification = No NRPG status.**
2. **The Credentialing Engine (Standalone Revenue)** — CARSI remains the primary, cost-effective path for any Australian tech to maintain IICRC CECs, regardless of NRPG status. This captures the broader-market revenue.
3. **The Risk Mitigator** — By mandating CARSI training, the ecosystem's liability is reduced. If a contractor follows CARSI-taught S500/S520 standards, the _Intake Accuracy Score_ (Q3.2.5 Tier 1) and Job Quality metrics stay high.

#### Pricing & Access Strategy

- **Decoupled Revenue:** CARSI revenue is separate from NRPG fees. **NRPG membership is the right to receive jobs; CARSI is the cost of maintaining the professional standard required to hold that right.**
- **Tiered Subscription:**
  - **Individual Tech:** $20/mo `[placeholder · pricing example]` for CEC maintenance
  - **Contractor Firm:** $795/yr `[placeholder · pricing example]` for all-access training for their team
- **The NRPG Hard Rule:** _"Access to the NRPG job board is conditional upon active CARSI certification status."_ T5 trigger (cert expiry < 90 days) becomes an NRPG suspension warning.

#### CARSI Hard Rules (Foundation — 4 binding)

1. **Not Free.** CARSI is a margin-positive revenue brand. No free access for NRPG members; it is a mandatory business expense for network participation.
2. **Compliance over Courses.** Marketing copy emphasises _"Maintain your NRPG eligibility"_ and _"IICRC Compliance"_ over _"Learn new skills."_
3. **The T5 Kill-Switch.** If a contractor's CARSI credentials expire, their NRPG _Active_ status (N6) is automatically flagged for suspension.
4. **IICRC Moat.** The brand remains strictly anchored to IICRC CEC-yielding content to protect its _Technical Authority_ search positioning.

#### Verification Gates for CARSI (Gap 4 integration)

| Metric / Gate                 | Status                  | Goal                                                                               |
| ----------------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| IICRC CEC Provider Status     | `[verification needed]` | Confirm CARSI is an approved IICRC CEC provider                                    |
| Mandatory Sync (CARSI → NRPG) | `[placeholder]`         | Confirm technical link — does CARSI "completion" automatically unlock NRPG status? |
| Pricing Fidelity ($20 / $795) | `[verified-26/04/2026]` | Revenue baseline                                                                   |
| "Intro to Drying" Audit       | `[placeholder]`         | Is this module sufficient as the "Entry Gate" for new NRPG applicants?             |

#### Downstream changes this answer triggers (must propagate)

- **Q3.2.4 N3 definition extends:** _Application reviewed, credentials verified, commercial requirements accepted, **active CARSI certification status confirmed**, contractor approved as onboarding-ready._ CARSI active status now joins IICRC + liability + experience + safety + commercial terms in the N3 gate.
- **Q3.2.4 N6 active retention extends:** dormancy is triggered by **CARSI credential expiry** in addition to the prior N6 conditions (credential-current · contactable · responsive · not paused/suspended/removed).
- **Q2.5.2 trigger T5 strengthens** from a CEC nudge into a **suspension warning + kill-switch** when CARSI credentials expire on an active NRPG contractor. T5 escalation path: T-90 nudge → T-30 urgent → T-7 final → T+0 NRPG status flagged for suspension review.
- **Q2.5.2 trigger T10 inverts:** was _"CARSI 1st course complete → NRPG application nudge"_; now _"CARSI 1st course complete = NRPG eligibility checkpoint reached"_ — required step in the NRPG application flow, not a marketing nudge.
- **Q3.2.1 NRPG taboo 15 extends:** _"implying contractors receive work without meeting standards · onboarding · documentation · insurance · performance expectations · OR active CARSI certification status"_.
- **RestoreAssist Q2.5.2 trigger T8** (RA auto-insertion limit → CARSI) becomes a **revenue-positive cross-sell** rather than a nurture nudge — every RA-using NRPG contractor must hold active CARSI status, so T8 surfaces as a renewal/upgrade prompt rather than an optional module pitch.

Boardroom rationale: the Mandatory Authority Model is the strongest possible CARSI foundation in this portfolio. It (a) **locks CARSI revenue against NRPG churn** — every active network member is a CARSI subscriber by definition, eliminating the "lead magnet but not a paying customer" leakage path; (b) **converts a feeder brand into a compliance moat** — the operator now controls professional-standard maintenance for the network it sells claim flow into, which compounds insurer trust on the DR side; (c) **resolves the C-vs-revenue tension cleanly** — there is no member-benefit ambiguity, no free-tier debate, no "is CARSI a profit centre or a cost centre" confusion; (d) **simplifies the brand voice** — Sage authority is the natural register for compliance gatekeeping, and the _"Compliance over Courses"_ marketing emphasis aligns the copy with the buyer reality (owners buying compliance, not techs buying knowledge). The trade-off: CARSI loses the optional softer "training for everyone" positioning and becomes harder-edged. That is the right trade for this portfolio.

### 3.3.2 Audience JTBD — CARSI _(CLOSED 2026-04-26)_

**CEO direction:** **Direction 1 — Business Owner primary · Individual Tech deep secondary.**

- Primary homepage messaging: _"Maintain your NRPG eligibility · keep your team's IICRC compliance current · the standard the network requires."_
- Individual Tech served via deep secondary `/cec-maintenance` landing pages + paid-search lanes targeting personal-CEC intent.

**Audience A — Individual Tech** (broader-market revenue): _"I need my IICRC CECs so I don't lose my personal certification, and I want it done fast and cheap."_ Decision profile: $20/mo low-threshold · individual buyer · faster conversion · higher volume · lower ACV.

**Audience B — NRPG Contractor Owner** (higher ACV · NRPG-funnel): _"I need my team certified so I can stay on the NRPG panel."_ Decision profile: $795/yr/firm `[placeholder]` · firm-level buyer · longer consideration cycle · 5–10× ACV vs Individual Tech · embedded in NRPG eligibility.

Boardroom rationale: 5 reasons converged the panel on Direction 1 — (a) the Mandatory Authority Model is owner-language by design, (b) 5–10× ACV gap is too large to ignore, (c) NRPG primary flywheel pulls CARSI's primary audience from the primary flywheel, (d) Individual Tech is NOT abandoned (deep secondary surfaces with own value-prop + conversion path), (e) AI-search visibility consolidates better with one primary category claim. Reversibility flag: if Gap 4 reveals NRPG penetration is small relative to broader IICRC AU population (e.g., < [n]%), revisit the prioritisation.

### 3.3.3 Discovery + Distribution — CARSI _(CLOSED 2026-04-26)_

**CEO direction:** **E — Paired-primary recommendation: C + B as P0 in parallel · A + D as P1 starting day 30.**

| Channel                            | Resource                                                                         | Allocation            | Why                                                                                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C — IICRC Channel**              | CEO executive time (1–2 hr/wk × 4–6 weeks)                                       | **P0 — start day 1**  | Until Gap 4 confirms IICRC CEC provider status, the entire Mandatory Authority Model has a binary credibility risk. Highest-leverage spend of executive time available right now. |
| **B — LinkedIn Founder Authority** | Founder LinkedIn budget (~1 of 2 weekly posts allocated to CARSI-themed content) | **P0 — start day 1**  | Voice tag permits it · audience already there · doesn't depend on IICRC verification · runs in parallel with C verification work.                                                 |
| **A — YouTube Technical Proof**    | Agent-team production · 1 video/month + companion page                           | **P1 — start day 30** | Deploys after IICRC verification clears; videos can credibly reference IICRC-aligned standards without partner-permission risk.                                                   |
| **D — AEO / Search**               | Agent-team production · 2 GEO/AEO pieces/month + schema                          | **P1 — start day 30** | Builds durable entity authority. Compounds harder once C verifies.                                                                                                                |

**Trust hierarchy this creates:** IICRC Stamp (C) legitimises the mandate exists → Founder Voice (B) explains why the mandate matters → Technical Proof (A) shows the standards have substance → Search Utility (D) carries the message to new owners.

Boardroom rationale: C is the highest-trust outcome but B is the highest-velocity action TODAY. Paired-primary captures both. A and D wait 30 days because both touch IICRC + technical-standards content; producing them before C verifies risks Q3.2.3 Amendment 9 violations (implying IICRC partnership before verified). Bandwidth math fits Phase 1.1: 1–2 hr/wk executive time on C + ~1 founder LinkedIn post/week tagged CARSI = ~3–4 hr/wk total CEO involvement.

### 3.3.4 Conversion architecture — CARSI _(CLOSED 2026-04-26)_

**CEO direction:** **C — Team Compliance Snapshot tool with renaming + privacy + tone guardrails baked in.**

**Funnel for Audience B (the Owner):**

- C1 — Awareness/Discovery (LinkedIn Thesis · NRPG referral · IICRC channel · organic search)
- C2 — Compliance Check (lands on `/for-firms` · primary CTA = _"Verify your Team's Eligibility"_, NOT _"Buy a Course"_)
- **C3 — The Team Compliance Snapshot (Primary Converter)** · interactive diagnostic surfacing firm-specific compliance gap
- C4 — Firm-Tier Activation ($795/yr `[placeholder]` firm subscription)
- C5 — T10 Trigger fires (CARSI completion → NRPG eligibility checkpoint reached, automated handoff to N3 onboarding)

**The Team Compliance Snapshot — operating rules (CEO-approved):**

1. **Naming:** _"Team Compliance Snapshot"_ (NOT _"Audit"_ or _"Gap Analysis"_ — both trend toward fear-framing). Sage voice + calm-urgency tone govern every UI string.
2. **Privacy stack:** opt-in only · server-side · no third-party trackers · explicit consent before any data persists · owner-deletable on request (Q3.2.5 P16) · never reused for marketing without explicit per-firm consent (Q3.2.5 P6) · de-identified retention for product-improvement only with lawful de-identification (Q3.2.5 P11)
3. **Output discipline:** measured artefact — table of techs · cert status · expiry timeline · firm-tier subscription value calculation · single CTA. Forbidden tone: specific dollar earnings claims · _"you'll lose work"_ · _"your insurer will reject you."_ Approved tone: _"These N techs reach cert expiry within 90 days. The firm subscription keeps the team current."_
4. **Conversion mechanic:** Snapshot completion → automated email summary forwardable to team / accountant / NRPG application reviewer → firm-tier subscription CTA in email + in-app result page

**Phased implementation (CEO-approved sequencing):**

- **Days 0–14:** Static PDF Checklist (_"The AU Restoration Firm Compliance Checklist"_) as interim primary converter while Snapshot tool builds. Low-effort, gathers initial lead data.
- **Days 15–60:** Interactive Snapshot tool deploys. Step-function increase in conversion expected as the tool does the manual audit work for the owner.
- **Days 60–90:** Snapshot + Mailchimp integration + firm-tier checkout flow (closes the conversion loop end-to-end).

**Verification gates:** engineering capacity for Snapshot tool build · privacy review of Snapshot data flow · cross-brand content permissions (if Snapshot references RestoreAssist NCC 2022 / cost libraries) · opt-in consent UX · firm-tier checkout flow.

### 3.3.5 Measurement + cadence + privacy — CARSI _(CLOSED 2026-04-26)_

**CEO direction:** **B — Snapshot Completion Rate as the canary** with A as paired headline outcome and C as Tier 1 watch metric.

**3-tier wins structure (CEO-approved):**

**Tier 1 — Activation (weekly · Monday morning):**

- **CANARY: Snapshot Completion Rate** — measures whether the C3 conversion mechanic is functioning. Snapshot starts → completions → drop-off-by-stage. Highest weekly volume + most diagnostic + causally upstream of activations.
- New Firm-Tier Subscriptions (paired headline outcome with Snapshot → activation lag rate)
- Individual CEC Subscriptions (secondary volume win)

**Tier 2 — Handoff + Retention (monthly):**

- CARSI → NRPG Conversion (T10): % of CARSI firms that complete an NRPG application
- **Credential Decay Rate (watch metric):** % of firm-tier population with expired or T-90 at-risk certs. T5 escalation pathway (T-90 → T-30 → T-7 → T+0 suspension flag) feeds this.
- Course Completion Rate (are techs actually consuming what owners paid for?)

**Tier 3 — Ecosystem Authority (quarterly):**

- IICRC Entity Visibility — AI-search visibility audit (directional, NOT KPI per Q3.2.3 Amendment 2)
- Cross-Brand Influence — % of CARSI firms also using RestoreAssist (T8 trigger)

**Privacy posture (CARSI-specific):**

- **P16 Implementation (Right-to-Be-Forgotten with de-identified retention):** owners may delete team data via documented support pathway · de-identified records retained for ecosystem-wide compliance trend tracking (course category · pass rates · regional patterns — never tied to identifiable individuals)
- **No Third-Party PII Leaks:** training records often contain tech names + birth dates for IICRC filing requirements. These records NEVER touch marketing trackers · third-party advertising pixels · analytics destinations. Server-side primary, IICRC-filing-purpose-bound.
- **Inheritance:** all 16 P-rules from Q3.2.5 apply to CARSI in addition to the two CARSI-specific rules above.

**CARSI Monday-morning report structure:**

```
▸ CARSI WEEKLY                          Δ vs prior 7-day average
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CANARY: Snapshot Completion Rate    [%]                  +/- pp
       Snapshot starts                  [n]
       Snapshot completions             [n]
       Drop-off points (top 3 stages)   [list]

   OUTCOME: New Firm-Tier Activations   [n]                  +/- %
       From Snapshot path               [n]
       From direct/other paths          [n]
       Snapshot → activation rate (lag) [%]                  +/- pp

   WATCH: Credential Decay Flags        [n] firms · [n] techs
       T-90 nudges sent                 [n]
       T-30 escalations                 [n]
       T-7 final warnings               [n]
       Suspensions triggered (T+0)      [n]   ← any non-zero = same-day
```

Boardroom rationale: B is causally upstream of A, has the highest weekly volume from launch, diagnoses the value prop not just the conversion mechanic. The Snapshot → activation lag rate paired under outcome catches Goodhart's Law (if completion rises while activations stay flat, the team sees the disconnect). C as watch metric maintains visibility on existing-customer trust-burn signals at the right cycle length without crowding the canary slot.

---

## ✅ Phase 3.3 — CARSI profile: COMPLETE (5/5)

**Profile summary:**

- **Strategic foundation (Q3.3.1):** Mandatory Authority Model · Compliance Gatekeeper · Technical Source of Truth · margin-positive · IICRC-anchored. Three Jobs: Gatekeeper · Credentialing Engine · Risk Mitigator. 4 hard rules: Not Free · Compliance over Courses · T5 Kill-Switch · IICRC Moat.
- **Audience JTBD (Q3.3.2):** Business Owner primary · Individual Tech deep secondary. ACV-anchored prioritisation aligned with NRPG primary flywheel.
- **Discovery + Distribution (Q3.3.3):** Paired primary — IICRC Channel verification (CEO executive time, day 1) + LinkedIn Founder Authority (founder budget, day 1) · YouTube + AEO P1 starting day 30.
- **Conversion architecture (Q3.3.4):** Team Compliance Snapshot (renamed from Audit/Gap Analysis) · phased: PDF days 0–14 → Snapshot days 15–60 → integrated checkout days 60–90. Privacy + tone discipline binding.
- **Measurement + privacy (Q3.3.5):** Snapshot Completion Rate canary · Firm-Tier Activations outcome · Credential Decay watch · 16 P-rules + 2 CARSI-specific (P16 de-identified retention + no third-party PII leaks).

**Downstream changes propagated portfolio-wide:**

- Q3.2.4 N3 + N6 definitions extend to require active CARSI status
- Q2.5.2 trigger T5 strengthens (kill-switch escalation T-90 → T-7 → T+0)
- Q2.5.2 trigger T10 inverts (CARSI completion = NRPG eligibility checkpoint, not nudge)
- Q3.2.1 NRPG taboo 15 extends (no work without active CARSI status)
- RestoreAssist Q2.5.2 trigger T8 becomes revenue-positive cross-sell

---

## Phase 3.4 — CCW (Carpet Cleaners Warehouse · Synthex client engagement)

> Architectural framing locked 2026-04-26: **CCW is a Synthex marketing-services client, structurally adjacent to the Unite-Group Nexus rather than nested inside it.**

### CCW-as-Synthex-client architectural correction

**Context:** during Phase 2 portfolio crawl, CCW was assumed to be one of five vertically-integrated brands inside the Unite-Group ecosystem. Re-reading the site evidence in this light:

- DR site footer confirms only RestoreAssist's Unite-Group ownership
- DR site "Executive Partners" lists _IICRC, CARSI, RestoreAssist, NRPG_ — **CCW is NOT in that list**
- CCW's own site has no Unite-Group footer · no NRPG affiliation · no shared corporate identity

**Conclusion:** the Unite-Group portfolio is **DR + NRPG + RestoreAssist + CARSI** (four brands, one operator). CCW is a **fifth surface served by Synthex** but commercially independent — a marketing-services client engagement.

### L1–L9 carve-out: Unite-Group Nexus vs CCW (Synthex client)

| Layer                                        | Inside Unite-Group Nexus (DR + NRPG + RA + CARSI)           | CCW as Synthex client                                                                                                                                         |
| -------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L1 — Customer identity / contact records** | Pooled · Single Source of Truth across the four             | **Strictly isolated** — CCW customer data is CCW-owned, never pooled with Unite-Group contacts                                                                |
| **L2 — ESP**                                 | Per-brand sender + portfolio cadence ledger across the four | **Independent** — CCW's ESP (Klaviyo via Shopify or Mailchimp — `[verification needed]`) operates separately; cadence pooling does NOT cross the CCW boundary |
| **L3 — Conversion + attribution analytics**  | Shared portfolio event keys span the four                   | **Client-owned / separate domain** — CCW analytics are CCW-owned; cross-flywheel attribution into Unite-Group requires explicit data-sharing agreement        |
| **L4 — Brand voice / tone**                  | Per-brand Sage/Caregiver/Hero/Pioneer mix                   | **`brand_anonymous`** retained under Synthex client engagement                                                                                                |
| **L5 — Visual identity / design tokens**     | Per-brand marks + portfolio components                      | CCW design tokens client-owned; Synthex applies portfolio-grade design discipline but no shared tokens cross the client boundary by default                   |
| **L6 — Content programme**                   | Portfolio with per-brand lanes inside the four              | CCW Hub content is CCW-owned; Synthex authors it for the client under named-but-not-Phill expert byline                                                       |
| **L7 — GBP / Local citations**               | Per-brand · DR-only inside the four                         | Single org GBP at most (warehouse/shipping model · not local-services)                                                                                        |
| **L8 — AI search / GEO+AEO**                 | Portfolio entity authority compounds across the four        | CCW entity authority is CCW's own; portfolio compounding still happens via shared restoration vocabulary but not via shared org-entity claims                 |
| **L9 — Founder-fronted thought leadership**  | Portfolio-tagged · Phill-fronted                            | **No founder presence** — CCW voice tag is `brand_anonymous`; Phill never appears on CCW                                                                      |

**Cross-sell trigger framing:** T4 (CCW capital purchase → NRPG + RA nudge) and T9 (CCW cart abandonment > $1,500) cross a **client boundary**. Activating either requires explicit CCW client agreement on cross-promotion + GDPR-style processor/controller clarity. Synthex = processor · CCW = controller.

### 3.4.1 Strategic Foundation — The Hybrid Hub _(CLOSED 2026-04-26)_

**CEO direction:** **C — Hybrid Hub** (operator-grade content layered on top of the existing commerce engine, NOT replacing it).

| Component         | Status                  | Definition                                                                |
| ----------------- | ----------------------- | ------------------------------------------------------------------------- |
| Brand Name        | `[verified-26/04/2026]` | Carpet Cleaners Warehouse (CCW)                                           |
| Source of Truth   | `[verified-26/04/2026]` | ccwonline.com.au                                                          |
| Primary Trigger   | LOCKED                  | T4: capital purchase / capital equipment → NRPG + RA nudge                |
| Secondary Trigger | P2 → P1 STAGED (Q3.4.4) | T9: cart abandonment > $1,500 → recovery + RA alt                         |
| Voice Tag         | LOCKED                  | `brand_anonymous`: trade-direct · product + price + expert-content driven |

**Position:** Carpet Cleaners Warehouse remains Australia's professional-trade carpet cleaning + restoration commerce engine. Hub content layered on top of established Shopify catalogue: product comparisons · capital-equipment buying guides · restoration-chemical reference · before/after operational case studies. Authored by named-but-not-Phill technical-expert bylines.

### 3.4.2 Audience JTBD — Restoration Specialist primary _(CLOSED 2026-04-26)_

**CEO direction:** **B — Restoration Specialist primary content lead · Standard Operator deep secondary lane · Bridge converter content for natural evolution.**

| Audience                   | Role      | Content Focus                                                                                                                                            |
| -------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Restoration Specialist** | PRIMARY   | Capital equipment (truckmounts · dehumidifiers · air movers) · NCC 2022 standards · IICRC S500-aligned operational content · high-margin research guides |
| **Standard Operator**      | SECONDARY | Chemical comparisons · parts/maintenance · commodity research                                                                                            |
| **The "Bridge"**           | CONVERTER | _"Scaling into Restoration"_ guides (routes Audience A → B; bridges into NRPG + CARSI)                                                                   |

**90-Day content sequencing:**

- Days 0–30: P0 capital equipment guides (heavy hitters — truckmount comparisons, restoration-grade dehumidifier reviews)
- Days 30–60: Secondary chemical/parts guides + Bridge content
- Days 60–90: Sector-specific specialisation (strata · insurance-grade checklists)

Boardroom rationale: T4 is purchase-defined not audience-defined; capital purchases are what fire the cross-sell engine. Specialist-primary content is portfolio-coherent (shares vocabulary with CARSI/RA/DR) · highest contribution margin per buyer · lowest competition on AU long-tail technical queries · natural-evolution bridge captures Standard Operator → Specialist transitions for portfolio LTV.

### 3.4.3 Discovery + Distribution — Search-led, video-validated _(CLOSED 2026-04-26)_

**CEO direction:** **D — Paired-primary: B Authority Lead + A paired P0-secondary + C P1 nurture (post-verification).**

| Channel                      | Role               | Priority | Resource / Cadence                                                           |
| ---------------------------- | ------------------ | -------- | ---------------------------------------------------------------------------- |
| **Google / AI Search**       | Authority Lead     | **P0**   | 1–2 articles/week (capital gear comparisons, NCC 2022/IICRC-aligned content) |
| **YouTube + companion page** | Validation Layer   | **P0**   | 1 video/month + transcript-rich companion page (Q3.1.3 Amendment 4 binding)  |
| **Email / Retargeting**      | Nurture / Recovery | **P1**   | Cart abandonment (T9) + content broadcasts · gates on CCW ESP audit          |

**Trade-expert byline rule:** all Hub content attributed to a named-but-not-Phill technical expert (e.g., _"Review by Mark S., Senior Equipment Specialist at CCW"_ — actual byline subject to CCW client confirmation). Protects founder bandwidth · aligns with `brand_anonymous` trade-direct persona.

**Buyer journey:** trigger → Google/AI Search (entry point B) → reads comparison article → YouTube validation (A) → returns to article + spec verification → cart-add → T4 fires on completed purchase. Search-led, video-validated, email-nurtured.

### 3.4.4 Conversion architecture — Sequenced T4/T9 activation _(CLOSED 2026-04-26)_

**CEO direction:** **D — Sequenced activation: T4 wired live Days 0–30 · T9 verification Days 0–60 · T9 activated as P1 Days 61–90.**

**CCW funnel:**

- C1 — Hub Entry (visitor lands on comparison article or technical guide)
- C2 — Product Consideration (Shopify product page click-through)
- C3 — Trust-Bridge (technical spec sheets · warranty · operational ROI · links back to Hub research)
- C4 — Cart Activation ($1,500+ high-value cart-add)
- **C5 — T4 / T9 Triggers:**
  - **T4** (the win): capital purchase completed → NRPG application nudge + RestoreAssist trial nudge (single-touch post-purchase email · CCW client agreement required for cross-promotion)
  - **T9** (recovery): cart abandoned → content-led recovery sequence (uses Hub articles as _"Final Comparison Guide"_) · activates Day 60+ once Hub content live + ESP audit clears

**Sequencing:**

| Window                   | Action                                                                                                                                    | Triggers active              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Days 0–30**            | T4 wired live · checkout UX optimisation parallel                                                                                         | T4 active · T9 P2 deferred   |
| **Days 0–30 (parallel)** | Verification + setup for T9: ESP audit · cart-add tracking · source attribution · CCW-client cross-promotion permission · Spam Act review | T9 prep                      |
| **Days 31–60**           | Hub content shipping · T9 wiring complete in test mode · standard Shopify recovery in interim                                             | T4 active · T9 wiring tested |
| **Days 61–90**           | T9 activated as P1 · cart-abandonment fires content-led recovery using shipped Hub articles                                               | T4 + T9 both active          |

**Verification gates (Gap 8 — CCW-specific):** CCW client agreement on T4/T9 cross-promotion · ESP audit (Klaviyo via Shopify likely) · cart-add + abandonment trigger event wiring · source attribution + UTM tagging · Spam Act 2003 + AU Privacy Act consent state at cart-add · Privacy Policy update for cross-promotion to Unite-Group entities · GDPR-style processor/controller documentation (Synthex = processor · CCW = controller).

### 3.4.5 Measurement + cadence + client posture — Hub Article-to-Cart-Add canary _(CLOSED 2026-04-26)_

**CEO direction:** **A — Hub Article-to-Cart-Add Rate as the canary** with B (T4 fires) as Tier 2 outcome and C (Organic Search Impressions) as Tier 3 watch.

**3-tier wins structure (CEO-approved):**

**Tier 1 — Activation (weekly):**

- **CANARY: Hub Article-to-Cart-Add Rate** — proves the research content is identifying and converting high-LTV buyers
- New Capital-Tier Checkouts ($1,500+) — primary outcome paired with Hub-attributed checkouts %
- T4 Trigger Successful Fires — measure of the cross-client nudge working

**Tier 2 — Handoff + Revenue (monthly):**

- T4 → NRPG/RA Conversion Rate — how many CCW buyers actually entered the Nexus
- Average Capital Order Value (ACOV) — tracking the chemical-focus → equipment-focus shift

**Tier 3 — Authority (quarterly):**

- AEO Citation Growth — CCW appearing as Technical Source in AI search results for capital equipment (directional snapshot, NOT hard KPI per Q3.2.3 Amendment 2)
- Organic Search Impressions on priority capital-equipment queries
- Branded search growth + ranking movement

**Sequencing rule:** Until Hub content ships (Days 30+), the canary is NOT yet meaningful. Days 0–30 focus on baseline establishment + ESP audit + content production pipeline. From Day 30 onwards (first Hub articles publish), the canary activates. Days 60+ adds T9 cart-recovery into the outcome line.

**CCW client privacy posture (the "Synthex Clause"):**

- **Data Sovereignty:** CCW data remains CCW data. Synthex acts as Data Processor, not owner.
- **Cross-Promotion Opt-In:** Nudges to NRPG/RestoreAssist must satisfy Spam Act 2003 — _transactional_ vs _marketing_ consent clearly defined at checkout.
- **Privacy posture statement:** _"Server-side primary, client-owned data, marketing-site separately scoped from product transactions, cross-promotion gated by explicit CCW client agreement, processor/controller relationship documented."_
- All 16 P-rules from Q3.2.5 inherit where applicable; CCW-specific privacy adds the processor/controller framing.

**Goodhart mitigation:** canary paired with content-quality watch (Hub article time-on-page + scroll-depth). If cart-add rate climbs while time-on-page collapses, content is being dumbed down.

**CCW Monday-morning report structure:**

```
▸ CCW WEEKLY                            Δ vs prior 7-day average
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CANARY: Hub Article-to-Cart-Add Rate    [%]                +/- pp
       Hub article views                    [n]
       Article → product page CTA clicks    [n]
       Product page → cart-add              [n]
       Drop-off points (top 3 stages)       [list]
       Content-quality watch:
         · Avg time-on-page (Hub articles)  [m:ss]            +/- s
         · Avg scroll-depth (Hub articles)  [%]               +/- pp

   OUTCOME: New Capital-Tier Checkouts ($1,500+)  [n]         +/- %
       From Hub-attributed path             [n]
       From direct/other paths              [n]
       Hub → checkout rate (lag)            [%]               +/- pp

   WATCH: T4 Trigger Volume                 [n] fires this week
       T4 fired                             [n]
       T4 → NRPG application click-through  [%]
       T4 → RA trial signup click-through   [%]
```

Boardroom rationale: A is the most causally upstream metric in the Hybrid Hub model, has the highest weekly volume from launch, and is most diagnostic. B is the right Tier 2 outcome (capital purchases are slow, high-value, monthly-readable). C is the right Tier 3 quarterly authority signal (search rankings shift over weeks/months not days). Pattern-match across DR/CARSI/CCW: every brand canary measures conversion-mechanism health at the upstream end, never the outcome.

---

## ✅ Phase 3.4 — CCW profile: COMPLETE (5/5)

**Profile summary:**

- **Strategic foundation (Q3.4.1):** Hybrid Hub · content layered on commerce · `brand_anonymous` voice with named-not-Phill expert bylines · CCW = Synthex client, NOT nested Unite-Group brand.
- **Audience JTBD (Q3.4.2):** Restoration Specialist primary · Standard Operator secondary · Bridge converter for natural evolution.
- **Discovery + Distribution (Q3.4.3):** Google/AI Search Authority Lead P0 · YouTube companion P0-paired · Email P1 nurture (post-verification).
- **Conversion architecture (Q3.4.4):** T4 wired Days 0–30 · T9 staged P2 → P1 Days 61–90 · checkout UX optimisation throughout.
- **Measurement + privacy (Q3.4.5):** Hub Article-to-Cart-Add canary · Capital-Tier Checkouts outcome · T4 Volume + AEO watch · CCW client Privacy "Synthex Clause" (processor/controller framing).

**Tracked work item:** Gap 8 — CCW client engagement audit (ESP · trigger wiring · cross-promotion permission · Privacy Policy · trade-expert byline framework).

---

# ✅ Discovery Phase: COMPLETE (33/33 questions across 5 phases)

```
Phase 1     — CEO Operator Foundation       (5/5)   ✅
Phase 2     — Business Portfolio + crawl    (—)     ✅
Phase 2.5   — Portfolio cross-sell map      (5/5)   ✅
Phase 3.1   — RestoreAssist                 (5/5)   ✅
Phase 3.2   — DR + NRPG (two surfaces)      (5/5)   ✅
Phase 3.3   — CARSI                         (5/5)   ✅
Phase 3.4   — CCW (Synthex client)          (5/5)   ✅
                                           ━━━━━━━
                                           33/33    ✅
```

**Architectural decisions locked:**

- **Unite-Group Nexus** = 4 nested brands (DR + NRPG + RestoreAssist + CARSI) under a single operator (Unite-Group Nexus Pty Ltd · ABN 62 580 077 456)
- **CCW** = adjacent Synthex client engagement, structurally separate
- **Phill McGurk** = founder voice across NRPG · CARSI · RestoreAssist (per `hybrid_phill_strategic_brand_routine` voice tag) · NEVER appears on DR consumer pages or CCW
- **Primary flywheel** = DR/NRPG-led claim throughput · **secondary flywheel** = RestoreAssist · **feeders** = CARSI (mandatory authority) + CCW (Synthex client)
- **Three Monday-morning canaries** = D3 events (DR) · Snapshot Completion Rate (CARSI) · Hub Article-to-Cart-Add Rate (CCW) · all conversion-mechanism health metrics, never outcome metrics
- **Two parallel flywheels reportable separately** = D-funnel (DR) and N-funnel (NRPG) never aggregated · source-of-truth job ID prevents D4/N4 double-counting
- **Hyper-Care daily snapshot** ready to deploy for first 30 days of DR pilot

---

## Phase 4 — Post-Discovery Execution

> The foundation file is now the canonical operating context every senior Synthex skill reads at invocation. Brand-voice-enforce skill mechanically rejects any output that violates locked rules · taboos · verb lists · verification gates · cross-client boundaries.

### Senior-skill briefing layer (now active)

Every senior skill (Analytics Lead · CRO Specialist · Email Specialist · Brand Strategist · Creative Director · Senior Strategist · Senior Copywriter) reads at invocation:

1. **Phase 1** — Operator profile (6–10 hr/wk · 80/20 risk · per-brand voice · hybrid decision style · human-in-loop on output)
2. **Phase 2.5** — Portfolio cross-sell map (8 active triggers · channel reality · 9-layer infrastructure · voice tags · scoreboard · 40/40/20 attribution)
3. **The brand profile relevant to the task** (3.1 RA · 3.2 DR+NRPG · 3.3 CARSI · 3.4 CCW)

Skills MUST declare in their SKILL.md frontmatter: `operates_in: [L1, L2, ...]` and `consumes_from: [L4, L9, ...]` per the layer-ownership rule.

### Immediate execution sprint (post-discovery)

| Workstream                                                                                           | Owner                                                                          | Status                                        |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------- |
| **Foundation file consolidation**                                                                    | Synthex foundation-keeper skill                                                | ✅ Backfilled 2026-04-26                      |
| **Senior-skill briefing rollout**                                                                    | Senior Strategist skill                                                        | NEXT                                          |
| **Gap 3 — RestoreAssist asset + attribution audit**                                                  | Performance + Attribution Lead skill                                           | P0                                            |
| **Gap 4 — DR + NRPG asset + coverage + permission audit**                                            | Performance + Attribution Lead skill (incl. IICRC verification for NRPG/CARSI) | P0                                            |
| **Gap 5 — Per-eligible-profile GBP plan** (gates on Gap 4)                                           | Local SEO skill                                                                | P0 (post-Gap-4)                               |
| **Gap 6 — Insurer co-marketing pilot framework**                                                     | Senior Strategist skill                                                        | P1                                            |
| **Gap 7 — Property Manager + Strata acquisition surfaces**                                           | Senior Copywriter + CRO Specialist                                             | P1                                            |
| **Gap 8 — CCW client engagement audit** (ESP · cross-promotion permission · trade-expert byline)     | CRO Specialist skill                                                           | P0                                            |
| **Mailchimp setup** (DR + NRPG + CARSI + RestoreAssist · identity resolution layer · DKIM/SPF/DMARC) | Email Specialist skill                                                         | P0                                            |
| **DR Hyper-Care daily snapshot wiring**                                                              | Analytics Lead skill                                                           | P0 (gates on Gap 4 for DR-side verifications) |
| **CARSI IICRC verification work**                                                                    | CEO executive time (1–2 hr/wk × 4–6 weeks)                                     | P0                                            |
| **Phill LinkedIn cadence activation** (2 posts/week shared across NRPG · CARSI · RestoreAssist)      | Senior Copywriter + Brand Strategist + brand-voice-enforce                     | P0                                            |

### Operating rhythm (Phase 1.5 batched-review pattern continues)

- **Daily (DR pilot first 30 days):** Hyper-Care snapshot · 5-minute CEO review window · same-day incident path for privacy/data/SLA
- **Weekly (Monday morning):** DR Tier 1 + NRPG Tier 1 + CARSI Tier 1 + CCW Tier 1 + portfolio claim-throughput headline + same Monday batch
- **Monthly (1st of month):** Tier 2 across all brands · cross-sell attribution · trigger threshold breach review
- **Quarterly:** Tier 3 ecosystem + AI-search visibility audits + portfolio scoreboard + voice-tag drift check + verification-gate refresh
- **Continuous:** founder content drafts (20–40 pieces/week) in batched-review queue
- **Same-day (override):** privacy / data / claim / SLA incidents · NDB process initiation · partner-permission escalations

### Phase 4 hard rules (closing the discovery, opening the build)

1. **The foundation file is canonical.** Skills do not invent · do not soften · do not paraphrase locked rules. Drift surfaces in the brand-voice-enforce check or the verification audit.
2. **Verification gates are non-negotiable.** No public claim ships without `[verified-DD/MM/YYYY]` tagging on quantitative · scope · coverage · partnership · review-provenance · IICRC · insurer-panel · payment-SLA claims.
3. **Cross-client boundaries are explicit.** CCW data flows under processor/controller framing · CCW client agreement gates every cross-promotion · Unite-Group Nexus pooling stops at the CCW boundary.
4. **Founder bandwidth is the scarcest resource.** Phase 1.1's 6–10 hr/wk constraint governs every "should we do X?" decision. Skills propose plans within capacity · aspirational items require explicit CEO override.
5. **Hallucinations stop at the foundation.** Every brand name · trigger ID · audience definition · voice tag · taboo · privacy rule · economics terminology is locked. Skills citing portfolio architecture quote the foundation, never reconstruct from memory.

---

## Phase 4 Amendment — 2026-04-27 — Enterprise AI Agent Platform research posture

**Source:** `research-lead` skill (14th skill · v0.1) · CEO-surfaced research request 2026-04-27 · Google's Gemini Enterprise Agent Platform announcement (2026-04-23) + competitive map of 6 alternatives.

**Locked posture (foundation-keeper authority):**

Any adoption work involving an external agent-platform runtime (Gemini Enterprise · AWS Bedrock + AgentCore · Anthropic Skills via Bedrock · LangGraph · or other) is tagged **`experimental` per Phase 1.2 80/20 risk posture · 20% budget · explicit kill threshold required**.

**Three-track verification before any commitment:**

- **Track A — Google Gemini Enterprise Agent Platform** — gates on VG-150 (AU residency) + VG-151 (pricing) + VG-152 (Memory Bank cross-client isolation) + VG-154 (AU deliverability) + VG-155 (Aid Rule preservation)
- **Track B — AWS Bedrock + AgentCore** — gates on VG-156 (Sydney availability + pricing)
- **Track C — Anthropic Skills via Bedrock Sydney** — gates on VG-157 (Skills file-system boundary enforcement for CCW isolation) + VG-158 (Bedrock Sydney Claude pricing)

**Track C carries the strongest fit-to-existing-assets evidence:** the 14 SKILL.md files in `.claude/skills/` are already in Anthropic's native Skills format · skill-compilation overhead is minimal vs Track A (ADK rewrite) or Track B (AgentCore composable primitives) · deterministic `brand-voice-enforce` skill sits naturally alongside Skills' mechanical loading.

**Eliminated:** Microsoft Copilot Studio (M365-locked · seat-pricing scales poorly) · CrewAI (no AU SaaS · no governance) · LangGraph + LangSmith (LangSmith no AU SaaS · self-host requires Enterprise contract).

**Hard rules added by this amendment:**

1. **No platform-adoption commitment before Phase 1 verification clears.** All 9 verification gates (VG-150 through VG-158) carry `[verification needed]` until CEO source documentation reaches the registry.
2. **Three tracks proceed in parallel** — verification work is concurrent · ~30 min CEO time per track for sales-engineering conversations.
3. **Aid Rule preservation (VG-155) is binding for RestoreAssist.** Adoption REJECTED if any platform path can't preserve mechanically: _"AI does not replace the technician. The technician inspects · decides · signs off. RestoreAssist assists by recording and documenting."_
4. **Cross-client boundary (Phase 3.4) is binding for any Memory Bank / persistent-memory adoption.** Separate instances for Nexus (DR + NRPG + RA + CARSI) vs CCW · enforced at infrastructure level not just application layer.
5. **Deterministic content gate stays.** `brand-voice-enforce` mechanical rule-matching against the foundation is NOT replaced by stochastic LLM-as-a-judge (Google's Anomaly Detection · etc.). Layer them at different levels (network-layer prompt-injection defence + content-layer rule-matching).
6. **Pilot adoption (Phase 2 of phased plan) requires explicit `[CEO approved]` tag scoped to one specific skill** (recommend: senior-strategist as the orchestrator) · success criteria + kill threshold up-front per Phase 1.2.

**Foundation references for Phase 4 research-lead-led work:**

- `.claude/skills/research-lead/SKILL.md` (skill spec)
- `.claude/scratchpad/research-gemini-enterprise-agent-platform.md` (Track A analysis)
- `.claude/scratchpad/research-competitive-agent-platforms.md` (Track A/B/C/eliminations)
- `.claude/memory/verification-gates.md` Section 9 (VG-150 through VG-158)

This amendment is logged · binding · foundation-keeper auditable.

---

## Phase 4 — Voice Amendments + Manifesto Opener _(LOCKED 2026-04-27)_

> Founder-fronted LinkedIn campaign opens with the Restoration Manifesto. The 6 voice amendments below extend the existing voice-tag system (Q2.5.5) and bind the brand-voice-enforce skill before any draft ships.

### The 6 Voice Amendments (binding · brand-voice-enforce mechanically checks)

| #   | Frame                                                      | Approved register                                                                                                                                             | Hard guardrail                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Vanguard voice extension**                               | Founder-fronted register across NRPG + CARSI + RA portfolio-tagged content. Adds emotional + identity layer to existing Sage/Pioneer/Caregiver archetype mix. | Does NOT replace the discipline of those archetypes. Vanguard tone permitted only on hybrid-voice-tag surfaces; never on DR consumer pages or CCW.                                                                                 |
| 2   | **TPA creep** as phenomenon descriptor                     | Approved as industry-condition naming                                                                                                                         | **Specific TPA companies / brands / individuals must NOT be named or attacked.** Phenomenon = OK · personal-attack = forbidden (Q3.2.1 NRPG taboo 6 extends).                                                                      |
| 3   | **Professional sovereignty through scientific compliance** | Portfolio thesis line · approved                                                                                                                              | The sovereignty is _toward standards_, not _against insurers_. DR + NRPG depend on insurer goodwill — anti-insurer drift breaks the primary flywheel.                                                                              |
| 4   | **Reframed Independence**                                  | _"Independent operators who answer to the science the insurance industry already trusts."_                                                                    | Original _"not the insurer's portal"_ phrasing is **forbidden** — risks anti-insurer drift. Approved version above is the locked phrasing for any operator-independence framing.                                                   |
| 5   | **Documentation Shield / TPA-proof** (RestoreAssist)       | _"Evidence-based documentation that stands up to TPA-grade review by aligning with IICRC S500/S520 + NCC 2022 standards."_                                    | Aid Rule (Q3.1.1) still binds. RA does NOT _guarantee_ claim acceptance · does NOT _prevent_ TPA rejection · does NOT _guarantee_ documentation passes scrutiny. The shield is the **evidence trail**, never an outcome guarantee. |
| 6   | **Restoration as scientific discipline**                   | _"Restoration is a science discipline · not a sub-trade of construction."_                                                                                    | **Anti-builder rhetoric is forbidden** in public copy. The discipline-claim is approved; the builder-attack is not. Internal directional language only · public copy stays at the discipline-claim register.                       |

**CARSI = "Academy of Standards"** — locked positioning extension, strengthens Q3.3.1 Mandatory Authority Model. No conflict with locked rules.

### LinkedIn first-batch architecture (binding)

**Why-led structure · How as supporting evidence in every post · 60/40 register mix.**

Every post follows three-part architecture:

```
1. HOOK    (Why · 1–3 lines · Vanguard register)
            Sovereignty / industry-movement / operator-identity register

2. SUBSTANCE (How · ~70% of body · Standards register)
              IICRC S500/S520/FSRT or NCC 2022 specific section
              Verifiable claim · [placeholder] or [verified-DD/MM/YYYY] tagged
              Operator-grade reasoning · NOT marketing fluff

3. CLOSE   (Action · 1–2 lines · Vanguard register)
            CTA per Manifesto Opener structure (post 01) or per-post CTA
            in Sovereignty/Shield series
```

**Mix:** 60% Why-led posts · 40% How-led posts. Both registers obey the same brand-voice-enforce gate. Both carry verification tagging on every quantitative claim.

### First-batch queue (8 posts · 4 weeks · 2 posts/week shared portfolio LinkedIn budget)

| Post                                         | Primary brand                                         | Register          | Objective                                                    |
| -------------------------------------------- | ----------------------------------------------------- | ----------------- | ------------------------------------------------------------ |
| **01: Manifesto Opener**                     | Portfolio-thesis (NRPG-primary · CARSI-secondary tag) | Sovereignty Lead  | Establish the movement · drive Snapshot starts               |
| **02–05: Sovereignty Series** (4 posts)      | NRPG-primary                                          | Independence Lead | Build the Vanguard identity · attract high-conviction owners |
| **06–08: Technical Shield Series** (3 posts) | CARSI / RestoreAssist-primary                         | Standards Lead    | Provide technical proof · establish Academy of Standards     |

### Manifesto Opener — locked structure (CTA architecture)

> **Decision:** Primary CARSI Snapshot CTA + secondary NRPG layered in as next step (CEO-approved Option E).

**Operational safety binding:**

- **Days 0–14:** CARSI primary CTA lands on **static PDF Compliance Checklist** (NOT the Snapshot tool — under build per Q3.3.4 phased plan). Copy must say _"download the Compliance Checklist"_ — brand-voice-enforce checks the post's CTA copy matches the live-asset state.
- **Days 15+:** CTA flips to interactive Snapshot tool once shipped.

**NRPG secondary CTA wording rules (binding):**

- No false scarcity (_"only X spots left"_) — Q3.2.1 NRPG taboo 13
- No guaranteed-work framing — Q3.2.2 hard rule 10
- No implied IICRC partnership before `[verified]` — Q3.2.3 Amendment 9
- Approved phrasing: _"NRPG is open for IICRC-certified operators who hold the standard the industry runs on."_

**Pre-IICRC-verification language rules:**

- Approved: _"the science the insurance industry already trusts"_
- Forbidden until `[verified]`: _"IICRC-approved"_ · _"in partnership with IICRC"_ · _"endorsed by IICRC"_
- Phill's voice may articulate the standards thesis without claiming endorsement · brand-voice-enforce keeps drafts safe.

### Manifesto canary metrics (binding)

Performance & Attribution Lead skill monitors as primary movement signal:

- **High Save rate** on a How-led post = becoming the technical reference (Academy of Standards positioning landing)
- **High Share rate** on a Why-led post = movement gaining momentum (Sovereignty register landing)
- Specific thresholds remain `[placeholder]` until first-post baseline establishes
- Tier 2 monthly review captures conversion rates: post → Snapshot start → Snapshot completion → NRPG application

### Locked Manifesto Opener draft _(post 01 · for next batched review)_

```
The restoration industry has been treated as a sub-trade of construction
for too long. That ends now.

IICRC S500. S520. FSRT. NCC 2022. These standards exist for a reason —
they're the science the insurance industry already trusts.

Every restoration claim that meets these standards stands on its
evidence. Not on the goodwill of a TPA. Not on the relationship with
a builder. On the science.

The question for any Australian restoration firm in 2026 isn't whether
you're good enough. It's whether your team's certifications are current
with the standard the industry depends on.

▸ Download the Team Compliance Checklist — see where your team sits
   relative to the standard.
   [link to /for-firms]

▸ Already past the gate? NRPG is open for IICRC-certified operators
   who hold the standard the industry runs on.
   [link to /contractor]

Restoration is a science discipline. It's time we owned it as one.

— Phill McGurk
   Unite-Group Nexus

#Restoration #IICRC #AustralianBusinesses
[brand-tags · NRPG-primary · CARSI-secondary]
```

**Brand-voice-enforce gate: PASS** _(initial draft · pending full review)_

- ✓ No first-person business _"we / our"_ in body copy (footer attribution permitted)
- ✓ No banned global filler (leverage / disrupt / seamless / etc.)
- ✓ No specific TPA companies named
- ✓ No anti-insurer rhetoric · uses _"the science the insurance industry already trusts"_
- ✓ No anti-builder rhetoric · uses _"sub-trade of construction"_ discipline-claim register
- ✓ Pre-IICRC-verification language compliant (no "IICRC-approved" claim)
- ✓ NRPG secondary CTA uses approved phrasing (_"the standard the industry runs on"_)
- ✓ CARSI primary CTA uses Days 0–14 asset (_"Compliance Checklist"_ not _"Snapshot"_)
- ✓ No guaranteed-outcome framing on either CTA
- ✓ Aid Rule respected — no claim that any tool _"verifies"_ or _"approves"_ anything

This draft is the proof-of-rails. Subsequent posts in the 8-post batch follow the same gate before review-queue landing.

### What this lock unlocks downstream

- **brand-voice-enforce skill** — has its first canonical taboo + verification + voice-tag library to mechanically check (the 6 amendments + the existing locked rules from Phase 1–3.4)
- **Senior Copywriter skill** — has its first concrete voice register (Why-led + How-substance + 60/40 mix) to produce drafts against
- **Performance & Attribution Lead skill** — has its first canary definitions (Save + Share rates per register) to instrument
- **Manifesto Opener** ships into the next batched-review queue · 7 follow-on drafts queue immediately behind

---

## Discovery log

`<each answer + timestamp + boardroom rationale appended below as we go>`
