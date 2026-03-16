# Phase 118: Headless Task-Runner — Research

**Researched:** 2026-03-16
**Domain:** Autonomous AI agent execution — Claude Agent SDK + Linear webhook integration
**Confidence:** HIGH

<research_summary>
## Summary

Phase 118 builds an autonomous headless task-runner: Linear issues move to "In Progress" → a webhook fires → a BullMQ worker picks it up → the Claude Agent SDK executes the task autonomously → Linear is updated with the result.

The Synthex codebase already has BullMQ infrastructure (`lib/queue/bull-queue.ts`) with a `WORKFLOW_STEPS` queue and workers. This phase adds a new `autonomous-tasks` queue, a Linear webhook receiver, and a worker that drives `@anthropic-ai/claude-agent-sdk` to execute tasks from the codebase.

Anthropic provides a first-party SDK (`@anthropic-ai/claude-agent-sdk` v0.2.76) which exposes an async generator `query()` — it runs a `claude` subprocess and streams structured JSON messages. No raw API wrapping needed.

**Primary recommendation:** Use `@anthropic-ai/claude-agent-sdk` `query()` + `@linear/sdk` `LinearClient`. Linear webhook verifies HMAC-SHA256 signature. BullMQ handles retries and concurrency. Worker streams progress to Linear as comments, then updates state to Done on completion.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/claude-agent-sdk` | `^0.2.76` | Programmatic Claude Code execution | Official Anthropic SDK — not a raw API wrapper; runs the same agent loop as Claude Code CLI |
| `@linear/sdk` | `^77.0.0` | Linear API client | First-party Linear SDK with full type coverage |
| `bullmq` | `^5.67.2` | Job queue (already installed) | Already in use for workflow-steps; adds `autonomous-tasks` queue |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto` (Node built-in) | — | HMAC-SHA256 webhook signature verification | Linear webhook endpoint |
| `zod` | (already installed) | Payload validation | Linear webhook body schema |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@anthropic-ai/claude-agent-sdk` | `@anthropic-ai/sdk` (raw messages API) | Raw API requires building the entire agent loop; SDK gives tool execution, retries, context management for free |
| `@linear/sdk` | Raw Linear GraphQL | SDK is significantly more ergonomic; no benefit to raw GQL |
| BullMQ | In-process async | BullMQ gives persistence, retries, concurrency limits, and monitoring — required for production |

**Installation:**
```bash
npm install @anthropic-ai/claude-agent-sdk @linear/sdk
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
lib/
├── linear/
│   ├── client.ts          # Singleton LinearClient with lazy init
│   └── webhook-verifier.ts # HMAC-SHA256 signature verification
├── queue/
│   └── workers/
│       └── autonomous-task-worker.ts  # BullMQ worker: runs claude-agent-sdk
app/api/
└── webhooks/
    └── linear/
        └── route.ts       # POST endpoint: verify + enqueue
