#!/usr/bin/env node
/**
 * tools/claude-hooks/permission-denied.mjs — H11 PermissionDenied: append one JSON line per auto-mode
 * denial to the fleet ledger (policy "ledger", release-receipts/ledger/fleet.jsonl) in the project
 * working tree, the same file and row shape as scripts/fleet/lib.mjs ledgerAppend(). The hook
 * writes the row, never a builder; the orchestrator ships rows with scripts/fleet/ledger-push.mjs.
 * Secret patterns in the tool input are redacted. Never returns retry; exit 0 on success.
 *
 * The event fires only in auto mode (hooks reference, "PermissionDenied"): PreToolUse hook denials
 * and deny rules do not reach it.
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot, readInput, redact } from './lib.mjs';

export function ledgerFile(root) {
  let ledger = 'release-receipts/ledger/fleet.jsonl';
  try {
    ledger =
      JSON.parse(
        readFileSync(path.join(root, 'scripts/fleet/policy.json'), 'utf8')
      ).ledger || ledger;
  } catch {
    // policy unreadable: keep the default ledger path
  }
  return path.join(root, ledger);
}

export function denialRow(input, env = process.env) {
  const ti = input.tool_input || {};
  return {
    ts: new Date().toISOString(),
    kind: 'permission-denied',
    role: env.SYNTHEX_FLEET_ROLE || 'builder',
    session_id: input.session_id || null,
    tool: input.tool_name || null,
    reason: redact(input.reason || ''),
    input: redact(
      ti.command || ti.file_path || ti.url || JSON.stringify(ti)
    ).slice(0, 300),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const input = readInput();
    const f = ledgerFile(projectRoot(input));
    mkdirSync(path.dirname(f), { recursive: true });
    appendFileSync(f, JSON.stringify(denialRow(input)) + '\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write(
      `synthex-hooks permission-denied failed: ${e.message}\n`
    );
    process.exit(1);
  }
}
