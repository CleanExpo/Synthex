import assert from 'node:assert/strict';
import test from 'node:test';

import { tagCwd, tagEvent } from '../src/relay.mjs';

const BACKSLASH = String.fromCharCode(92);
const winPath = `D:${BACKSLASH}Synthex${BACKSLASH}apps${BACKSLASH}web`;

test('tagCwd appends the machine to a POSIX leaf and keeps the separators', () => {
  assert.equal(
    tagCwd('/Users/phill-mac/proj', 'unite-mac-mini'),
    '/Users/phill-mac/proj@unite-mac-mini'
  );
});

test('tagCwd keeps Windows backslashes intact', () => {
  assert.equal(
    tagCwd(winPath, 'phill-desktop'),
    `D:${BACKSLASH}Synthex${BACKSLASH}apps${BACKSLASH}web@phill-desktop`
  );
});

test('tagCwd tolerates a trailing separator', () => {
  assert.equal(
    tagCwd('/Users/phill-mac/proj/', 'mac'),
    '/Users/phill-mac/proj@mac'
  );
});

test('tagCwd falls back to the machine name for a rootless or empty cwd', () => {
  assert.equal(tagCwd('/', 'mac'), 'mac');
  assert.equal(tagCwd('', 'mac'), 'mac');
  assert.equal(tagCwd(undefined, 'mac'), 'mac');
});

test('tagCwd handles a bare relative folder', () => {
  assert.equal(tagCwd('proj', 'mac'), 'proj@mac');
});

test('tagEvent drops transcript_path so the hub takes the hooks-only branch', () => {
  const out = tagEvent(
    {
      hook_event_name: 'Stop',
      session_id: 'abc-123',
      transcript_path:
        '/Users/phill-mac/.claude/projects/-Users-phill-mac-proj/abc-123.jsonl',
      cwd: '/Users/phill-mac/proj',
    },
    'unite-mac-mini'
  );
  assert.equal('transcript_path' in out, false);
  assert.equal(out.cwd, '/Users/phill-mac/proj@unite-mac-mini');
  assert.equal(out.session_id, 'abc-123');
  assert.equal(out.hook_event_name, 'Stop');
});

test('tagEvent does not mutate the caller\u2019s event', () => {
  const original = {
    hook_event_name: 'Stop',
    transcript_path: '/x.jsonl',
    cwd: '/a/b',
  };
  tagEvent(original, 'mac');
  assert.equal(original.transcript_path, '/x.jsonl');
  assert.equal(original.cwd, '/a/b');
});

test('tagEvent supplies a cwd when the event has none', () => {
  const out = tagEvent(
    { hook_event_name: 'SessionStart', session_id: 's' },
    'mac'
  );
  assert.equal(out.cwd, 'mac');
});
