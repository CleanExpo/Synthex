# Agent Stack Modernisation — Cursor, Codex, Composer 2.5, gstack, Karpathy, Indy Dev Dan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Synthex’s agent toolchain current with May 2026 releases (Composer 2.5, Codex CLI 0.133+), and encode Karpathy + Indy Dev Dan + selective gstack methods into Cursor-native artifacts—without namespace collision or auto-merge risk.

**Architecture:** Four layers—(1) IDE/runtime defaults, (2) user-global skills, (3) repo `.cursor/` + `docs/superpowers/`, (4) optional Codex CLI sidecar for adversarial review. Philosophy over repo cloning: Karpathy = verifiable goals + harness; Indy = hooks/observability/library; Garry Tan = role gates + real-browser QA.

**Tech Stack:** Cursor IDE · Composer 2.5 (`composer-2.5` / `composer-2.5-fast`) · `@cursor/sdk` · OpenAI Codex CLI (`@openai/codex`) · existing Synthex skills (400+) · gstack selective · superpowers plugin

**Linear:** **SYN-988** — Agent stack: Composer 2.5, Cursor hooks, Karpathy/Indy methods

**Spec / prior art:** `docs/marketing-agency/recon-2026-05-15.md` (G-Stack/Karpathy) · `.claude/memory/MEMORY.md` (gstack gate decision) · `.cursor/HOOKS-FIX.md`

---

## Executive summary (May 2026)

