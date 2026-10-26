# Markdown freshness audit and safe cleanup

**Inspection:** 27/10/2026, Synthex worktree based on `origin/main` e1008e6c7.

## Verified discovery

- **1,359 Git-tracked Markdown/MDc files** (`git ls-files '*.md' '*.mdc'`); biggest sources include `.planning` (554), `docs` (439), `.claude` (265).
- **705 Markdown/MDc files found under docs/ and .claude/** by filesystem walk; inventory is not equal to tracked count because scopes differ.
- `docs/STRATEGIC_MARKETING_ARCHITECTURE.md` last Git change **13/08/2025**.
- `docs/architecture/README.md` had last been changed **11/07/2026**; the incorrect relative link to `docs/governance/CONSTITUTION.md` was corrected in this worktree on **27/10/2026**. Verify link integrity on the reviewed commit.
- `CLAUDE.md` has a **19/10/2026** update and may be current despite other older content.
- `.cursor/rules/agent-stack.mdc` previously specified **May 2026 Composer 2.5 defaults**; on **27/10/2026** this worktree replaced those defaults with runtime discovery. Historical text may remain as dated reference; never infer the installed model from it.
- `.claude/skills/tdd-jev/SKILL.md` was updated **17/10/2026** and its JEV harness should not be replaced based on file age.

## Actions by tier

1. **ACTIVE / protected:** repo constitution, root CLAUDE, DECISIONS, JEV and CI guards → read and preserve authority; update only through existing governance.
2. **ACTIVE / refresh candidate:** README, current Cursor/Claude/Codex model instructions, onboarding/context/navigation → verify facts and add pointer to canonical engineering-system.
3. **HISTORICAL:** project plans, old dated meeting research and experiments → add archival/index labels if helpful, never relabel old claims as October 2026 findings.
4. **DUPLICATE candidate:** detect backlinks/imports first, propose redirect to canonical source, remove only with measured no-breakage tests.

## Scanner

Run `node engineering-system/scripts/audit-markdown.mjs --out /tmp/synthex-markdown-audit.json`.
The scanner inventories tracked .md/.mdc, screens for dated references and explicitly older model terms; it does **not** auto-edit sources or guarantee every hit is stale. Human engineering review selects high-impact active files.

## Cleanup success

No broken links, no weakened governance, no reduced JEV floor, no silently deleted docs, and no speculative claims that all documents are current because a script ran.
