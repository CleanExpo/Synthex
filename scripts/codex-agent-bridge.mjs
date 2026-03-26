#!/usr/bin/env node
/**
 * codex-agent-bridge.mjs
 *
 * On-demand installer for VoltAgent/awesome-codex-subagents agents.
 * Fetches TOML from GitHub, converts to Claude Code Markdown format,
 * and caches to .claude/agents/codex/.
 *
 * Usage:
 *   node scripts/codex-agent-bridge.mjs install <name>
 *   node scripts/codex-agent-bridge.mjs list [--category <cat>]
 *   node scripts/codex-agent-bridge.mjs installed
 *   node scripts/codex-agent-bridge.mjs remove <name>
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, '.claude', 'agents', 'codex');
const CATALOGUE_PATH = join(CACHE_DIR, 'CATALOGUE.md');
const RAW_BASE =
  'https://raw.githubusercontent.com/VoltAgent/awesome-codex-subagents/main';

// Model mapping: Codex model → Claude model
const MODEL_MAP = {
  'gpt-5.4': 'sonnet',
  'gpt-5.3-codex-spark': 'haiku',
};

// Tools by sandbox mode
const TOOLS_READONLY = [
  'Read',
  'Glob',
  'Grep',
  'Bash',
  'WebFetch',
  'WebSearch',
];
const TOOLS_READWRITE = [
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
];

// ---------------------------------------------------------------------------
// Load catalogue index from CATALOGUE.md embedded JSON block
// ---------------------------------------------------------------------------
function loadCatalogue() {
  if (!existsSync(CATALOGUE_PATH)) {
    console.error('ERROR: CATALOGUE.md not found at', CATALOGUE_PATH);
    console.error('Re-run: git pull to restore it.');
    process.exit(1);
  }
  const content = readFileSync(CATALOGUE_PATH, 'utf8');
  const match = content.match(/```json\n([\s\S]+?)\n```/);
  if (!match) {
    console.error('ERROR: No JSON index block found in CATALOGUE.md');
    process.exit(1);
  }
  return JSON.parse(match[1]);
}

// ---------------------------------------------------------------------------
// Parse TOML agent file (minimal parser — only fields we need)
// ---------------------------------------------------------------------------
function parseToml(toml) {
  const result = {};
  // Top-level key = "value" pairs
  const scalar = toml.matchAll(/^(\w+)\s*=\s*"([^"]*)"$/gm);
  for (const [, key, val] of scalar) result[key] = val;
  // developer_instructions = """ ... """ (actual field name in the repo)
  const instrMatch = toml.match(
    /developer_instructions\s*=\s*"""\n([\s\S]+?)\n"""/
  );
  if (instrMatch) result.instructions = instrMatch[1];
  // fallback: [instructions] text = """ ... """
  if (!result.instructions) {
    const altMatch = toml.match(
      /\[instructions\]\s*\ntext\s*=\s*"""\n([\s\S]+?)\n"""/
    );
    if (altMatch) result.instructions = altMatch[1];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Convert parsed TOML → Claude Code Markdown
// ---------------------------------------------------------------------------
function toClaudeMarkdown(toml, sourcePath) {
  const model = MODEL_MAP[toml.model] || 'sonnet';
  const tools =
    toml.sandbox_mode === 'read-only' ? TOOLS_READONLY : TOOLS_READWRITE;
  const name =
    'codex-' + (toml.name || sourcePath.split('/').pop().replace('.toml', ''));

  const frontmatter = [
    '---',
    `name: ${name}`,
    `description: >`,
    `  ${(toml.description || '').replace(/\n/g, '\n  ')}`,
    `model: ${model}`,
    `tools: [${tools.join(', ')}]`,
    `source: codex/awesome-codex-subagents/${sourcePath}`,
    '---',
  ].join('\n');

  const body = [
    `# ${name}`,
    '',
    `> Ported from [VoltAgent/awesome-codex-subagents](https://github.com/VoltAgent/awesome-codex-subagents/blob/main/${sourcePath})`,
    '',
    toml.instructions || '_No instructions found in source TOML._',
  ].join('\n');

  return frontmatter + '\n\n' + body + '\n';
}

// ---------------------------------------------------------------------------
// Install command
// ---------------------------------------------------------------------------
async function install(name) {
  const cachePath = join(CACHE_DIR, name + '.md');

  // Cache hit
  if (existsSync(cachePath)) {
    console.log(`✓ ${name} already installed (${cachePath})`);
    return;
  }

  const catalogue = loadCatalogue();
  const entry = catalogue[name];
  if (!entry) {
    console.error(`ERROR: "${name}" not found in catalogue.`);
    console.error(
      'Run: node scripts/codex-agent-bridge.mjs list  to see available agents'
    );
    process.exit(1);
  }

  const url = `${RAW_BASE}/${entry.path}`;
  console.log(`Fetching ${url} ...`);

  let tomlText;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    tomlText = await res.text();
  } catch (err) {
    console.error(`ERROR: Failed to fetch agent — ${err.message}`);
    process.exit(1);
  }

  const parsed = parseToml(tomlText);
  parsed.name = name;
  parsed.description = parsed.description || entry.description || '';
  parsed.model = parsed.model || entry.model;
  parsed.sandbox_mode = parsed.sandbox_mode || entry.sandbox;

  const markdown = toClaudeMarkdown(parsed, entry.path);
  writeFileSync(cachePath, markdown, 'utf8');
  console.log(`✓ Installed: ${cachePath}`);
  console.log(
    `  Model: ${MODEL_MAP[parsed.model] || 'sonnet'} | Permissions: ${parsed.sandbox_mode}`
  );
}

// ---------------------------------------------------------------------------
// List command
// ---------------------------------------------------------------------------
function list(filterCategory) {
  const catalogue = loadCatalogue();
  const categoryLabels = {
    '01-core-development': 'Core Development',
    '02-language-specialists': 'Language Specialists',
    '03-infrastructure': 'Infrastructure',
    '04-quality-security': 'Quality & Security',
    '05-data-ai': 'Data & AI',
    '06-developer-experience': 'Developer Experience',
    '07-specialized-domains': 'Specialized Domains',
    '08-business-product': 'Business & Product',
    '09-meta-orchestration': 'Meta-Orchestration',
    '10-research-analysis': 'Research & Analysis',
  };

  const byCategory = {};
  for (const [name, entry] of Object.entries(catalogue)) {
    const cat = entry.path.split('/')[1];
    if (filterCategory && !cat.includes(filterCategory)) continue;
    (byCategory[cat] = byCategory[cat] || []).push({ name, ...entry });
  }

  for (const [cat, agents] of Object.entries(byCategory).sort()) {
    console.log(`\n${categoryLabels[cat] || cat} (${agents.length})`);
    console.log('─'.repeat(50));
    for (const a of agents) {
      const cached = existsSync(join(CACHE_DIR, a.name + '.md')) ? '✓' : ' ';
      const model = MODEL_MAP[a.model] || 'sonnet';
      console.log(`  ${cached} ${a.name.padEnd(35)} [${model}]`);
    }
  }
  console.log(
    '\n✓ = already installed  |  install with: node scripts/codex-agent-bridge.mjs install <name>'
  );
}

// ---------------------------------------------------------------------------
// Installed command
// ---------------------------------------------------------------------------
function installed() {
  const files = readdirSync(CACHE_DIR).filter(
    f => f.endsWith('.md') && f !== 'CATALOGUE.md'
  );
  if (files.length === 0) {
    console.log('No Codex agents installed yet.');
    console.log(
      'Run: node scripts/codex-agent-bridge.mjs list  to browse available agents'
    );
    return;
  }
  console.log(`\nInstalled Codex agents (${files.length}):`);
  files.sort().forEach(f => console.log('  ' + f.replace('.md', '')));
  console.log(`\nCached at: ${CACHE_DIR}`);
}

// ---------------------------------------------------------------------------
// Remove command
// ---------------------------------------------------------------------------
function remove(name) {
  const cachePath = join(CACHE_DIR, name + '.md');
  if (!existsSync(cachePath)) {
    console.log(`${name} is not installed — nothing to remove.`);
    return;
  }
  unlinkSync(cachePath);
  console.log(`✓ Removed: ${cachePath}`);
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------
const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case 'install':
    if (!args[0]) {
      console.error('Usage: install <agent-name>');
      process.exit(1);
    }
    await install(args[0]);
    break;
  case 'list': {
    const catIdx = args.indexOf('--category');
    list(catIdx >= 0 ? args[catIdx + 1] : null);
    break;
  }
  case 'installed':
    installed();
    break;
  case 'remove':
    if (!args[0]) {
      console.error('Usage: remove <agent-name>');
      process.exit(1);
    }
    remove(args[0]);
    break;
  default:
    console.log('Codex Agent Bridge\n');
    console.log('Commands:');
    console.log(
      '  install <name>              Install an agent from the Codex catalogue'
    );
    console.log('  list [--category <cat>]     Browse available agents');
    console.log('  installed                   Show cached agents');
    console.log('  remove <name>               Remove a cached agent');
    console.log('\nExamples:');
    console.log(
      '  node scripts/codex-agent-bridge.mjs install security-auditor'
    );
    console.log(
      '  node scripts/codex-agent-bridge.mjs list --category quality'
    );
    console.log('  node scripts/codex-agent-bridge.mjs installed');
}
