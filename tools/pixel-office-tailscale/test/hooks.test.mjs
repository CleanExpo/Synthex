import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { hooksInstalled, installHooks, uninstallHooks } from '../src/hooks.mjs';
import { CLAUDE_HOOK_EVENTS } from '../src/constants.mjs';

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-office-'));
  const settingsPath = path.join(dir, 'settings.json');
  const scriptPath = path.join(dir, 'claude-hook.js');
  fs.writeFileSync(scriptPath, '// stand-in for the real hook script\n');
  return { dir, settingsPath, scriptPath };
}

test('installHooks adds all 12 events to a fresh settings file', () => {
  const { settingsPath, scriptPath } = sandbox();
  const result = installHooks({ settingsPath, scriptPath });
  assert.equal(result.added, CLAUDE_HOOK_EVENTS.length);
  assert.equal(hooksInstalled({ settingsPath, scriptPath }).length, CLAUDE_HOOK_EVENTS.length);
});

test('installHooks is idempotent', () => {
  const { settingsPath, scriptPath } = sandbox();
  installHooks({ settingsPath, scriptPath });
  const second = installHooks({ settingsPath, scriptPath });
  assert.equal(second.added, 0);
  assert.equal(second.alreadyPresent, CLAUDE_HOOK_EVENTS.length);
});

test('installHooks preserves a third-party hook on the same event', () => {
  const { settingsPath, scriptPath } = sandbox();
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({
      permissions: { allow: ['Bash(npm run *)'] },
      hooks: {
        Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'python quality_gate.py' }] }],
      },
    }),
  );
  installHooks({ settingsPath, scriptPath });
  const after = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const stopCommands = after.hooks.Stop.flatMap((e) => e.hooks.map((h) => h.command));
  assert.ok(stopCommands.includes('python quality_gate.py'), 'third-party Stop hook survived');
  assert.ok(stopCommands.some((c) => c.includes('claude-hook.js')), 'our hook was added alongside');
  assert.deepEqual(after.permissions, { allow: ['Bash(npm run *)'] }, 'unrelated keys untouched');
});

test('installHooks writes a one-time backup and never overwrites it', () => {
  const { settingsPath, scriptPath } = sandbox();
  fs.writeFileSync(settingsPath, JSON.stringify({ marker: 'original' }));
  const first = installHooks({ settingsPath, scriptPath });
  assert.ok(first.backup, 'backup created');
  assert.equal(JSON.parse(fs.readFileSync(first.backup, 'utf8')).marker, 'original');
  installHooks({ settingsPath, scriptPath });
  assert.equal(
    JSON.parse(fs.readFileSync(first.backup, 'utf8')).marker,
    'original',
    'backup still holds the pre-modification file',
  );
});

test('installHooks refuses when the hook script is missing', () => {
  const { settingsPath, dir } = sandbox();
  assert.throws(
    () => installHooks({ settingsPath, scriptPath: path.join(dir, 'absent.js') }),
    /hook script missing/,
  );
});

test('installHooks refuses to touch an unparseable settings file', () => {
  const { settingsPath, scriptPath } = sandbox();
  fs.writeFileSync(settingsPath, '{ not json');
  assert.throws(() => installHooks({ settingsPath, scriptPath }), /could not parse/);
  assert.equal(fs.readFileSync(settingsPath, 'utf8'), '{ not json', 'file left untouched');
});

test('uninstallHooks removes only our commands', () => {
  const { settingsPath, scriptPath } = sandbox();
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({
      hooks: { Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'python quality_gate.py' }] }] },
    }),
  );
  installHooks({ settingsPath, scriptPath });
  const result = uninstallHooks({ settingsPath, scriptPath });
  assert.equal(result.removed, CLAUDE_HOOK_EVENTS.length);
  const after = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.deepEqual(
    after.hooks.Stop.flatMap((e) => e.hooks.map((h) => h.command)),
    ['python quality_gate.py'],
  );
  assert.equal(hooksInstalled({ settingsPath, scriptPath }).length, 0);
});
