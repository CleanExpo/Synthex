#!/usr/bin/env node
/**
 * Synthex AI Delegate — SYN-807 Phase 2
 *
 * Routes a task to the cheapest model that can handle it (per the
 * lib/ai/task-routing.ts matrix), runs the inference, and prints just the
 * answer to stdout. Designed for use by Claude in plan mode (and by humans
 * at the shell) to offload routine sub-tasks without burning Claude
 * session context on the actual work.
 *
 * USAGE:
 *   node scripts/ai/delegate.mjs --intent classify-text --input "Is this a bug or feature: X"
 *   node scripts/ai/delegate.mjs --intent summarise-batch --input ./notes.txt
 *   echo "the prompt" | node scripts/ai/delegate.mjs --intent classify-text
 *   node scripts/ai/delegate.mjs --intent draft-blog-post --input ./brief.md --max-tokens 2000
 *
 * EXIT CODES:
 *   0  success — answer printed to stdout
 *   1  routing error (unknown intent, etc.)
 *   2  network / provider error after all fallbacks
 *   3  bad CLI usage
 *
 * INTENT VOCABULARY: see lib/ai/task-routing.ts (TaskIntent union).
 *
 * ENV VARS read:
 *   OLLAMA_BASE_URL  (defaults to http://localhost:11434)
 *   OPENROUTER_API_KEY (required for cloud fallback)
 *
 * This script is intentionally a flat .mjs file (no TypeScript compile
 * step required) so it can run from any worktree without going through
 * `npm run`. The cost: it duplicates the routing matrix in JS form.
 * Keep it in sync with lib/ai/task-routing.ts when intents change.
 */

import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';

// ──────────────────────────────────────────────────────────────────────
// Routing matrix — kept in sync with lib/ai/task-routing.ts.
// Each entry lists the primary model + ordered fallbacks. The script
// tries the primary first; on OllamaUnavailable / network failure it
// walks the fallback chain.
// ──────────────────────────────────────────────────────────────────────

