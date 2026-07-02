/**
 * Unit tests — SYN-694 Synthex deploy-verification routine.
 *
 * Covers the pure, testable core:
 *  - evaluateWorktreeGate: refuses to claim green from a dirty / behind-main
 *    tree, and honours the explicit clean-worktree override.
 *  - buildReadinessPacket: verdict precedence (blocked > red > green), output
 *    shape, and the check summary counts.
 *  - renderReadinessMarkdown: compact, deterministic Markdown.
 */

import {
  evaluateWorktreeGate,
  buildReadinessPacket,
  renderReadinessMarkdown,
  decideKeeperAction,
  renderKeeperBody,
  postReadinessToLinear,
  KEEPER_MARKER,
  type ReadinessCheck,
  type GitState,
} from '@/scripts/verify/deploy-readiness';

const FIXED_NOW = new Date('2026-06-24T01:30:00.000Z');

function check(
  name: string,
  status: ReadinessCheck['status'],
  remediation?: string
): ReadinessCheck {
  return { name, status, timestamp: FIXED_NOW.toISOString(), remediation };
}

describe('evaluateWorktreeGate — dirty / behind-main handling', () => {
  it('passes a clean, up-to-date tree', () => {
    const gate = evaluateWorktreeGate({ dirty: false, behindMain: 0 });
    expect(gate.ok).toBe(true);
    expect(gate.state).toBe('clean');
  });

  it('blocks a dirty tree', () => {
    const gate = evaluateWorktreeGate({ dirty: true, behindMain: 0 });
    expect(gate.ok).toBe(false);
    expect(gate.state).toBe('dirty');
    expect(gate.reason).toMatch(/uncommitted/i);
  });

  it('blocks a tree behind origin/main', () => {
    const gate = evaluateWorktreeGate({ dirty: false, behindMain: 12 });
    expect(gate.ok).toBe(false);
    expect(gate.state).toBe('behind');
    expect(gate.reason).toContain('12');
  });

  it('blocks a tree that is both dirty and behind', () => {
    const gate = evaluateWorktreeGate({ dirty: true, behindMain: 3 });
    expect(gate.ok).toBe(false);
    expect(gate.state).toBe('dirty+behind');
  });

  it('honours the explicit clean-worktree override even when dirty/behind', () => {
    const gate = evaluateWorktreeGate({
      dirty: true,
      behindMain: 9,
      cleanWorktree: true,
    });
    expect(gate.ok).toBe(true);
    expect(gate.state).toBe('clean-worktree-override');
  });
});

describe('buildReadinessPacket — verdict + output shape', () => {
  const cleanGit: GitState = { dirty: false, behindMain: 0, branch: 'main' };

  it('is GREEN when the gate is ok and no check fails', () => {
    const packet = buildReadinessPacket({
      checks: [check('type-check', 'pass'), check('lint', 'pass'), check('opt', 'skip')],
      git: cleanGit,
      now: FIXED_NOW,
    });
    expect(packet.verdict).toBe('green');
    expect(packet.generatedAt).toBe('2026-06-24T01:30:00.000Z');
    expect(packet.summary).toEqual({ total: 3, pass: 2, fail: 0, skip: 1, unknown: 0 });
  });

  it('is RED when the gate is ok but a check fails', () => {
    const packet = buildReadinessPacket({
      checks: [
        check('type-check', 'pass'),
        check('lint', 'fail', 'Run `npm run lint` and fix the issues.'),
      ],
      git: cleanGit,
      now: FIXED_NOW,
    });
    expect(packet.verdict).toBe('red');
    expect(packet.summary.fail).toBe(1);
  });

  it('is BLOCKED when the worktree gate fails, regardless of check results', () => {
    const packet = buildReadinessPacket({
      // Every check passes, but the dirty tree must override to blocked —
      // it must NOT be reported green from an untrustworthy tree.
      checks: [check('type-check', 'pass'), check('lint', 'pass')],
      git: { dirty: true, behindMain: 0, branch: 'feature/x' },
      now: FIXED_NOW,
    });
    expect(packet.verdict).toBe('blocked');
    expect(packet.gate.ok).toBe(false);
  });

  it('emits a structured result per check: name, status, timestamp, remediation', () => {
    const packet = buildReadinessPacket({
      checks: [check('lint', 'fail', 'fix lint')],
      git: cleanGit,
      now: FIXED_NOW,
    });
    const [c] = packet.checks;
    expect(c.name).toBe('lint');
    expect(c.status).toBe('fail');
    expect(c.timestamp).toBe('2026-06-24T01:30:00.000Z');
    expect(c.remediation).toBe('fix lint');
  });
});