| Source                                                                                        | What shipped                                                                  | Synthex posture                                                |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [Composer 2.5](https://cursor.com/changelog/composer-2-5) (18 May 2026)                       | Better long-horizon tasks, instruction following; Standard vs Fast pricing    | **Adopt:** IDE default Fast; background/ship-loop Standard     |
| [Codex CLI 0.133.0](https://github.com/openai/codex/releases/tag/rust-v0.133.0) (21 May 2026) | Goals on by default, permission profiles, plugin marketplace, Windows sandbox | **Adopt:** pin latest stable CLI; keep adversarial manual-only |
| [garrytan/gstack](https://github.com/garrytan/gstack)                                         | 23 role-based skills; `/browse`, `/qa`, `/investigate`, etc.                  | **Keep selective** (`/qa`, `/cso` only)—already decided        |
| [karpathy/autoresearch](https://github.com/karpathy/autoresearch)                             | `program.md` agent loop + fixed metric                                        | **Borrow pattern** for ship-loop / `.harness/learning`         |
| [disler](https://github.com/disler) (Indy Dev Dan)                                            | Hooks mastery, observability, `the-library`                                   | **Adopt hooks discipline** for `.cursor/hooks` (active pain)   |

**Cannot be automated by an agent:** Updating the Cursor desktop app, Vercel dashboard env, or corporate TLS roots. Those stay human/IT steps (documented in Phase 0).

---

## Method synthesis (how the three “senior” voices map to Synthex)

### Andrej Karpathy (philosophy + harness)

- **Think before coding** — assumptions explicit; tradeoffs surfaced (already in `CLAUDE.md` Karpathy section; **repair file if encoding corrupt**).
- **Simplicity first** — no speculative abstractions (aligns with CONSTITUTION verification).
- **Surgical changes** — minimal diff (Synthex standards).
- **Goal-driven execution** — declarative success criteria + loops (`npm test`, curl gates)—not “should work”.
- **autoresearch pattern** — edit _orchestration docs_ (`program.md` / ship-loop state), fixed metric, keep/revert; maps to `ship-loop-master` + `.harness/learning/*.jsonl`.

**Do not:** Copy ML training code from `nanochat` / `autoresearch` into Synthex app.

### Indy Dev Dan (agentic engineering infra)

| Repo                                                                                                                        | Stars | Adopt into Cursor                                                         |
| --------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------- |
| [disler/claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery)                                     | ~3.5k | JSON contract for PreToolUse; stdin drain; observability                  |
| [disler/claude-code-hooks-multi-agent-observability](https://github.com/disler/claude-code-hooks-multi-agent-observability) | ~1.3k | Optional: log hook events to JSONL for ship-loop debug                    |
| [disler/the-library](https://github.com/disler/the-library)                                                                 | ~335  | Catalog pattern for skill pointers (like your 400+ skills)—reference only |

**Cursor hook rule (Indy-aligned):** Hook stdout = **only** valid JSON; always drain stdin; Node `.cjs` preferred on Windows over `.cmd` echo.

### Garry Tan / gstack (role discipline)

- **Before code:** `/office-hours` → CEO/eng/design plan reviews (Synthex already has CEO board, `grill-me`, `design-pressure-test`, `opus-adversary`).
- **After code:** `/review`, `/qa`, `/cso` (Synthex: review-board CI + `browser-verify` + gstack `/qa` `/cso` only).
- **Do not:** Full gstack install (21 commands duplicate Synthex catalog per MEMORY.md 28/04/2026).

---

## Phase 0 — Human / IT gates (no repo commit)

- [ ] **Step 1: Update Cursor app**

  `Ctrl+Shift+P` → **Cursor: Check for Updates** (need May 2026+ for Composer 2.5).

- [ ] **Step 2: Set models in Cursor**

  | Context                       | Model                                |
  | ----------------------------- | ------------------------------------ |
  | Interactive Agent / Composer  | **Composer 2.5 Fast** (default)      |
  | Background agents / long jobs | **Composer 2.5 Standard** (cost)     |
  | High-stakes architecture      | User choice: Opus / GPT-5.x per task |

  Docs: https://cursor.com/docs/models

- [ ] **Step 3: Update Codex CLI** (separate from Cursor; optional sidecar)

  ```powershell
  npm install -g @openai/codex@latest
  codex --version
  ```

  Target: **≥ 0.133.0** (Goals default, permission profiles). Sign in: `codex` → ChatGPT plan or API key per https://developers.openai.com/codex/auth

- [ ] **Step 4: Fix TLS for Vercel/Codex CLI** (your machine)
  - Remove invalid `NODE_EXTRA_CA_CERTS` until PEM is valid (`Test-Path`, `certutil -encode`).
  - Or use Vercel **web UI** for deploy logs (no CLI).
  - Verify: `Invoke-WebRequest https://api.vercel.com -UseBasicParsing` vs `node -e "require('https').get('https://api.vercel.com')..."`.

- [ ] **Step 5: Cursor Hooks UI audit**

  Settings → Hooks: remove stale entries (`$CLAUDE_PROJECT_DIR`, old `pre-bash-validate.py`). Project should use only `.cursor/hooks.json` → `pre-bash-allow.cmd` → `pre-bash-validate.cjs`. Reload window.

  Reference: `.cursor/HOOKS-FIX.md`, Indy’s hooks-mastery README.

---

## Phase 1 — Inventory & diff (read-only, 1 session)

### Task 1: Composer / SDK audit

**Files:**

- Read: `package.json` (if `@cursor/sdk` present)
- Read: `.github/workflows/*` for agent model strings
- Read: `docs/superpowers/plans/*ship-loop*`

- [ ] **Step 1: Grep repo for model IDs**

  ```powershell
  cd d:\Synthex
  rg "composer-2[^.]|composer-2\.5|gpt-5|claude-opus" --glob "*.{ts,tsx,js,yml,md,json}"
  ```

- [ ] **Step 2: Record findings** in `docs/superpowers/specs/2026-05-25-agent-stack-inventory.md` (create): list every hardcoded model slug and recommended replacement (`composer-2.5` vs `composer-2.5-fast`).

### Task 2: gstack version diff

**Files:**

- Compare: `~/.claude/skills/gstack/` (or user path) vs https://github.com/garrytan/gstack/commits/main

- [ ] **Step 1: Run gstack upgrade dry-run**

  User invokes: `/gstack-upgrade` (global skill) or:

  ```powershell
  cd $env:USERPROFILE\.claude\skills\gstack
  git fetch origin
  git log HEAD..origin/main --oneline
  ```

- [ ] **Step 2: Changelog table** in inventory spec: new skills since 2026-04-28; mark **adopt / ignore / already covered** against Synthex skills table in `CLAUDE.md` SKILL AUTO-SELECTION.

### Task 3: Codex + OpenAI surface

- [ ] **Step 1: Document Codex 0.133 features** relevant to Synthex in inventory spec: Goals, `requirements.toml` permission profiles, plugin marketplace, Windows sandbox.

- [ ] **Step 2: Confirm Synthex policy** — `codex-adversarial` remains **manual only** (CONSTITUTION); `codex-local` / `gstack/codex` for optional second opinion.

### Task 4: Karpathy + Indy repo pins

- [ ] **Step 1: Add `docs/superpowers/references/agent-influences.md`** with pinned URLs + one-line “what we steal”:
  - `karpathy/autoresearch` — program.md loop
  - `forrestchang/andrej-karpathy-skills` or in-repo CLAUDE section — four principles
  - `disler/claude-code-hooks-mastery` — hook JSON contract
  - `disler/the-library` — skill catalog meta-pattern
  - `garrytan/gstack` — selective commands only

---

## Phase 2 — Cursor-native integration (repo changes)

### Task 5: Repair `CLAUDE.md` encoding

**Files:**

- Modify: `CLAUDE.md` (Karpathy + gstack sections corrupted in some editors)

- [ ] **Step 1: Identify corruption**

  ```powershell
  Format-Hex -Path d:\Synthex\CLAUDE.md -Count 64
  ```

- [ ] **Step 2: Restore readable UTF-8** from git history or re-paste Karpathy-Inspired + gstack sections from last good commit.

- [ ] **Step 3: Verify** `rg "Karpathy-Inspired" CLAUDE.md` returns clean text.

### Task 6: Harden `.cursor/hooks` (Indy Dev Dan method)

**Files:**

- Modify: `.cursor/hooks/pre-bash-allow.cmd`
- Modify: `.cursor/hooks/pre-bash-validate.cjs`
- Modify: `.cursor/hooks.json`
- Modify: `.cursor/HOOKS-FIX.md`
- Create: `.claude/skills/cursor-hooks-windows/SKILL.md` (extend with Indy cross-links)

- [ ] **Step 1: Ensure cmd delegates to Node only**

  ```cmd
  @echo off
  node "%~dp0pre-bash-validate.cjs"
  exit /b %ERRORLEVEL%
  ```

- [ ] **Step 2: Add smoke test script**

  Create: `scripts/test-cursor-prebash-hook.ps1`

  ```powershell
  $payload = '{"tool_name":"Shell","tool_input":{"command":"echo ok"}}'
  $payload | node .cursor/hooks/pre-bash-validate.cjs
  # Expected stdout: {"permission":"allow"...}
  ```

- [ ] **Step 3: Run smoke test** — paste actual stdout in PR comment.

- [ ] **Step 4: Optional observability** (Indy pattern): append hook allow/deny events to `.claude/scratchpad/hook-events.jsonl` behind env flag `SYNTHEX_HOOK_LOG=1` (default off).

### Task 7: Cursor rules — “Agent Stack 2026-05”

**Files:**

- Create: `.cursor/rules/agent-stack.mdc` (always-on or agent-requestable)

Content (concise):

- Default model: Composer 2.5 Fast in IDE; Standard for background.
- Invoke `verification-before-completion` before done claims.
- gstack: only `/qa` and `/cso` when explicitly requested.
- Karpathy: four principles + goal-driven verification commands.
- Codex: manual adversarial only on auth/payments/migrations.
- Hooks: never break JSON stdout contract.

- [ ] **Step 1: Write rule file** (~80 lines max).
- [ ] **Step 2: Link from `CLAUDE.md` SESSION PROTOCOL** (after repair).

### Task 8: gstack selective upgrade

**Files:**

- Modify: user-global `~/.claude/skills/gstack` (human runs git pull — not committed to Synthex repo)
- Modify: `.claude/memory/MEMORY.md` — append decision if new gstack skill adopted

- [ ] **Step 1: Pull latest gstack globally**

  ```powershell
  cd $env:USERPROFILE\.claude\skills\gstack
  git pull --ff-only origin main
  ```

  **Do not** run `./setup --team` in Synthex repo (MEMORY decision).

- [ ] **Step 2: Re-validate `/browse` vs Cursor** — Synthex uses gstack browse instead of Chrome MCP where applicable; confirm no conflict with `browser-verify` skill.

- [ ] **Step 3: Document in MEMORY.md** if any new gstack command is net-new vs Synthex catalog (adopt only if zero overlap).

### Task 9: Karpathy harness for ship-loop (lightweight)

**Files:**

- Modify: `.claude/skills/ship-loop-master/SKILL.md` (add “metric + revert” paragraph)
- Modify: `.claude/scratchpad/ship-loop-state.json` schema comment in `ship-loop-shared/`

- [ ] **Step 1: Add autoresearch-inspired loop text**
  - Fixed gates: `type-check`, `lint`, `test`, `build` = val_bpb equivalent.
  - On second failure: escalate, do not infinite loop (max 2 retries per CONSTITUTION).
  - Log experiment line to `.harness/learning/ci-failures.jsonl` on escalate.

- [ ] **Step 2: No new npm dependencies.**

---

## Phase 3 — Optional automation (SDK / CI)

### Task 10: `@cursor/sdk` pilot (only if SYN-XXXX scope includes automation)

**Files:**

- Create: `scripts/agent-sdk-smoke.mjs` (or `.ts`)
- Modify: `.env.example` — `CURSOR_API_KEY` documented (no secrets committed)

- [ ] **Step 1: Install SDK** (human approval required per CONSTITUTION npm rule)

  Package: `@cursor/sdk` — state bundle impact in Linear comment before install.

- [ ] **Step 2: Smoke script**

  ```typescript
  import { Agent } from '@cursor/sdk';
  const result = await Agent.prompt('npm run type-check', {
    model: { id: 'composer-2.5' },
    local: { cwd: process.cwd() },
  });
  ```

- [ ] **Step 3: Wire to GitHub Actions** only after smoke passes locally—optional nightly, not PR blocking.

### Task 11: PR checklist update

**Files:**

- Modify: `.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: Add checklist items**
  - [ ] Tested on **main Vercel preview** (sandbox optional)
  - [ ] Composer 2.5 / CI gates green
  - [ ] If auth/payments: manual `codex-adversarial` or `/cso` invoked

---

## Phase 4 — Verification & handoff

### Task 12: Verification matrix

- [ ] **Step 1: Local pre-PR gate**

  ```powershell
  npm run type-check
  npm run lint
  npm test
  ```

- [ ] **Step 2: Hook smoke**

  ```powershell
  powershell -File scripts/test-cursor-prebash-hook.ps1
  ```

- [ ] **Step 3: Agent can run Shell in Cursor** — one `gh pr checks 300` without hook JSON error.

- [ ] **Step 4: Document “sandbox Vercel red = ignorable”** in `docs/superpowers/references/ci-merge-policy.md` (link `pr-merge-ci-gate` skill).

### Task 13: Linear + scratchpad

- [ ] **Step 1: Comment on SYN-XXXX** with files changed + verification output.
- [ ] **Step 2: Clear `.claude/scratchpad/current-session.md`** per session protocol.

---

## What we are explicitly NOT doing

| Item                                      | Reason                                 |
| ----------------------------------------- | -------------------------------------- |
| Full gstack `./setup --team` in repo      | Namespace collision; MEMORY 28/04/2026 |
| Auto-run `codex-adversarial` in ship-loop | CONSTITUTION manual-only               |
| Replace Supabase auth with Codex/Clerk    | Hard limit                             |
| Copy Karpathy ML repos into app           | Wrong domain                           |
| `NODE_TLS_REJECT_UNAUTHORIZED=0`          | Security                               |
| Merge PR #300 without human gate          | User directive                         |

---

## Recommended `/goal` wording (next session)

> **Goal:** Complete Phase 0–2 of `docs/superpowers/plans/2026-05-25-agent-stack-cursor-upgrade.md` on branch `feat/syn-XXXX-agent-stack`: repair `CLAUDE.md`, harden Cursor hooks with Indy-style JSON contract + smoke script, add `.cursor/rules/agent-stack.mdc`, inventory doc, and verify Composer 2.5 defaults documented. Trace to Linear SYN-XXXX. Do not merge.

---

## Self-review (plan vs spec)

| Requirement                            | Task                                       |
| -------------------------------------- | ------------------------------------------ |
| Research Composer 2.5 / Codex / OpenAI | Phase 0 + Task 1–3                         |
| Pull updates into Cursor               | Phase 0–2 (IDE, hooks, rules, gstack pull) |
| gstack repo                            | Task 2, 8 (selective)                      |
| Karpathy methods                       | Task 4, 9, Karpathy section                |
| Indy Dev Dan methods                   | Task 6, hooks                              |
| No placeholders                        | Concrete paths/commands above              |
| Synthex traceability                   | Linear SYN-XXXX header                     |

---

## Execution handoff

**Plan saved to:** `docs/superpowers/plans/2026-05-25-agent-stack-cursor-upgrade.md`

**Two execution options:**

1. **Subagent-driven (recommended)** — one subagent per task (inventory → hooks → rules → docs), review between tasks.
2. **Inline** — execute Phases 0–2 in this session with checkpoints after Task 6 (hooks) and Task 12 (verification).

**Which approach do you want—and should I create the Linear issue title/description for SYN-XXXX before implementation?**
