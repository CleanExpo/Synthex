---
name: cli-anything
description: >-
  CLI-Anything integration guide for Synthex. Documents how to wrap external tools
  (FFmpeg, Vercel, Supabase, Stripe, GitHub, Playwright, social platforms) as
  agent-native CLIs for both internal dev/ops and client-facing automation.
  Use when adding new CLI-based capabilities to the autopilot or workflow engine,
  or when wiring a new external tool for agent consumption.
effort: medium
metadata:
  author: synthex
  version: '1.0'
  engine: synthex-ai-agency
  type: reference-skill
  triggers:
    - cli-anything
    - agent-native cli
    - ffmpeg cli
    - vercel cli
    - supabase cli
    - stripe cli
    - playwright cli
    - social cli
    - autonomous deploy
    - client automation
  requires:
    - content-pipeline
    - build-orchestrator
context: fork
---

## Purpose

CLI-Anything (HKUDS/CLI-Anything) is a Claude Code plugin that auto-generates agent-native CLI
wrappers for any software. Given a target binary, repo, or SDK, it runs a 7-phase pipeline
(Analyse → Design → Implement → Test → Document → Publish → SKILL.md) and produces a pip-installable
package with structured JSON output and a `SKILL.md` that Claude Code auto-discovers on install.

CLIs are the universal agent interface: structured JSON in, structured JSON out, no screen scraping,
no natural-language parsing. Synthex uses two layers:

1. **Platform layer (internal)** — wraps dev/ops tools (FFmpeg, Vercel, Supabase, Stripe, GitHub,
   Playwright) so the autopilot and workflow engine can drive them without human intervention.
2. **Client surface (past the paywall)** — exposes capabilities to Synthex customers as first-class
   workflow steps: social publishing, GWS automation, competitor research, campaign intelligence,
   and model switching.

---

## Installation

Install the Claude Code plugin once:

```bash
/plugin marketplace add HKUDS/CLI-Anything
/plugin install cli-anything
```

Generate a CLI for any tool:

```bash
/cli-anything:cli-anything <software-path-or-repo>
```

After the 7-phase pipeline completes, install the output package:

```bash
pip install ./output/<generated-package>
```

Claude Code auto-discovers the bundled `SKILL.md` immediately — no manual copy to `.claude/skills/`
required. The REPL banner confirms the discovery path.

---

## Layer A — Synthex Platform CLIs

These CLIs give the Synthex autopilot and workflow engine direct, structured control over the
tools the platform already depends on.

### FFmpeg — Video Pipeline

**Current state:** `lib/video/video-processor.ts` calls `fluent-ffmpeg` sequentially with no
queue; errors are parsed from stderr strings.

**Generate:**

```bash
/cli-anything:cli-anything https://github.com/FFmpeg/FFmpeg
```

**Key commands exposed:**

- `transcode --input <file> --codec h264 --output <file>`
- `trim --start <ts> --end <ts>`
- `add-voiceover --audio <file> --mix <volume>`
- `extract-frames --fps 1 --output-dir <dir>`
- `watermark --image <file> --position bottom-right`
- `concat --manifest <playlist.txt>`

**Wiring:** Add a `video-process` step type in `lib/workflow/step-executor.ts`. JSON output
replaces the stderr-parsing logic in `lib/video/video-orchestrator.ts`. The ElevenLabs voiceover
(already in Vercel env) feeds directly into `add-voiceover`.

---

### Vercel — Autonomous Deployments (UNI-1181)

**Current state:** Deployments are triggered by `git push` only; no agent control post-push.

**Generate:**

```bash
/cli-anything:cli-anything https://github.com/vercel/vercel
```

**Key commands exposed:**

- `deploy --prod`
- `rollback <deployment-id>`
- `logs --function <name> --tail`
- `env set <key> <value> --environment production`
- `env get <key>`
- `domains list`

