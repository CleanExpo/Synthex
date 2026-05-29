# Agentic Marketing Intelligence 2026 — Deliverables Index

> System: research → verify → score → plan → improve loop for SEO / AEO / GEO across the
> Unite-Group portfolio. Built per the CLI master prompt, **with no fabricated data**.

## Status legend (used in every file)

| Tag | Meaning |
|-----|---------|
| ✅ `VERIFIED` | Built from real, inspectable data in this repo / vault / internal KB |
| 🟡 `DATA_REQUIRED` | Genuine deliverable, but the source data is **not present** — scaffold + how-to-populate only |
| 🔵 `HYPOTHESIS_FOR_TESTING` | Plausible tactic, not proven — must be A/B tested before rollout |
| ⚠️ `UNVERIFIED_CLAIM` | Stated somewhere but not cross-checked against 4 sources |
| 💬 `OPINION_SOURCE` | Opinion / influencer content, not first-party or documentation |

## Honest summary of source discovery (2026-05-29)

The master prompt assumed the Obsidian vault contains "two referenced YouTube channels"
and "Neil Patel source references". A full scan of `/Users/phillmcgurk/2nd-brain/`
(224 notes) and the wider machine found:

- ✅ The Obsidian vault is real and was fully indexed — see [obsidian-source-map.md](obsidian-source-map.md).
- 🟡 **Zero YouTube channel references** exist in the vault.
- 🟡 **Zero Neil Patel references** exist anywhere on the machine.
- 🟡 **No** GSC / Semrush / Google Analytics **static exports** exist — but a **live in-app GSC
  integration** does (`lib/google/search-console.ts`, `/dashboard/seo/search-console`, 3 GSC crons).
- ✅ A mature SEO/AEO/GEO **skill ecosystem already exists** in `.claude/skills/` and is the
  correct substrate to build on (not duplicate).

Therefore the YouTube/Neil-Patel deliverables are honest `DATA_REQUIRED` scaffolds with exact
instructions to supply the data. Everything that *could* be built from real data **was**.

## File map

| File | Status | What it is |
|------|--------|-----------|
| [obsidian-source-map.md](obsidian-source-map.md) | ✅ | Factual map of the vault |
| [obsidian-source-index.json](obsidian-source-index.json) | ✅ | Machine-readable vault index |
| [youtube-channel-source-list.md](youtube-channel-source-list.md) | 🟡 | Channel list + how to supply |
| [youtube-analysis-neil-patel-50.md](youtube-analysis-neil-patel-50.md) | 🟡 | NP analysis scaffold + extraction template |
| [youtube-analysis-channel-1.md](youtube-analysis-channel-1.md) | 🟡 | Channel-1 scaffold |
| [youtube-analysis-channel-2.md](youtube-analysis-channel-2.md) | 🟡 | Channel-2 scaffold |
| [youtube-claims-dataset.json](youtube-claims-dataset.json) | 🟡 | Empty schema-valid claims dataset |
| [verified-ranking-claims.md](verified-ranking-claims.md) | ✅ | Confidence-rated claims (grounded in internal KB + Google docs) |
| [claim-verification-ledger.json](claim-verification-ledger.json) | ✅ | Machine-readable claim ledger |
| [risk-register-seo-aeo-geo.md](risk-register-seo-aeo-geo.md) | ✅ | Tactics that could harm rankings |
| [search-math-models.md](search-math-models.md) | ✅ | The 12 scoring formulas, fully specified |
| [site-page-inventory.md](site-page-inventory.md) | 🟡 | Portfolio list (real) + page inventory method |
| [content-refresh-roadmap.md](content-refresh-roadmap.md) | 🟡 | Refresh method + data gates |
| [implementation-ticket-backlog.json](implementation-ticket-backlog.json) | ✅/🟡 | Real infra tickets + page-tickets pending data |
| [continuous-research-loop.md](continuous-research-loop.md) | ✅ | The living daily/weekly/monthly loop |
| [automation-schedule.md](automation-schedule.md) | ✅ | Cadences, grounded in existing crons |
| [human-approval-gates.md](human-approval-gates.md) | ✅ | What may never publish without a human |
| [agent-debate-assumption-challenges.md](agent-debate-assumption-challenges.md) | ✅ | The 7-agent debate + challenged assumptions |
| [ceo-synthesis-agentic-marketing-2026.md](ceo-synthesis-agentic-marketing-2026.md) | ✅ | CEO-level synthesis + next phase |

## The reusable skill

`src/skills/agentic-marketing-intelligence/` — schemas, TypeScript scoring models, agent
prompts, workflow, and quality gates. This is the durable asset; the docs above are its first run.
