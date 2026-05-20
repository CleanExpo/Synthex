# CONSTITUTION.md — Synthex Project Rules (IMMUTABLE)

## Re-read at every session start. These rules override all other guidance.

### Identity

- Project: Synthex — AI-powered marketing automation platform
- URL: synthex.social (not yet public — GOD MODE testing only)
- Repo: CleanExpo/Synthex | Local: D:\Synthex
- Stack: Next.js 15 (App Router) | TypeScript 5 | Prisma 6 | PostgreSQL (Supabase) | Vercel | Node 22

### Auth — SUPABASE ONLY (non-negotiable)

- NEVER use Clerk, NextAuth, Auth.js, or any other auth system
- Auth lives in lib/auth/ — always check there first
- Flow: Supabase session → JWT → RBAC permissions → owner bypass

### Architectural Rules

1. No mock data — every endpoint returns real database data
2. All API mutations must have Zod validation
3. All queries must be org-scoped (never expose cross-organisation data)
4. No cross-layer imports — pages → components → hooks → lib services
5. No new npm packages without stating: package name + reason + bundle impact
6. Before touching any route or page file: check .planning/ROUTE_REFERENCE.md
   for the exact path, auth level, and canonical lib/auth/ function required.

### Database

- 91 Prisma models — schema at prisma/schema.prisma
- NEVER drop columns, rename columns, or change column types without explicit approval
- New columns must have defaults or be nullable (backward compatible migrations)
- Always run `npx prisma validate` before any schema push

### Code Standards

- Australian English: colour, organise, recognise, licence (noun), authorise
- Currency: AUD | Date format: DD/MM/YYYY
- Commits: `type(scope): description` — e.g. `fix(api): resolve auth timeout`
- React files: PascalCase.tsx | Utils: kebab-case.ts

### Linear Workflow

- All work traces to a Linear issue (UNI-XXXX) — no changes without an issue
- Current milestone: v2.0 Reliable AI Agents (Phases 59-66)
- Project ID: 3125c6e4-b729-48d4-a718-400a2b83ddc5
- `UNI-2046` defines the Close the Loop mandate: no non-trivial task is done
  until it is captured, grounded, integrated, verified, registered, observed,
  and closed back into Linear/Wiki or explicitly blocked with the next action.

### Deployment Context

- Stripe integration: ON HOLD (GOD MODE testing — not yet public)
- UNI-1202 (Stripe Price IDs) and UNI-1203 (Encryption keys): human-gated
- Production deploy: synthex.social via Vercel (Vercel project: unite-group/synthex)

### Agent Execution Rules (Minions-Inspired, 2026-03-03)

These rules apply to all AI subagent execution and multi-step workflow development:

1. **2-round auto-fix cap**: Maximum 2 automatic retries per failing step before escalating to
   human. Never brute-force past failures — diagnose, then pause.
2. **Linear issue required**: Every subagent dispatch must include a Linear issue ID (UNI-XXXX).
3. **Token budget discipline**: Include only verified-relevant context in subagent prompts.
   Do not inject full conversation history — use specific file paths + prior outputs only.
4. **One-shot principle**: Plan once, execute once. No re-planning mid-execution. If the plan
   is wrong, pause and ask — don't loop.
5. **Parallelise independent work**: Use parallel Task calls for independent subagents.
   Sequential only when there is a true data dependency.
6. **Walls before models**: Worktree isolation, validation gates, and TypeCheck/lint must pass
   before any code is considered complete. Guardrails > model selection.
7. **System runs the model**: Orchestrators and deterministic logic control flow.
   LLM output is consumed by the system — it does not direct the system.

### Workflow Architecture Rules (Phase 62+)

For all AI workflow product features (WorkflowExecution, StepExecution):

1. Every AI step MUST return a confidence score (0.0–1.0) stored in StepExecution.
2. Auto-approve threshold is configurable per template; default is ≥ 0.85.
3. Maximum 2 automatic retries per step before escalating to human review.
4. Steps MUST be isolated: each reads from previous StepExecution.outputData, not memory.
5. Parallel workflow executions are allowed; single-execution is the default.
6. Human approval gates are mandatory for any step that writes to external systems.
7. Workflow executions must be cancellable at any step boundary.
8. Context for each AI step: step definition + previous outputs only (no full history).

### Claude 4.6 Thinking Guidelines

- Adaptive thinking is Anthropic-direct only — ignored on OpenRouter/Google
- Use `thinking: { type: "adaptive" }` — NOT the deprecated `budget_tokens` approach
- Effort levels: low (light content), medium (standard campaigns), high (multi-step), max (Opus flagship)
- Enable `medium` for premium BYOK content generation
- Enable `high` for multi-step campaigns (5+ posts)
- Enable `max` for Opus flagship brand strategy only
- Use `thinkingDisplay: "omitted"` for high-volume generation (skips thinking in response)
- Always pair thinking with `cache: true` on system prompt for repeat campaign calls
- Interleaved thinking is auto-enabled with adaptive thinking (no beta header needed)
- 1M context at standard pricing — no 2x premium over 200k
- Full reference: `.planning/AI-CAPABILITIES.md`

### MCP Channel Conventions (Multi-Agent)

- Claude Code supports `--channels <name>` for isolated MCP state between parallel agents
- Use channels when dispatching parallel subagents that must not share tool context
- Each subagent dispatch still requires a Linear issue ID (UNI-XXXX)
- Obsidian MCP server (`mcp-obsidian`) is dev-only — never assume it's available in Vercel

### Obsidian Vault Conventions

- Vault root: `D:\ObsidianVault\Synthex` (dev machine only)
- Per-client structure: `Clients/{orgId}/` with `business-dna.md`, `insights.md`, `context.md`
- All Obsidian calls are no-ops when `OBSIDIAN_ENABLED` is not `'true'` — safe on Vercel
- API key lives in `.env.local` as `OBSIDIAN_API_KEY` — never commit
- `lib/obsidian/` is the integration layer — always use it, never call the REST API directly

### StopFailure Hook

- `.claude/hooks/stop-failure.ps1` fires on `Stop` events with `StopFailure` type
- Writes a timestamped note to `.claude/scratchpad/current-session.md`
- Next session: read scratchpad before starting — resume from last progress note

### Hard Limits

- Never `git push` without explicit human confirmation in chat
- Never modify .env, .env.local, .env.production without explicit confirmation
- Never delete files — move to .claude/archived/YYYY-MM-DD/ instead
- Never run `prisma migrate reset` (destructive)
- Never skip pre-commit hooks (--no-verify)

### Verification Non-Negotiables (CEO Directive — 2026-03-26)

These rules were added after repeated incidents where agents declared work "done" or "fixed" when nothing had actually changed on the live site. Violations of these rules are the direct reason Phill lost confidence in the system.

- NEVER declare a demo endpoint "fixed" without running the actual curl against the live production URL and pasting the response in your reply
- NEVER declare tests "passing" without pasting the real Jest output line (`Tests: X passed, Y total`)
- NEVER declare a deployment "complete" without confirming the Vercel dashboard shows "Ready"
- NEVER use phrases like "should work", "probably passes", "looks correct" — run the command and report the actual output
- The verification-gate.md rule is NOT documentation — it is enforced. Paste the curl output or don't claim done.