```

### Pattern 1: Linear Webhook → BullMQ → Claude Agent SDK
**What:** Linear fires a webhook on issue state change → receiver verifies signature and enqueues → BullMQ worker runs the agent
**When to use:** Any Linear issue automation requiring code changes or long-running tasks

```typescript
// app/api/webhooks/linear/route.ts
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('linear-signature') ?? '';

  if (!verifyLinearWebhook(body, signature, process.env.LINEAR_WEBHOOK_SECRET!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = LinearWebhookSchema.parse(JSON.parse(body));

  // Only trigger on issues moving to "started" state
  if (payload.type === 'Issue' && payload.action === 'update') {
    if (payload.data.state?.type === 'started') {
      await addJob(QUEUE_NAMES.AUTONOMOUS_TASKS, {
        type: 'autonomous:execute-task',
        issueId: payload.data.id,
        identifier: payload.data.identifier,
        title: payload.data.title,
        description: payload.data.description,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
```

### Pattern 2: Claude Agent SDK `query()` Iterator
**What:** Async generator — yields typed `SDKMessage` objects including tool events, result, and errors
**When to use:** All agent execution in the worker

```typescript
// Source: @anthropic-ai/claude-agent-sdk docs
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const message of query({
  prompt: `You are working on Linear issue ${identifier}: ${title}\n\n${description}`,
  options: {
    cwd: process.cwd(), // Repository root
    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
    appendSystemPrompt: 'Always work on a feature branch. Never commit directly to main.',
    maxTurns: 50,
  }
})) {
  if (message.type === 'result' && message.subtype === 'success') {
    // Post result to Linear
    await linearClient.createComment({
      issueId,
      body: `## ✅ Task Complete\n\n${message.result}\n\n*Cost: $${message.total_cost_usd?.toFixed(4)}*`,
    });
  }
}
```

### Pattern 3: Streaming Progress Comments
**What:** Post incremental updates to Linear while the agent runs — so the issue stays informative during long tasks

```typescript
// Post progress every N turns or on specific tool events
let turnCount = 0;
for await (const message of query({ prompt, options })) {
  if (message.type === 'assistant') {
    turnCount++;
    if (turnCount % 10 === 0) {
      await linearClient.createComment({
        issueId,
        body: `⏳ Agent working... (${turnCount} turns completed)`,
      });
    }
  }
}
```

### Pattern 4: HMAC Signature Verification
**What:** Linear signs every webhook with HMAC-SHA256; verify before processing
**When to use:** Always — reject any unverified webhooks with 401

```typescript
// lib/linear/webhook-verifier.ts
import * as crypto from 'crypto';

export function verifyLinearWebhook(
  body: string,
  signature: string,
  secret: string
): boolean {
  if (!secret) return false; // Never pass when secret unset
  const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}
```

### Anti-Patterns to Avoid
- **Processing without signature verification:** Always verify `Linear-Signature` header
- **Running the agent synchronously in the webhook handler:** Always enqueue — webhook must return 200 in <3s or Linear retries
- **Unlimited tool access:** Keep `allowedTools` to the minimum needed; don't pass `Bash` without thought
- **No turn limit:** Always set `maxTurns` to prevent runaway loops (suggest 50 for coding tasks)
- **Hardcoding state names:** Filter on `state.type === 'started'` not `state.name === 'In Progress'` — teams rename states
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent loop (think → act → observe) | Custom LLM prompt chain | `@anthropic-ai/claude-agent-sdk` `query()` | SDK handles retries, tool execution, context management, error subtypes — hundreds of edge cases |
| Linear API client | Raw GraphQL fetch | `@linear/sdk` `LinearClient` | Full type safety, automatic pagination, proper error handling |
| HMAC verification | Custom string comparison | `crypto.timingSafeEqual()` | Timing-safe comparison prevents timing attacks on signature checks |
| Job persistence + retries | In-memory queue | BullMQ (already installed) | Already handles retries, delayed jobs, concurrency — don't duplicate |
| Claude execution environment | `child_process.spawn()` | `@anthropic-ai/claude-agent-sdk` | SDK manages the claude subprocess, stdio communication, and message parsing |

**Key insight:** The Claude Agent SDK is not a thin wrapper — it implements the full agentic loop. Building the same from `@anthropic-ai/sdk` (raw Messages API) would require implementing tool execution, multi-turn conversations, error recovery, and context budgeting. The SDK does all of this.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Webhook Timeout
**What goes wrong:** Webhook handler takes >3 seconds → Linear retries → duplicate task execution
**Why it happens:** Running the agent synchronously in the route handler
**How to avoid:** Enqueue immediately in the webhook handler; return 200 before processing. The BullMQ worker handles execution asynchronously.
**Warning signs:** Duplicate Linear comments, multiple agent sessions for the same issue

### Pitfall 2: Missing `ANTHROPIC_API_KEY` in Worker Context
**What goes wrong:** The Claude Agent SDK spawns a `claude` subprocess; if `ANTHROPIC_API_KEY` is not set in the worker process environment, it falls back to interactive auth (fails headlessly)
**Why it happens:** Env vars available to Next.js routes are not automatically available to BullMQ workers if workers run in a separate process
**How to avoid:** Explicitly pass `ANTHROPIC_API_KEY` in the worker's environment or ensure it's in the process env before worker boot
**Warning signs:** Worker throws "Not authenticated" or hangs on first `query()` call

### Pitfall 3: Runaway Agent Loop
**What goes wrong:** Agent enters an infinite tool-call loop → burns tokens, never resolves
**Why it happens:** No `maxTurns` limit set; agent gets confused and keeps trying
**How to avoid:** Always set `maxTurns: 50` (or appropriate limit). Handle `error_max_turns` subtype in the result message — post a comment saying the task was too complex and needs human review.
**Warning signs:** Cost spikes, Linear issue comment count growing rapidly, BullMQ job never completing

### Pitfall 4: Tool Permission Scope Too Wide
**What goes wrong:** Agent uses `Bash` to do unexpected things (delete files, make network requests, etc.)
**Why it happens:** Passing all tools without restriction
**How to avoid:** Scope `allowedTools` to what the task actually needs. For code tasks: `['Read', 'Edit', 'Bash(git *)', 'Glob', 'Grep']`. The SDK supports prefix-matching in Bash permissions.
**Warning signs:** Unexpected file changes, external API calls in agent output

### Pitfall 5: Linear State ID Hardcoding
**What goes wrong:** Hardcoding state IDs breaks when teams reorganise their workflow
**Why it happens:** State IDs are UUIDs that differ per team/workspace
**How to avoid:** Fetch states dynamically: `client.workflowStates({ filter: { team: { id: { eq: teamId } } } })` and find by `state.type` ('completed', 'started', etc.)
**Warning signs:** `updateIssue` calls return 404 or "state not found"
</common_pitfalls>

<code_examples>
## Code Examples

### Worker: Autonomous Task Execution
```typescript
// lib/queue/workers/autonomous-task-worker.ts
import { Worker, Job } from 'bullmq';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { getLinearClient } from '@/lib/linear/client';
import { QUEUE_NAMES } from '@/lib/queue/bull-queue';
import { logger } from '@/lib/logger';

export interface AutonomousTaskJobData {
  type: 'autonomous:execute-task';
  issueId: string;
  identifier: string;
  title: string;
  description: string | null;
}

export function startAutonomousTaskWorker() {
  const worker = new Worker<AutonomousTaskJobData>(
    QUEUE_NAMES.AUTONOMOUS_TASKS,
    async (job: Job<AutonomousTaskJobData>) => {
      const { issueId, identifier, title, description } = job.data;
      const linear = getLinearClient();

      logger.info(`[autonomous-worker] Starting task ${identifier}`);

      const prompt = [
        `You are working on Linear issue ${identifier}: ${title}`,
        description ? `\nDescription:\n${description}` : '',
        '\nComplete the task described above.',
        'Work on a feature branch named fix/' + identifier.toLowerCase() + '.',
        'Run tests after making changes.',
        'When done, summarise what was changed.',
      ].join('');

      try {
        for await (const message of query({
          prompt,
          options: {
            cwd: process.cwd(),
            allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
            appendSystemPrompt: 'Never commit directly to main. Always create a feature branch.',
            maxTurns: 50,
          },
        })) {
          if (message.type === 'result') {
            if (message.subtype === 'success') {
              await linear.createComment({
                issueId,
                body: `## ✅ Task Complete\n\n${message.result}\n\n*Cost: $${message.total_cost_usd?.toFixed(4) ?? '?'}*`,
              });
              // Mark done
              await markIssueComplete(linear, issueId);
            } else {
              await linear.createComment({
                issueId,
                body: `## ⚠️ Task Failed\n\nSubtype: \`${message.subtype}\`\n\nNeeds human review.`,
              });
            }
          }
        }
      } catch (err) {
        logger.error(`[autonomous-worker] Error on ${identifier}:`, err);
        await linear.createComment({
          issueId,
          body: `## ❌ Worker Error\n\nTask runner encountered an error. Check server logs.`,
        });
        throw err; // Let BullMQ handle retry
      }
    },
    { connection: getRedisConnection(), concurrency: 2 }
  );

  worker.on('error', (err) => logger.error('[autonomous-worker] Worker error:', err));
  return worker;
}
```

### Linear Client Singleton
```typescript
// lib/linear/client.ts
import { LinearClient } from '@linear/sdk';

let client: LinearClient | null = null;

export function getLinearClient(): LinearClient {
  if (!client) {
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) throw new Error('LINEAR_API_KEY not set');
    client = new LinearClient({ apiKey });
  }
  return client;
}
```

### Webhook Receiver
```typescript
// app/api/webhooks/linear/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyLinearWebhook } from '@/lib/linear/webhook-verifier';
import { addJob, QUEUE_NAMES } from '@/lib/queue/bull-queue';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('linear-signature') ?? '';

  if (!verifyLinearWebhook(body, signature, process.env.LINEAR_WEBHOOK_SECRET ?? '')) {
    logger.warn('[linear-webhook] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Handle issue moved to "started"
  const p = payload as Record<string, unknown>;
  if (
    p.type === 'Issue' &&
    p.action === 'update' &&
    (p.data as Record<string, unknown>)?.state?.type === 'started'
  ) {
    const data = p.data as Record<string, unknown>;
    await addJob(QUEUE_NAMES.AUTONOMOUS_TASKS, {
      type: 'autonomous:execute-task',
      issueId: data.id as string,
      identifier: data.identifier as string,
      title: data.title as string,
      description: (data.description as string) ?? null,
    });
    logger.info(`[linear-webhook] Enqueued task for ${data.identifier}`);
  }

  return NextResponse.json({ ok: true });
}
```
</code_examples>

<sota_updates>
## State of the Art (2025–2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@anthropic-ai/sdk` raw Messages API + custom tool loop | `@anthropic-ai/claude-agent-sdk` `query()` | Late 2025 | SDK handles the full agentic loop; raw API only for simple completions |
| "headless mode" terminology | "Agent SDK CLI interface" or just `claude -p` | Late 2025 | Naming change only — same `-p` / `--print` flag |
| Manual Linear GraphQL | `@linear/sdk` v77 with typed models | Ongoing | SDK v70+ has full TypeScript types for all mutations |
| Linear MCP for interactive agent sessions | `@linear/sdk` for programmatic workers | 2026 | MCP requires OAuth interactive flow; API key is correct for background workers |

**New patterns to consider:**
- `query()` supports `--resume <session_id>` for multi-turn agent sessions across requests — useful for long-running tasks that need checkpointing
- `--allowedTools "Bash(git *)"` prefix matching — scope shell commands precisely without blocking all Bash
- `forkSession()` — branch an agent session to explore multiple approaches in parallel (future enhancement)
</sota_updates>

<open_questions>
## Open Questions

1. **Where does the BullMQ worker run on Vercel?**
   - What we know: Vercel Functions are stateless and ephemeral — BullMQ workers cannot run permanently inside Vercel Functions
   - What's unclear: The existing workers (`scheduled-posts-worker.ts`, etc.) appear to be defined but may not actually start on Vercel
   - Recommendation: For Phase 118, trigger worker execution via a dedicated `/api/workers/autonomous` route called by a cron job or check if workers are started in `instrumentation.ts`. Longer term, move to a separate process (Railway, Fly.io) or use Vercel's `waitUntil()` for short tasks.

2. **`claude` CLI availability in Vercel serverless environment**
   - What we know: `@anthropic-ai/claude-agent-sdk` spawns a `claude` subprocess. The `claude` binary must be available in `PATH`.
   - What's unclear: Whether `claude` CLI is installed in Vercel's Lambda runtime environment.
   - Recommendation: Start with local/dev testing. For production, either: (a) bundle `claude` as a layer, or (b) use the raw `@anthropic-ai/sdk` Messages API instead for the initial implementation and switch to the Agent SDK once deployment is confirmed. This is the **critical open question** for Phase 118.

3. **Which Linear issues should trigger the runner?**
   - What we know: Filter on `state.type === 'started'`
   - What's unclear: Should ALL "In Progress" issues trigger automation, or only issues with a specific label (e.g., `autonomous`) or assigned to a specific user (a bot user)?
   - Recommendation: Add label filter — only trigger when issue has label `autonomous` or is assigned to a designated "Claude" Linear user. This prevents accidental automation of human-assigned issues.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `@anthropic-ai/claude-agent-sdk` npm package + GitHub `anthropics/claude-agent-sdk-typescript` — full API, `query()` signature, message types
- Linear webhook docs (`linear.app/developers/webhooks`) — payload schema, signature verification, event types
- `@linear/sdk` npm v77.0.0 + Linear SDK docs (`linear.app/developers/sdk`) — `LinearClient` API, `createComment`, `updateIssue`
- Linear rate limiting docs (`linear.app/developers/rate-limiting`) — 5,000 req/hour for API key

### Secondary (MEDIUM confidence)
- `PeteGoo/claude-code-linear-action` — working Linear → GitHub Actions → Claude Code pattern (production-tested community project)
- Gauravsarma1992 Medium: "Building Gigaboy" — Node.js orchestrator pattern using Agent SDK

### Tertiary (LOW confidence — validate during implementation)
- Vercel + BullMQ worker deployment — need to confirm whether `claude` binary is available in Vercel Lambda runtime
- Agent SDK `forkSession()` API — referenced in docs but not verified against installed package version
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: `@anthropic-ai/claude-agent-sdk` (programmatic Claude Code)
- Ecosystem: `@linear/sdk`, BullMQ (existing), `crypto` (built-in)
- Patterns: Webhook receiver, BullMQ worker, async generator execution, HMAC verification
- Pitfalls: Webhook timeouts, missing API key, runaway loops, state ID hardcoding

**Confidence breakdown:**
- Standard stack: HIGH — both packages are first-party with official docs
- Architecture: HIGH — based on official patterns + production community implementations
- Pitfalls: HIGH — each pitfall has a concrete cause and prevention
- Vercel deployment: LOW — whether `claude` binary is available in Lambda is unverified

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (30 days — Agent SDK is actively maintained, check for v0.3.x)
</metadata>

---

*Phase: 118-headless-task-runner*
*Research completed: 2026-03-16*
*Ready for planning: yes — with caveat on Vercel + claude binary deployment (see Open Questions #2)*
