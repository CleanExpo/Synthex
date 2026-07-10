#!/usr/bin/env node
/**
 * task-envelope.mjs — node shim over lib/tasks/task-envelope.ts for the shell
 * task runner (SYN-MCP-005 / SYN-1081, bench must_fix 3).
 *
 * .claude/task-runner.sh cannot import TypeScript, so this shim mirrors the
 * TaskEnvelope zod schema and default-application logic from
 * lib/tasks/task-envelope.ts. Schema parity between the two files is pinned by
 * tests/unit/lib/tasks/task-envelope.test.ts (the test executes this shim and
 * validates its output against the TypeScript schema). If you change one,
 * change both.
 *
 * Usage:
 *   node scripts/task-envelope.mjs '<json>'      # input as first argument
 *   echo '<json>' | node scripts/task-envelope.mjs   # or via stdin
 *
 * Input JSON:
 *   { source, issueId, identifier, description?, acceptance?, budget?, traceId? }
 *   When `acceptance` is omitted it is extracted from `description` markdown
 *   checkboxes, exactly like the TypeScript extractAcceptance().
 *
 * Output: the validated TaskEnvelope as canonical JSON on stdout (exit 0),
 * or an error message on stderr (exit 1). Never mutates anything.
 */

import { randomUUID } from 'crypto';
import { z } from 'zod';

// ── Schema mirror of lib/tasks/task-envelope.ts (keep in lockstep) ──────────

const TaskBudgetSchema = z.object({
  maxTurns: z.number().int().positive().max(200),
  maxCostUsd: z.number().positive().max(100),
});

const TaskEnvelopeSchema = z.object({
  source: z.enum(['webhook', 'shell', 'worker', 'cron', 'mcp']),
  issueId: z.string().min(1),
  identifier: z.string().min(1),
  acceptance: z.array(z.string()),
  budget: TaskBudgetSchema,
  traceId: z.string().min(1),
  // SYN-MCP-007b tenant pin — optional, mirrors lib/tasks/task-envelope.ts.
  organizationId: z.string().min(1).optional(),
});

const DEFAULT_TASK_BUDGET = { maxTurns: 50, maxCostUsd: 10 };

/** Mirror of extractAcceptance() in lib/tasks/task-envelope.ts. */
function extractAcceptance(description) {
  if (!description) return [];
  const out = [];
  for (const line of String(description).split('\n')) {
    const m = line.match(/^\s*[-*]\s*\[[ xX]\]\s+(.*\S)\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

async function readInput() {
  if (process.argv[2] !== undefined && process.argv[2] !== '') {
    return process.argv[2];
  }
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const raw = await readInput();

let input;
try {
  input = JSON.parse(raw);
} catch {
  process.stderr.write('[task-envelope] input is not valid JSON\n');
  process.exit(1);
}

const candidate = {
  source: input.source,
  issueId: input.issueId,
  identifier: input.identifier,
  acceptance: Array.isArray(input.acceptance)
    ? input.acceptance
    : extractAcceptance(input.description),
  budget: { ...DEFAULT_TASK_BUDGET, ...(input.budget ?? {}) },
  traceId:
    typeof input.traceId === 'string' && input.traceId.length > 0
      ? input.traceId
      : randomUUID(),
  ...(typeof input.organizationId === 'string' &&
  input.organizationId.length > 0
    ? { organizationId: input.organizationId }
    : {}),
};

const result = TaskEnvelopeSchema.safeParse(candidate);
if (!result.success) {
  process.stderr.write(
    `[task-envelope] invalid envelope: ${JSON.stringify(result.error.issues)}\n`
  );
  process.exit(1);
}

process.stdout.write(`${JSON.stringify(result.data)}\n`);