**Wiring:** Add a `deploy` step type in `lib/workflow/`. The hive-mind agent triggers this
post-merge. This enables the full autonomous loop: deploy → verify logs → rollback if unhealthy,
without a human in the loop. Directly unblocks UNI-1181.

---

### Supabase — DB Agent Control

**Current state:** Migrations run manually via `npx prisma db push`; no agent-triggered schema ops.

**Generate:**

```bash
/cli-anything:cli-anything supabase-cli
```

**Key commands exposed:**

- `migrate up`
- `migrate down --to <version>`
- `db push --dry-run`
- `db diff`
- `logs --type api --tail`
- `branches list`

**Wiring:** Add a `db-migrate` step type. Gate: always run `npx prisma validate` before
`supabase migrate up` — this is non-negotiable per the Synthex migration safety rules. The
autopilot can validate schema before campaign launch without human intervention.

---

### Stripe — Billing Automation

**Current state:** All Stripe interactions are webhook-driven; no agent-triggered billing ops exist.

**Generate:**

```bash
/cli-anything:cli-anything stripe-cli
```

**Key commands exposed:**

- `subscription cancel --customer <id>`
- `subscription pause --customer <id> --duration <days>`
- `invoice list --customer <id>`
- `invoice retry <invoice-id>`
- `customer lookup --email <email>`
- `checkout create --price <price-id>`

**Wiring:** Add a `billing-action` step type. The autopilot can handle dunning flows, trial
extensions, and subscription changes as part of a campaign or retention workflow.

**Security constraint:** All Stripe CLI calls must be org-scoped. Never allow cross-org customer
operations. Validate `org_id` before every billing action — same rule as all Prisma queries.

---

### GitHub — PR & Issue Automation

**Current state:** Raw `gh` CLI calls in hooks produce unstructured text output that is not
agent-consumable.

**Generate:**

```bash
/cli-anything:cli-anything gh
```

**Key commands exposed:**

- `pr create --title <t> --body <b> --base main`
- `pr merge <number> --squash`
- `issue comment <number> --body <b>`
- `ci status --repo <repo>`
- `release create <tag> --notes <file>`

**Wiring:** Replace raw `gh` bash calls in `.claude/hooks/` with structured JSON output via the
generated CLI. The hive-mind agent triggers `pr create` post-implementation and then fires a
Linear update via the existing MCP hook.

---

### Playwright — Social & Browser Automation

**Current state:** Playwright is used for E2E tests only; social platforms use OAuth API SDKs.

**Generate:**

```bash
/cli-anything:cli-anything https://github.com/microsoft/playwright
```

**Key commands exposed:**

- `run --story <path.json>`
- `screenshot --url <url> --output <file>`
- `fill-form --url <url> --fields <json>`
- `scrape --url <url> --selector <css>`

**Wiring:** Add a `browser-automate` step type as a fallback publisher for platforms without
stable APIs (TikTok web, Threads early access). Also used in client onboarding flows requiring
browser-based OAuth setup.

---

## Layer B — Client-Facing CLIs

These CLIs are Synthex capabilities exposed to paying customers via the autopilot engine. They
unlock at paid tiers and appear as workflow step options in the AI Command Centre.

### Social Platform CLIs

**Platforms:** YouTube Studio, LinkedIn, TikTok, Instagram, Pinterest

**Generate (example for LinkedIn):**

```bash
/cli-anything:cli-anything https://github.com/linkedin/li-api
```

**Key commands per platform:**

- `publish --content <file> --platform <name>`
- `analytics pull --period 30d`
- `comment reply --post-id <id> --body <text>`
- `hashtag research --niche <topic>`

**Wiring:** Each platform CLI becomes an alternative backend in `lib/social/<platform>-service.ts`
alongside the existing SDK integration. The autopilot falls back to the CLI when the SDK token
has expired or rate-limited.

**Client benefit:** Agent publishes across all platforms without requiring a new OAuth dance each
session.

---

### Google Workspace (GWS)

**Platforms:** Gmail, Google Calendar, Google Drive, Google Business Profile (GBP)

