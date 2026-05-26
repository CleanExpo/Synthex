# Agent influences — quick reference (SYN-988)

Pinned repos and what Synthex adopts from each.

## Garry Tan — gstack

- **Repo:** https://github.com/garrytan/gstack
- **Method:** Role-switching slash commands (CEO → eng → QA → ship).
- **Synthex:** Only `/qa` (real-browser QA) and `/cso` (OWASP/STRIDE). Everything else covered by Synthex skills (`grill-me`, `design-pressure-test`, `review-board`, `ship-loop-*`).
- **Rule:** Explicit invocation only; no `./setup --team` in repo.

## Andrej Karpathy

- **Repos:** [autoresearch](https://github.com/karpathy/autoresearch), educational ML stacks (not copied).
- **Method:** Think before coding · simplicity · surgical diffs · **goal-driven loops with verification**.
- **Synthex:** `CLAUDE.md` Karpathy-Inspired section; `CONSTITUTION.md` verification gates; ship-loop max-2 retries; `.harness/learning/*.jsonl`.
- **autoresearch pattern:** Edit orchestration docs + fixed metric + revert on regression → maps to ship-loop state, not GPU training.

## Indy Dev Dan (@disler)

- **Repos:** [claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery), [the-library](https://github.com/disler/the-library).
- **Method:** Hooks as control plane; trust harness not model; distribute skills via catalog.
- **Synthex:** `.cursor/hooks/pre-bash-validate.cjs`, `scripts/test-cursor-prebash-hook.ps1`, `.claude/skills/cursor-hooks-windows/`.

## Cursor / Composer 2.5

- **Docs:** https://cursor.com/changelog/composer-2-5
- **Synthex:** `.cursor/rules/agent-stack.mdc`, this references folder.

## Superpowers (Cursor plugin)

- Planning: `writing-plans`, `brainstorming`, `executing-plans`
- Plans live under: `docs/superpowers/plans/`
