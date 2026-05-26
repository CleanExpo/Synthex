'use strict';
/**
 * Cursor preToolUse / beforeShell — always valid JSON on stdout.
 * Drains stdin, validates shell commands, allows or denies.
 * Indy Dev Dan / cursor-hooks-windows contract: stdout = one JSON line only.
 */
const fs = require('fs');

const DANGEROUS = [
  [
    /rm\s+-rf\s+\/(\s|$)/i,
    "BLOCKED: 'rm -rf /' would delete the entire filesystem",
  ],
  [/rm\s+-rf\s+~/i, 'BLOCKED: ' + "'rm -rf ~' would delete the home directory"],
  [/sudo\s+rm\s+-rf/i, 'BLOCKED: sudo rm -rf is extremely dangerous'],
  [
    /DROP\s+DATABASE/i,
    'BLOCKED: DROP DATABASE requires explicit human confirmation',
  ],
];

const WARNINGS = [
  [
    /git\s+push\s+(--force|-f)/i,
    'WARNING: force push requires explicit human confirmation',
  ],
  [/git\s+push\b/i, 'WARNING: git push requires explicit human confirmation'],
  [/rm\s+-rf\s+\S+/i, 'WARNING: rm -rf is destructive'],
];

function writeOut(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function allow(context) {
  writeOut({ permission: 'allow' });
  if (process.env.SYNTHEX_HOOK_LOG === '1' && context) {
    try {
      const logPath = require('path').join(
        process.cwd(),
        '.claude',
        'scratchpad',
        'hook-events.jsonl'
      );
      fs.appendFileSync(
        logPath,
        JSON.stringify({
          ts: new Date().toISOString(),
          permission: 'allow',
          context,
        }) + '\n'
      );
    } catch {
      /* ignore log failures */
    }
  }
  process.exit(0);
}

function deny(msg) {
  writeOut({
    permission: 'deny',
    user_message: msg,
    agent_message: msg,
  });
  process.exit(0);
}

let raw = '';
try {
  if (!process.stdin.isTTY) {
    raw = fs.readFileSync(0, 'utf8');
  }
} catch {
  allow();
}

let data = {};
try {
  data = raw.trim() ? JSON.parse(raw) : {};
} catch {
  allow();
}

const tool = String(data.tool_name || '');
const command = String((data.tool_input && data.tool_input.command) || '');
const shellTools = new Set(['Bash', 'Shell', 'PowerShell']);

if (!shellTools.has(tool) || !command) {
  allow();
}

const blocks = [];
const warnings = [];

for (const [re, msg] of DANGEROUS) {
  if (re.test(command)) blocks.push(msg);
}
if (blocks.length) {
  deny(blocks.join(' | '));
}

for (const [re, msg] of WARNINGS) {
  if (re.test(command)) warnings.push(msg);
}

allow(warnings.length ? warnings.join(' | ') : undefined);