**Generate:**

```bash
/cli-anything:cli-anything google-api-nodejs-client
```

**Key commands exposed:**

- `gmail send --to <email> --subject <s> --body <file>`
- `calendar create-event --title <t> --start <dt> --end <dt>`
- `drive upload --file <path> --folder-id <id>`
- `gbp post --location-id <id> --text <file>`
- `gbp review-reply --review-id <id> --body <text>`

**Wiring:** Wire into campaign automation workflow: email sequences trigger from campaign
milestones, GBP posts schedule via the cron autopilot, Drive delivers reports automatically.

**Client benefit:** Fully automated client communication + GBP management from a single workflow,
no manual Google login required.

---

### Analytics & Reporting

**Generate from existing services:**

```bash
/cli-anything:cli-anything lib/ai/insights-generator.ts
```

**Key commands exposed:**

- `report generate --period 30d --format pdf`
- `anomaly scan --metric engagement --threshold 20%`
- `sentiment pull --platform instagram --days 7`
- `export --format pdf --destination drive`

**Wiring:** Add to the scheduled autopilot cron (`cron/autopilot`) to auto-generate weekly client
reports and deliver to their inbox or Drive folder.

**Client benefit:** Reports land in the client inbox automatically — no dashboard visit needed.

---

### Competitor Research

**Generate from existing tracker:**

```bash
/cli-anything:cli-anything lib/social/competitor-tracker.ts
```

**Key commands exposed:**

- `competitor track --handle @competitor`
- `gap analysis --vs @competitor`
- `benchmark --metric follower-growth --period 90d`
- `alert set --metric engagement --threshold 10%`

**Wiring:** Feed into the autopilot weekly learning loop (`cron/autopilot-learn`). Agents
automatically pull competitor deltas and adjust content strategy without human review.

**Client benefit:** Agents track competitor moves and adapt the client's content strategy
automatically week-over-week.

---

### Campaign Intelligence

**Generate from strategy layer:**

```bash
/cli-anything:cli-anything lib/autopilot/content-strategy.ts
```

**Key commands exposed:**

- `campaign plan --goal awareness --days 30`
- `campaign preview --id <id>`
- `performance score --campaign-id <id>`
- `campaign adapt --reason "low engagement"`

**Wiring:** Expose as interactive commands in the AI Command Centre
(`components/command-centre/`). Agent proposes, client approves once, agent executes the entire
campaign without further manual setup.

**Client benefit:** Client approves a goal; the agent handles planning, content creation,
scheduling, publishing, and performance adaptation end-to-end.

---

### LLM / Model Switching (LLMFit)

**Generate from model registry:**

```bash
/cli-anything:cli-anything lib/ai/model-registry.ts
```

**Key commands exposed:**

- `model list --tier premium`
- `model benchmark --task caption --models claude,gpt4`
- `model set --tier premium --model claude-opus-4-7`
- `cost estimate --campaign-id <id> --model claude-sonnet-4-6`

**Wiring:** Integrates into the content pipeline BYOK flow. Clients override the model per
campaign from their dashboard. Cost-conscious clients choose cheaper models; power users opt into
Claude Opus for quality-critical campaigns.

**Client benefit:** Full model transparency and control — clients see cost estimates before
committing to a model for a campaign.

---

## Workflow Engine Integration

Generated CLIs become first-class step types in `lib/workflow/step-executor.ts`:

```typescript
// New step types unlocked by CLI-Anything wrappers:
// 'video-process'    → cli-anything-ffmpeg
// 'deploy'           → cli-anything-vercel
// 'db-migrate'       → cli-anything-supabase
// 'billing-action'   → cli-anything-stripe
// 'browser-automate' → cli-anything-playwright
// 'social-publish'   → cli-anything-<platform>
// 'gbp-post'         → cli-anything-gws
// 'report-generate'  → cli-anything-analytics
// 'campaign-adapt'   → cli-anything-campaign-intel
// 'model-switch'     → cli-anything-llmfit
```

