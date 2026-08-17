# Workflow — the 7-agent run

> Each agent produces a named artifact and hands off to the next. The run is a **debate** (each agent
> challenges the prior one's weak assumptions) followed by synthesis. No step may invent data.

## 0. Inputs

Validate against `inputs.schema.json`. Key flags: `scope_projects`, `youtube_channels`,
`data_sources_enabled.{gsc,semrush,google_analytics,internal_crawl,youtube_data_api}`, `approval_mode`.
If a data source is disabled, every score that depends on it is `DATA_REQUIRED` — that is expected and honest.

## 1. Obsidian Source Cartographer

- Scan the vault (`find` + **word-boundary** grep, exclude `.obsidian/`). Verify suspicious counts
  (a 100+ "E-E-A-T" hit is almost always research-log artifact — open the file and check).
- Emit `obsidian-source-map.md` + `obsidian-source-index.json` (validate against `source-map.schema.json`).
- Identify YouTube channels. **If none exist, say so and stop the YouTube branch at `DATA_REQUIRED`** —
  do not invent channels.

## 2. YouTube Intelligence Analyst

- Only runs if `youtube_channels` is non-empty **and** `youtube_data_api` is enabled.
- YouTube ingestion call sequence: `channels.list` → `playlistItems.list` (uploads playlist) →
  `videos.list` (titles/dates) → transcript fetch. Land raw output in
  `2nd-brain/Outcomes/research-ingest/*-youtube-<channel>.md`.
- Extract claims into `youtube-claims-dataset.json` using the bucketing rubric in
  `youtube-analysis-neil-patel-50.md`. Every claim starts `UNVERIFIED_CLAIM` / `OPINION_SOURCE`.

## 3. Evidence & Verification Lead

- For every significant claim, gather ≥4 references (Google docs, Quality Rater Guidelines, the 2024
  leak analyses, Schema.org, CrUX docs, **first-party GSC**). First-party data is the tie-breaker.
- Assign confidence (`CONFIRMED/LEAKED/INFERRED/SPECULATIVE/UNVERIFIED`). Flag outdated/harmful tactics
  into `risk-register-seo-aeo-geo.md`.
- Emit `verified-ranking-claims.md` + `claim-verification-ledger.json` (validate against `claim-verification.schema.json`).

## 4. Search Mathematics & Scoring Architect

- The formulas are already implemented in `scoring-models.ts`. This agent's job is **calibration**:
  set/justify `Weights`, define which inputs are available this run, and document any weight change as a
  logged decision.
- Run scores per page. Each returns a `ScoreResult` with `dataStatus` + `confidenceFactor`.

## 5. Website Implementation Strategist

- Build/refresh the page inventory (needs crawl + GSC → mostly `DATA_REQUIRED` until wired).
- Map each page → keyword/intent/funnel/project/priority.
- Convert top-priority, non-blocked scores into tickets (`implementation-ticket-backlog.json`) with:
  action · claim_refs · validation_method · rollback_note. High-risk/placeholder items are flagged blocked.

## 6. Specialised Skill Builder

- Maintain this skill directory (schemas valid, TS type-checks, gates documented). On each run, append
  learnings; never silently change weights or gates (that is a logged decision per the self-improvement charter).

## 7. Continuous Research & Refresh Orchestrator

- Wire cadences (`automation-schedule.md`), update triggers, and the human-approval gates.
- Add a `marketing-intelligence` `client_loops.loop_kind` under the Nexus pitch-03 architecture so each
  client workspace gets its own scoped loop.

## Output

Assemble the run report (`outputs.schema.json`) + the CEO synthesis. Run the 6 quality gates
(`quality-gates.md`). A gate failure blocks the "done" claim.
