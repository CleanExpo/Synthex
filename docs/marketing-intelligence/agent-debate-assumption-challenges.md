# Agent Debate — Assumption Challenges

> Status: ✅ `VERIFIED` — an honest record of the 7-agent debate. The headline outcome is that the
> master prompt's central premise (YouTube channels + Neil Patel in the vault) did not survive contact
> with the actual data, and the system was re-shaped around that truth rather than fabricating to fit.

## Round 1 — Discovery (what each agent reported)

- **Cartographer:** Vault is real (224 notes) but is a Shape Up *shaping* vault, not an SEO vault.
  0 YouTube channels, 0 Neil Patel refs, 0 GSC/Semrush exports. Closest real assets: a live in-app GSC
  integration + an existing local-SEO skill family + the Nexus `client_loops` architecture.
- **YouTube Analyst:** No channels to analyse. Refuses to invent. Branch parked at `DATA_REQUIRED`.
- **Verification Lead:** Plenty to verify *without* YouTube — grounded claims in the internal
  `algorithm-knowledge-base` (already sourced + dated) and Google documentation. 8 claims rated.
- **Math Architect:** All 12 formulas implementable now; their *inputs* are mostly `DATA_REQUIRED`.
  Solution: every score self-reports `dataStatus` + `confidenceFactor` so a guess can't masquerade as data.
- **Strategist:** Page inventory is `DATA_REQUIRED`, but the INFRA tickets that unblock it (crawl, GSC
  pipeline) are real and high-priority — those go to the top of the backlog.
- **Skill Builder:** Build a real orchestrator skill, not a duplicate of the 6 existing local-SEO skills.
- **Orchestrator:** Reuse the existing crons + approval queue; add one `marketing-intelligence` loop_kind.

## Round 2 — Challenged assumptions (≥3 per agent; the load-bearing ones)

1. **"The vault has the YouTube channels."** ❌ False. → System marks `DATA_REQUIRED`, gives two
   concrete ways to supply them. *No invention.*
2. **"Neil Patel's tactics apply to our sites."** ⚠️ Unproven. NP's audience is US B2B/e-commerce; the
   portfolio is **AU service-area businesses** (restoration, cleaning, training). → All influencer
   advice enters as `OPINION_SOURCE` (0.1) and must be AU/service-area re-tested before use.
3. **"Generic SEO advice suits service-area businesses."** ⚠️ Partly. Service-area businesses have no
   storefront → local-pack mechanics differ; thin-suburb-page risk (R-SEO-01) is acute. → Delegate to
   `local-seo-agent`, enforce unique local content.
4. **"GEO/AEO tactics are proven."** ❌ Mostly `SPECULATIVE`. AI Overviews is undocumented. → Every GEO
   action is `HYPOTHESIS_FOR_TESTING` with a kill threshold, never a `CONFIRMED` directive.
5. **"We can score pages now."** ⚠️ Only relatively, and only with confidence flags. → `confidenceFactor`
   collapses to ≤0.1 on placeholder inputs; backlog blocks them from auto-execution (R-DATA-01).
6. **"We're optimising for rankings."** ⚠️ Incomplete. → `commercial_value` + `conversion_proximity`
   are in the impact blend so the system favours pages that *earn*, not just rank.
7. **"AI can publish content at scale."** ❌ Dangerous (scaled-content-abuse policy, R-SEO-05). → All
   AI content is human-gated before publish.
8. **"More infrastructure = better."** ❌ The portfolio already has 6 SEO skills + 5 crons. → Orchestrate,
   don't rebuild. The new skill adds exactly one layer: cross-portfolio confidence-adjusted prioritisation.

## Round 3 — Where the agents disagreed (and the resolution)

- **Strategist vs Verification Lead:** Strategist wanted to ship title/meta rewrites immediately;
  Verification Lead blocked it — no per-page CTR data yet. **Resolved:** INFRA-2 (GSC pipeline) is the
  unblocker and sits at the top of the backlog; PAGE tickets stay `DATA_REQUIRED` until it lands.
- **Skill Builder vs Orchestrator:** whether to put the skill in `.claude/skills/` (repo convention) or
  `src/skills/` (master prompt). **Resolved:** honoured the master prompt's `src/skills/` because it is a
  code+schema skill (`.ts` + JSON Schema); noted the convention difference in the run report so a human
  can relocate it if they prefer the markdown-skill convention.

## The meta-outcome

The debate's real value was refusing to fabricate. A weaker run would have produced a confident-looking
"analysis of Neil Patel's 50 videos" full of invented claims. This run says, precisely and verifiably,
*what exists, what doesn't, and exactly how to get the rest* — which is the only honest basis for a system
that will later touch live client rankings.
