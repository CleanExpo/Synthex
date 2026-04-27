#!/usr/bin/env node
/**
 * delegate.mjs — session-preservation shim for routine sub-tasks
 *
 * When Claude (in plan mode or otherwise) needs a routine sub-task done —
 * "summarise these files", "classify this batch", "convert YAML to JSON" —
 * Claude shells out to this script. The script routes the intent through
 * lib/ai/task-routing.ts → local Gemma (if reachable) or DeepSeek V4 Flash.
 * The result returns on stdout; Claude's session context stays clean.
 *
 * Usage:
 *   node scripts/ai/delegate.mjs --intent classify-text --input "the text"
 *   node scripts/ai/delegate.mjs --intent summarise-batch --file ./batch.txt
 *   echo "the text" | node scripts/ai/delegate.mjs --intent classify-text
 *
 * Exit codes:
 *   0 — success, result on stdout
 *   1 — bad arguments
 *   2 — every model in the fallback chain failed
 *   3 — runtime error
 */

import { readFileSync } from 'node:fs';
import { argv, exit, stdin } from 'node:process';

// --- Argument parsing (no deps) ---
function parseArgs(argList) {
  const args = {};
  for (let i = 2; i < argList.length; i++) {
    const a = argList[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argList[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

async function readStdin() {
  return new Promise(resolve => {
    let data = '';
    stdin.setEncoding('utf8');
    stdin.on('data', chunk => (data += chunk));
    stdin.on('end', () => resolve(data));
    if (stdin.isTTY) resolve('');
  });
}

const args = parseArgs(argv);
const intent = args.intent;

if (!intent || args.help) {
  console.error('Usage: node scripts/ai/delegate.mjs --intent <intent> [--input "text" | --file path | stdin]');
  console.error('Intents: classify-text, extract-entities, summarise-batch, format-conversion,');
  console.error('         linting-suggest, boilerplate-generate, draft-blog-post, draft-social-post,');
  console.error('         draft-email-sequence, research-synthesis, code-generation, code-review,');
  console.error('         brand-voice-enforce, senior-strategy-draft, boardroom-decision,');
  console.error('         architecture-decision, high-stakes-creative');
  exit(args.help ? 0 : 1);
}

let input = args.input;
if (!input && args.file) {
  input = readFileSync(args.file, 'utf8');
}
if (!input) {
  input = await readStdin();
}

if (!input || !input.trim()) {
  console.error('delegate: no input provided (use --input, --file, or pipe via stdin)');
  exit(1);
}

// --- Dynamic import of TS modules via tsx loader (or compiled JS in prod) ---
async function loadAI() {
  // Prefer compiled output; fall back to tsx for dev
  try {
    return {
      routeIntent: (await import('../../lib/ai/task-routing.js')).routeIntent,
      getAIProvider: (await import('../../lib/ai/providers/index.js')).getAIProvider,
      OllamaUnavailableError: (await import('../../lib/ai/providers/index.js')).OllamaUnavailableError,
    };
  } catch {
    // Try tsx loader for source files
    try {
      await import('tsx/esm');
      return {
        routeIntent: (await import('../../lib/ai/task-routing.ts')).routeIntent,
        getAIProvider: (await import('../../lib/ai/providers/index.ts')).getAIProvider,
        OllamaUnavailableError: (await import('../../lib/ai/providers/index.ts')).OllamaUnavailableError,
      };
    } catch (err) {
      console.error('delegate: cannot load lib/ai/* — install tsx (npm i -D tsx) or run after build:', err.message);
      exit(3);
    }
  }
}

const { routeIntent, getAIProvider, OllamaUnavailableError } = await loadAI();

let choice;
try {
  choice = routeIntent(intent);
} catch (err) {
  console.error(`delegate: ${err.message}`);
  exit(1);
}

const chain = [choice, ...choice.fallback];
let lastError = null;

// Force provider selection via AI_PROVIDER env (factory caches per-name).
// Empty apiKey would fall through to env-var path, ignoring our ModelChoice.
function resolveProvider(providerId) {
  const previous = process.env.AI_PROVIDER;
  process.env.AI_PROVIDER = providerId;
  try {
    return getAIProvider();
  } finally {
    if (previous === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previous;
  }
}

for (const member of chain) {
  try {
    const provider = resolveProvider(member.provider);
    const res = await provider.complete({
      model: member.modelId,
      messages: [{ role: 'user', content: input }],
      max_tokens: Number(args.maxTokens) || 1024,
      temperature: Number(args.temperature) || 0.2,
    });
    const out = res.choices?.[0]?.message?.content ?? '';
    process.stdout.write(out);
    if (!out.endsWith('\n')) process.stdout.write('\n');
    exit(0);
  } catch (err) {
    lastError = err;
    if (err instanceof OllamaUnavailableError) {
      // expected fallthrough
      continue;
    }
    // For other errors keep falling through too — the chain exists for resilience
    continue;
  }
}

console.error(`delegate: every model in the fallback chain failed. Last error: ${lastError?.message}`);
exit(2);