const ROUTING = {
  // Group A — routine local
  'classify-text': {
    primary: { provider: 'ollama', model: 'gemma4:e2b' },
    fallback: [
      { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
      { provider: 'openrouter', model: 'anthropic/claude-sonnet-4-6' },
    ],
  },
  'extract-entities': {
    primary: { provider: 'ollama', model: 'gemma4:e2b' },
    fallback: [{ provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' }],
  },
  'summarise-batch': {
    primary: { provider: 'ollama', model: 'gemma4:e4b' },
    fallback: [{ provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' }],
  },
  'format-conversion': {
    primary: { provider: 'ollama', model: 'gemma4:e2b' },
    fallback: [],
  },
  'linting-suggest': {
    primary: { provider: 'ollama', model: 'gemma4:e4b' },
    fallback: [{ provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' }],
  },
  // Group B — mid-quality cloud
  'boilerplate-generate': {
    primary: { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
    fallback: [{ provider: 'ollama', model: 'gemma4:e4b' }],
  },
  'draft-blog-post': {
    primary: { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
    fallback: [
      { provider: 'openrouter', model: 'anthropic/claude-sonnet-4-6' },
    ],
  },
  'draft-email-sequence': {
    primary: { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
    fallback: [
      { provider: 'openrouter', model: 'anthropic/claude-sonnet-4-6' },
    ],
  },
  'research-synthesis': {
    primary: { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
    fallback: [
      { provider: 'openrouter', model: 'anthropic/claude-sonnet-4-6' },
    ],
  },
  'code-generation': {
    primary: { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
    fallback: [
      { provider: 'openrouter', model: 'anthropic/claude-sonnet-4-6' },
    ],
  },
  // Group C — senior cloud
  'code-review': {
    primary: { provider: 'openrouter', model: 'anthropic/claude-sonnet-4-6' },
    fallback: [{ provider: 'openrouter', model: 'anthropic/claude-opus-4-6' }],
  },
  'brand-voice-enforce': {
    primary: { provider: 'openrouter', model: 'anthropic/claude-sonnet-4-6' },
    fallback: [{ provider: 'openrouter', model: 'anthropic/claude-opus-4-6' }],
  },
  'senior-strategy-draft': {
    primary: { provider: 'openrouter', model: 'anthropic/claude-sonnet-4-6' },
    fallback: [{ provider: 'openrouter', model: 'anthropic/claude-opus-4-6' }],
  },
  // Group E — premium
  'high-stakes-creative': {
    primary: { provider: 'openrouter', model: 'anthropic/claude-opus-4-6' },
    fallback: [],
  },
};

// ── CLI parsing ───────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    intent: null,
    input: null,
    maxTokens: 1024,
    temperature: 0.4,
    system: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--intent') {
      args.intent = next;
      i++;
    } else if (arg === '--input') {
      args.input = next;
      i++;
    } else if (arg === '--max-tokens') {
      args.maxTokens = Number(next);
      i++;
    } else if (arg === '--temperature') {
      args.temperature = Number(next);
      i++;
    } else if (arg === '--system') {
      args.system = next;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.error(`delegate: unknown argument: ${arg}`);
      printUsage();
      process.exit(3);
    }
  }
  return args;
}

function printUsage() {
  process.stderr.write(
    'Usage: node scripts/ai/delegate.mjs --intent <intent> [--input <file-or-string>] [--max-tokens N] [--temperature 0.4] [--system "..."]\n' +
      'Intents: ' +
      Object.keys(ROUTING).join(', ') +
      '\n'
  );
}

async function readStdin() {
  return new Promise(resolve => {
    let data = '';
    if (process.stdin.isTTY) return resolve('');
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

function resolveInput(rawInput) {
  if (rawInput == null) return null;
  if (existsSync(rawInput)) {
    return readFileSync(rawInput, 'utf-8');
  }
  return rawInput;
}

// ── Provider invokers ─────────────────────────────────────────────────

async function callOllama({ model, prompt, system, maxTokens, temperature }) {
  const baseURL = (
    process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
  ).replace(/\/$/, '');
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  const body = {
    model,
    messages,
    stream: false,
    think: false,
    options: { temperature, num_predict: maxTokens },
  };
  const res = await fetch(`${baseURL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.message?.content ?? '';
}

async function callOpenRouter({
  model,
  prompt,
  system,
  maxTokens,
  temperature,
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set — cannot call cloud fallback');
  }
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });
  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer':
        process.env.OPENROUTER_SITE_URL || 'https://synthex.social',
      'X-Title': process.env.OPENROUTER_SITE_NAME || 'SYNTHEX',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter HTTP ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

const PROVIDER_INVOKERS = {
  ollama: callOllama,
  openrouter: callOpenRouter,
};

// ── Routing + retry ───────────────────────────────────────────────────

function isRetryableNetworkError(error) {
  if (!error) return false;
  const msg = String(error.message || error);
  return (
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('fetch failed') ||
    msg.includes('aborted') ||
    msg.includes('Ollama HTTP 5')
  );
}

async function runWithFallback(intent, prompt, system, maxTokens, temperature) {
  const route = ROUTING[intent];
  if (!route) {
    throw new Error(`Unknown intent: ${intent}. Run --help for the list.`);
  }
  const chain = [route.primary, ...route.fallback];
  let lastError = null;
  for (const step of chain) {
    const invoker = PROVIDER_INVOKERS[step.provider];
    if (!invoker) {
      lastError = new Error(`No invoker for provider: ${step.provider}`);
      continue;
    }
    try {
      process.stderr.write(
        `[delegate] trying ${step.provider}/${step.model}\n`
      );
      const text = await invoker({
        model: step.model,
        prompt,
        system,
        maxTokens,
        temperature,
      });
      return { text, used: step };
    } catch (error) {
      lastError = error;
      if (!isRetryableNetworkError(error) && step !== route.primary) {
        // Non-retryable cloud error: abort the chain.
        throw error;
      }
      process.stderr.write(
        `[delegate] ${step.provider}/${step.model} failed (${error.message}); trying next fallback\n`
      );
    }
  }
  throw new Error(
    `All fallbacks exhausted for intent ${intent}. Last error: ${lastError?.message ?? 'unknown'}`
  );
}

// ── main ──────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  if (!args.intent) {
    console.error('delegate: --intent is required');
    printUsage();
    process.exit(3);
  }
  if (!ROUTING[args.intent]) {
    console.error(`delegate: unknown intent "${args.intent}"`);
    printUsage();
    process.exit(1);
  }
  let prompt = resolveInput(args.input);
  if (!prompt) {
    prompt = await readStdin();
  }
  if (!prompt || !prompt.trim()) {
    console.error(
      'delegate: no input provided (use --input or pipe via stdin)'
    );
    process.exit(3);
  }

  try {
    const { text, used } = await runWithFallback(
      args.intent,
      prompt,
      args.system,
      args.maxTokens,
      args.temperature
    );
    process.stderr.write(`[delegate] used ${used.provider}/${used.model}\n`);
    process.stdout.write(text);
    if (!text.endsWith('\n')) process.stdout.write('\n');
    process.exit(0);
  } catch (error) {
    console.error(`delegate: ${error.message}`);
    process.exit(2);
  }
}

main();