describe('renderReadinessMarkdown', () => {
  it('renders a compact, deterministic packet with verdict + a row per check', () => {
    const packet = buildReadinessPacket({
      checks: [
        check('type-check', 'pass'),
        check('lint', 'fail', 'Run `npm run lint` and fix the issues.'),
      ],
      git: { dirty: false, behindMain: 0, branch: 'main' },
      now: FIXED_NOW,
    });
    const md = renderReadinessMarkdown(packet);

    expect(md).toContain('RED');
    expect(md).toContain('`main`');
    expect(md).toContain('| type-check |');
    expect(md).toContain('| lint |');
    expect(md).toContain('Run `npm run lint` and fix the issues.');
    expect(md).toContain('1/2 pass');
  });
});

describe('Linear keeper (SYN-694 follow-up) — idempotent, never duplicates, never fabricates', () => {
  const packet = buildReadinessPacket({
    checks: [check('type-check', 'pass')],
    git: { dirty: false, behindMain: 0, branch: 'main' },
    now: FIXED_NOW,
  });

  describe('decideKeeperAction', () => {
    it('skips when there is no API key (never fabricates a post)', () => {
      const d = decideKeeperAction({ apiKey: null });
      expect(d.action).toBe('skip');
    });

    it('updates the existing keeper when one is found (no duplicate)', () => {
      const d = decideKeeperAction({ apiKey: 'lin_key', existingKeeperId: 'comment-1' });
      expect(d.action).toBe('update');
    });

    it('creates the keeper once when none exists', () => {
      const d = decideKeeperAction({ apiKey: 'lin_key', existingKeeperId: null });
      expect(d.action).toBe('create');
    });
  });

  it('renderKeeperBody carries the marker so the next run can find + update it', () => {
    const body = renderKeeperBody(packet);
    expect(body).toContain(KEEPER_MARKER);
    expect(body).toContain('GREEN');
  });

  describe('postReadinessToLinear (dependency-injected — no network)', () => {
    it('no-ops without throwing when unauthenticated', async () => {
      const findKeeper = jest.fn();
      const createKeeper = jest.fn();
      const updateKeeper = jest.fn();

      const res = await postReadinessToLinear(packet, {
        apiKey: undefined,
        findKeeper,
        createKeeper,
        updateKeeper,
      });

      expect(res.posted).toBe(false);
      expect(res.action).toBe('skip');
      // Never even looks for or writes a keeper without a key.
      expect(findKeeper).not.toHaveBeenCalled();
      expect(createKeeper).not.toHaveBeenCalled();
      expect(updateKeeper).not.toHaveBeenCalled();
    });

    it('updates (not creates) when a keeper already exists — no duplicate', async () => {
      const createKeeper = jest.fn().mockResolvedValue(undefined);
      const updateKeeper = jest.fn().mockResolvedValue(undefined);

      const res = await postReadinessToLinear(packet, {
        apiKey: 'lin_key',
        findKeeper: jest.fn().mockResolvedValue('comment-99'),
        createKeeper,
        updateKeeper,
      });

      expect(res.posted).toBe(true);
      expect(res.action).toBe('update');
      expect(updateKeeper).toHaveBeenCalledTimes(1);
      expect(updateKeeper).toHaveBeenCalledWith('comment-99', expect.stringContaining(KEEPER_MARKER));
      expect(createKeeper).not.toHaveBeenCalled();
    });

    it('creates the keeper once when none exists yet', async () => {
      const createKeeper = jest.fn().mockResolvedValue(undefined);
      const updateKeeper = jest.fn().mockResolvedValue(undefined);

      const res = await postReadinessToLinear(packet, {
        apiKey: 'lin_key',
        findKeeper: jest.fn().mockResolvedValue(null),
        createKeeper,
        updateKeeper,
      });

      expect(res.posted).toBe(true);
      expect(res.action).toBe('create');
      expect(createKeeper).toHaveBeenCalledTimes(1);
      expect(createKeeper).toHaveBeenCalledWith(expect.stringContaining(KEEPER_MARKER));
      expect(updateKeeper).not.toHaveBeenCalled();
    });
  });
});
