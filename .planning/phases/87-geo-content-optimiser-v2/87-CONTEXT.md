# Phase 87: GEO Content Optimiser v2 - Context

**Gathered:** 2026-03-11
**Status:** Ready for research

<vision>
## How This Should Work

The GEO Content Optimiser v2 is a real-time scoring and rewriting tool that applies the Princeton KDD 2024 9-tactic GEO framework directly to content as users write or paste it. Think of it like a live Hemingway Editor, but instead of readability it measures AI citation fitness.

When a user pastes or types content into the editor, they see a live score breakdown across the 9 Princeton tactics — updated as they type. Each tactic has its own score (0–100) with a colour indicator (red/amber/green). The overall GEO score is a weighted composite. Most importantly, alongside the score there's an "AI Rewrite" button per tactic that rewrites just that section to maximise that specific signal — not the whole document, just the underperforming section.

The workflow is: paste content → see the 9 scores → identify weakest tactic → click rewrite → AI improves it → scores update live. Iterative, surgical, fast.

This builds on Phase 85 (entity coherence) and Phase 86 (authority/citations) — those signals feed into this scoring. The GEO score already exists in the dashboard; Phase 87 makes it actionable and editable.

</vision>

<essential>
## What Must Be Nailed

- **Real-time scoring against Princeton 9 tactics** — every edit triggers a rescore with per-tactic breakdown, not just a single GEO number
- **Surgical AI rewriting** — rewrite one tactic's section at a time, not the whole document; preserves the user's voice while improving specific signals
- **Visibility into WHY scores are low** — each tactic should explain what's missing ("Add at least 2 statistical claims" / "Include a direct quote from an authoritative source"), not just show a number
- **Integration with existing GEO pipeline** — this replaces/upgrades the current GEO analyze flow, not a separate tool

</essential>

<boundaries>
## What's Out of Scope

- Full document AI rewriting (that's brand voice / Phase 88) — Phase 87 rewrites tactically, not holistically
- New Prisma models for storing every edit (save final scored content only)
- SEO keyword optimisation — this is GEO/AI-citation specific, not traditional SEO
- Publishing directly from this editor — it's a scoring/improvement tool, not a publisher
- Voice fingerprinting / humanness scoring — that's Phase 88 and 89
- Competitor analysis against specific queries — that's Phase 96 (Prompt Intelligence)

</boundaries>

<specifics>
## Specific Ideas

- The 9 Princeton tactics from the KDD 2024 GEO study are: Authoritative Citations, Quotation Inclusion, Fluency Optimization, Uniqueness, Optimization (SEO), Add Statistics, Add Information, Persuasion, Easy-to-Understand
- Scores should be colour-coded: green (≥70), amber (40–69), red (<40)
- Each tactic card should show: score, status icon, 1-line explanation of what's needed, "Improve" button
- The live editor should highlight text spans that relate to each tactic (hover tactic → highlights relevant content in editor)
- Builds on existing `/dashboard/geo/` page — add a new "Optimiser" tab or sub-page, don't replace the existing GEO analysis view
- Use the existing GEO score displayed in the dashboard; Phase 87 makes the breakdown visible and editable

</specifics>

<notes>
## Additional Context

Research basis: Princeton KDD 2024 GEO study — the 9 tactics were empirically proven to increase AI-generated response inclusion rates by 29–40% across ChatGPT, Bing, Perplexity.

The existing `lib/geo/` infrastructure (geo-analyzer.ts, authority-scorer.ts, entity-analyzer.ts) provides the scoring foundation. Phase 87 extends it with tactic-level scoring and the AI rewrite pipeline.

The `lib/ai/content-generator.ts` pattern (OpenRouter provider abstraction, BYOK) handles the AI rewrite calls.

Priority order for the 3 plans:
1. Tactic scorer service — the scoring engine (lib/geo/tactic-scorer.ts)
2. AI rewrite pipeline — per-tactic content improvement API
3. Editor UI integration — real-time editor in /dashboard/geo/ or /dashboard/geo/optimiser

This is the most user-facing of all v5.0 phases — it's the tool users will open daily to improve their content before publishing.

</notes>

---

*Phase: 87-geo-content-optimiser-v2*
*Context gathered: 2026-03-11*