**Pattern for adding a new step type:**

1. Generate CLI via CLI-Anything: `/cli-anything:cli-anything <target>`
2. `pip install ./output/<generated-package>` — SKILL.md auto-discovered
3. Add step type handler in `lib/workflow/step-executor.ts`
4. Add step schema in `lib/workflow/types.ts`
5. Write integration test verifying the step runs end-to-end in a workflow

---

## SKILL.md Auto-Discovery

Every generated CLI ships a `SKILL.md` inside its Python package. After `pip install`:

- Claude Code scans installed packages and discovers embedded `SKILL.md` files automatically
- The REPL banner prints the absolute discovery path on first load
- No manual copy to `.claude/skills/` is required

This means **every new CLI-Anything generation automatically extends the agent's skill set**. The
SKILL.md documents the generated CLI's commands, arguments, and JSON output schema so the agent
can use it immediately without reading source code.

---

## Priority Order

| CLI            | Layer    | Impact | Effort | Priority | Notes                         |
| -------------- | -------- | ------ | ------ | -------- | ----------------------------- |
| FFmpeg         | Platform | High   | Low    | 1        | Already in use — just wrap    |
| Vercel         | Platform | High   | Low    | 2        | Unblocks UNI-1181 directly    |
| GitHub         | Platform | Medium | Low    | 3        | Replaces raw `gh` hook calls  |
| Supabase       | Platform | Medium | Medium | 4        | DB autonomy for migrations    |
| Stripe         | Platform | Medium | Medium | 5        | Billing automation (dunning)  |
| GWS            | Client   | High   | Medium | 6        | GBP + email campaigns         |
| Social CLIs    | Client   | High   | High   | 7        | Per-platform wrappers (×5)    |
| Playwright     | Both     | Medium | Medium | 8        | Browser fallback + onboarding |
| Analytics      | Client   | Medium | Low    | 9        | Wraps existing services       |
| Campaign Intel | Client   | High   | Medium | 10       | Premium tier feature          |

---

## Common Mistakes

| Mistake                                                             | Correct Approach                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Running `npx next build` instead of `npm run build`                 | Always use `npm run build` — Turbopack vs webpack differ         |
| Targeting an SDK repo instead of the CLI binary                     | Target the CLI harness or binary, not the library SDK            |
| Forgetting `pip install` after generation                           | SKILL.md is only discovered after `pip install` — always install |
| Cross-org Stripe CLI calls                                          | Validate `org_id` before every billing action — never cross-org  |
| Skipping `prisma validate` before Supabase migrate step             | `npx prisma validate` is a hard gate before any `migrate up`     |
| Wiring a CLI step without a schema entry in `lib/workflow/types.ts` | Add both handler and schema — the type system enforces this      |

---

## File Index

Key Synthex files this skill references:

```
lib/video/video-processor.ts          — FFmpeg integration target
lib/video/video-orchestrator.ts       — Video workflow (replace stderr parsing)
lib/workflow/step-executor.ts         — Add new CLI step types here
lib/workflow/types.ts                 — Step type schema definitions
lib/autopilot/launch-pipeline.ts      — Autopilot launch pipeline (CLI gates)
lib/autopilot/performance-learner.ts  — Weekly learning loop (CLI input)
lib/ai/model-registry.ts              — Model registry (LLMFit CLI target)
lib/ai/insights-generator.ts          — Analytics CLI generation target
lib/social/                           — Social platform services (9 files)
lib/social/competitor-tracker.ts      — Competitor research CLI target
lib/autopilot/content-strategy.ts     — Campaign intelligence CLI target
app/api/command-centre/               — AI Command Centre API routes
components/command-centre/            — AI Command Centre UI
scripts/                              — Existing utility scripts to unify
```

> **Reference skill:** This is a read-only architecture guide — it documents existing systems and does not generate creative or code output. No capability uplift block is needed.
