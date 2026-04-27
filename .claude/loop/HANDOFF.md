# HANDOFF — Next Session Baton

> **Read this first. Do not read MEMORY.md, ARCHITECTURE.md, or CLAUDE.md unless a task below explicitly requires it.**
> **Loop protocol:** see [prd.md](../../prd.md). Each session executes one loop: System Prompt → Grill-Me → Implementation → Testing → Feedback.

---

## Current state (2026-04-25)

**Main branch:** clean at `4493c980` (plus PRs landed before this point).

**Three PRs awaiting merge — each is its own loop:**

| PR                                                  | Linear  | Status          | CI                                                  |
| --------------------------------------------------- | ------- | --------------- | --------------------------------------------------- |
| [#86](https://github.com/CleanExpo/Synthex/pull/86) | SYN-794 | Open, mergeable | Build/Lint/Tests/Type-check all green               |
| [#87](https://github.com/CleanExpo/Synthex/pull/87) | SYN-779 | Open, mergeable | Build/Lint/Tests/Type-check all green               |
| [#88](https://github.com/CleanExpo/Synthex/pull/88) | SYN-793 | Open            | Build+Type-check+Lint **in progress at last check** |

The only failing check on each is **Dependency Review** — pre-existing, non-blocking, tracked as Pending Human Action #1 (enable GitHub Dependency Graph).

---

## Next loop — pick one

### Loop A.1 — Merge PR #86 (SYN-794 Lead model)

- Grill-Me priorities: confirm schema choice (single `Lead` table vs splitting), confirm HMAC secret provisioning plan, confirm who applies the migration.
- Acceptance: PR merged, SYN-794 moved to Done with comment including commit SHA.
- Expected session length: 20–30 min.

### Loop A.2 — Merge PR #87 (SYN-779 benchmark page + footer)

- Grill-Me priorities: confirm benchmark claims are truthful at launch (or fallback copy engages), confirm publishers touched don't break Auto-Calendar, decide on feature-flag default.
- Acceptance: PR merged, SYN-779 moved to Done, page visible at production preview.
- Expected session length: 20–30 min.

### Loop A.3 — Merge PR #88 (SYN-793 GA4 property)

- Grill-Me priorities: confirm OAuth env vars present, confirm `googleapis` not pulled as new dep, confirm scopes minimum.
- Acceptance: PR merged, SYN-793 moved to Done.
- Expected session length: 20–30 min.

**Recommended order:** A.1 → A.3 → A.2 (so SYN-795 unblocks fastest).

---

## Grilled (decisions from this session)

_(None yet — empty for first use.)_

---

## After Phase A — first candidate for the next loop

**Loop B.1 — SYN-795 attribution engine.** Needs SYN-793 (PR #88) + SYN-794 (PR #86) merged first. Large scope; heavy Grill-Me required.

---

## Pending human actions

1. **PR merges** — `/loop-start SYN-794` is ready when you are.
2. **SYN-725 migration apply** + pg_cron schedule + `SLACK_CVML_WEBHOOK_URL` secret.
3. **Enable GitHub Dependency Graph** — kills the persistent red CI check.
4. **AU GCP project** for SYN-787 / SYN-788.
5. **YouTube OAuth** for SYN-573 (HeyGen removed from scope per 2026-04-25 CEO directive — SYN-800).

---

## Circuit breakers observed this session

- Worktree isolation is real. SYN-793 agent spilled into a sibling worktree despite `isolation: "worktree"` — future loops must verify worktree path before dispatch, or operate in the main worktree only.
- `git push` hook requires explicit per-session approval. Pre-approve in plan-mode `allowedPrompts` or batch merges via `gh pr merge` from the orchestrating session only.
