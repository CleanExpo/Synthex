# Unite Group Engineering System — canonical engineering reference

**Version:** 0.1.0 (draft) | **Researched:** 27/10/2026 AEST | **Authority:** proposal for Pi Dev Ops and founder review, not a production policy change.
**Owner:** Unite Group. **Maintainer:** Pi Dev Ops. **Implementation home:** CleanExpo/Synthex. **First product application:** Living Business OS, Linear [SYN-1316](https://linear.app/unite-group/issue/SYN-1316).

## Purpose

A small, reusable, repo-versioned engineering framework for every Unite Group project. Synthex is the **internal** builder/marketing engine. Unite Group owns the customer-facing funnel; Mission Control reports real progress; Pi Dev Ops coordinates engineering; Rana is the final engineer/reviewer. Do not confuse this proposed reference with an approved deployment or assignment.

## Read in this order (minimal context)

1. [GOALS.md](GOALS.md): outcome, exclusions, success evidence (short).
2. [SPEC.md](SPEC.md): canonical contracts, boundaries and acceptance criteria.
3. [OPERATING-PROTOCOL.md](OPERATING-PROTOCOL.md): orchestrator, SPM, challenge council, review gates.
4. [SKILLS.md](SKILLS.md): on-demand skills; load only the relevant one.
5. [MODEL-ROUTING.md](MODEL-ROUTING.md): capability tiers and provider availability checks.
6. [RESEARCH-REGISTER.md](RESEARCH-REGISTER.md): externally verified sources and review cadence.
7. [CONSUMPTION.md](CONSUMPTION.md): how Pi Dev Ops and other repositories reference a pinned revision.
8. [DOCS-AUDIT.md](DOCS-AUDIT.md): Markdown inventory and safe freshness policy.

### Precedence

Existing repository constitution, owner decisions, scoped security rules and applicable approvals **override this draft**. In Synthex specifically: `docs/governance/CONSTITUTION.md`, `CLAUDE.md`, `DECISIONS.md`, `.claude/rules/`, `scripts/fleet/policy.json`. Never auto-edit immutable governance to make a new framework appear approved.

### Anti-bloat

One short entrypoint. One spec per product. Reference existing JEV, workflows, ledgers and models instead of duplicating them. No auto-loading entire repo or chat transcript. Each task supplies a small context manifest with exact files and line-level citations. Reuse > create; delete duplication only after verified usage scan + migration + review.

### Validate

`node engineering-system/scripts/audit-markdown.mjs --out engineering-system/markdown-audit.json` creates an **inventory** with potential stale references; it does not rewrite source documents. The generated JSON is an ephemeral diagnostic, not a claim every document was updated. To refresh the report, rerun the script at a real source revision.

**Status:** source research verified; local worktree only until reviewed, committed, pushed and consumed under existing governance.
