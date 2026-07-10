/**
 * Unit tests for scripts/nexus-viral-run.ts (runNexusViral driver).
 *
 * Fully mocked — every effect is injected via NexusViralRunDeps, so there is NO
 * network, NO fal/MCP spend, NO real prisma or provider call. The heavy real
 * module graph (gates / providers / studio-tools) is jest.mock'd to light stubs
 * so importing the driver never drags in prisma or the MCP layer.
 *
 * Proves the load-bearing safety invariants:
 *   - happy path threads brief → gateA → copy → generate → poll → gateB → cuts
 *   - Gate A FAIL aborts BEFORE generate_video is ever called (no spend)
 *   - Gate A fail-closed assertGatePassed aborts before generate (no spend)
 *   - Gate B FAIL aborts BEFORE derive_cuts is ever called
 *   - default (no --live) is a dry-run: generate_video is never called
 *   - no publish primitive is ever invoked
 */

// Keep the driver's import graph light + effect-free.
jest.mock('@/lib/ai/providers', () => ({ getAIProvider: jest.fn() }));
jest.mock('@/lib/video/gates', () => ({
  runBriefGrill: jest.fn(),
  runBroadcastGrill: jest.fn(),
}));
jest.mock('@/lib/video/gates/assert-gate-passed', () => ({
  assertGatePassed: jest.fn(),
}));
jest.mock('@/lib/services/ai/studio-tools', () => ({
  executeStudioTool: jest.fn(),
}));

import {
  runNexusViral,
  type NexusViralRunDeps,
  type NexusViralRunOptions,
} from '../../scripts/nexus-viral-run';
import type { RunGateResult } from '@/lib/video/gates/types';

const RUBRIC_VERSION = 'test-rubric-1';

function gateResult(pass: boolean, failures: string[] = []): RunGateResult {
  return {
    pass,
    verdict: {
      pass,
      score: pass ? 90 : 10,
      failures,
      warnings: [],
      rubric_version: RUBRIC_VERSION,
    },
    verdictId: pass ? 'verdict-1' : 'verdict-2',
    persistenceSkipped: false,
  };
}

/** Build fully-mocked deps; a call log records every studio tool invocation. */
function makeDeps(overrides: Partial<NexusViralRunDeps> = {}): {
  deps: NexusViralRunDeps;
  toolCalls: string[];
} {
  const toolCalls: string[] = [];
  const executeStudioTool = jest
    .fn()
    .mockImplementation(async (name: string) => {
      toolCalls.push(name);
      if (name === 'generate_video')
        return { jobs: [{ id: 'hero-1' }], budgetWarning: false };
      if (name === 'get_job')
        return { job: { id: 'hero-1', status: 'rendered', videoUrl: 'u' } };
      if (name === 'derive_cuts') {
        return {
          heroAssetId: 'hero-1',
          cuts: [
            {
              platform: 'youtube',
              assetId: 'cut-yt',
              publishState: 'queued_human_gated',
            },
            {
              platform: 'instagram',
              assetId: 'cut-ig',
              publishState: 'queued_human_gated',
            },
          ],
        };
      }
      return {};
    });

  const deps: NexusViralRunDeps = {
    loadBrief: jest.fn().mockResolvedValue({
      organizationId: 'org-1',
      topic: 'how to dry a flooded carpet',
      angle: 'hook-first',
      facts: [],
    }),
    generateCopy: jest.fn().mockResolvedValue({
      hook: 'Your carpet is not the problem — the pad underneath is',
      videoPrompt:
        'a technician lifting sodden carpet pad, dramatic light, 9:16',
      captions: [
        { platform: 'youtube', caption: 'YT caption' },
        { platform: 'instagram', caption: 'IG caption' },
      ],
    }),
    runBriefGrill: jest.fn().mockResolvedValue(gateResult(true)),
    runBroadcastGrill: jest.fn().mockResolvedValue(gateResult(true)),
    assertGatePassed: jest.fn().mockResolvedValue(undefined),
    executeStudioTool,
    sleep: jest.fn().mockResolvedValue(undefined),
    log: jest.fn(),
    ...overrides,
  };
  return { deps, toolCalls };
}

const BASE_OPTIONS: NexusViralRunOptions = {
  organizationId: 'org-1',
  userId: 'user-1',
  topic: 'how to dry a flooded carpet',
  live: true,
  confirmSpend: true,
};

describe('runNexusViral', () => {
  it('happy path threads every stage over mocks and ends with derived cuts', async () => {
    const { deps, toolCalls } = makeDeps();

    const report = await runNexusViral(BASE_OPTIONS, deps);

    expect(report.ok).toBe(true);
    expect(report.terminatedAt).toBeNull();
    expect(report.gateA?.pass).toBe(true);
    expect(report.gateB?.pass).toBe(true);
    expect(report.jobIds).toEqual(['hero-1']);
    expect(report.heroAssetId).toBe('hero-1');
    expect(report.cuts).toHaveLength(2);
    expect(
      report.cuts.every(c => c.publishState === 'queued_human_gated')
    ).toBe(true);

    // All three studio tools were threaded, in order, exactly once each.
    expect(toolCalls).toEqual(['generate_video', 'get_job', 'derive_cuts']);
    // Stage ordering recorded.
    expect(report.stages.map(s => s.stage)).toEqual([
      'brief',
      'gateA',
      'copy',
      'generate',
      'poll',
      'gateB',
      'derive_cuts',
    ]);
  });

  it('Gate A FAIL aborts BEFORE generate_video is called (no spend)', async () => {
    const { deps, toolCalls } = makeDeps({
      runBriefGrill: jest
        .fn()
        .mockResolvedValue(
          gateResult(false, ['hook is generic scene-setting'])
        ),
    });

    const report = await runNexusViral(BASE_OPTIONS, deps);

    expect(report.ok).toBe(false);
    expect(report.terminatedAt).toBe('gateA');
    expect(report.reason).toBe('brief_grill_failed');
    // The load-bearing assertion: no generate spend, no downstream tool at all.
    expect(toolCalls).not.toContain('generate_video');
    expect(toolCalls).toHaveLength(0);
    expect(deps.executeStudioTool).not.toHaveBeenCalled();
    // Copy stage is never reached either.
    expect(deps.generateCopy).not.toHaveBeenCalled();
    // Gate B is never evaluated.
    expect(deps.runBroadcastGrill).not.toHaveBeenCalled();
  });

  it('Gate A fail-closed enforcement (assertGatePassed throws) aborts before generate', async () => {
    const { deps, toolCalls } = makeDeps({
      assertGatePassed: jest
        .fn()
        .mockRejectedValue(new Error('no_qa_report_found')),
    });

    const report = await runNexusViral(BASE_OPTIONS, deps);

    expect(report.ok).toBe(false);
    expect(report.terminatedAt).toBe('gateA');
    expect(report.reason).toBe('brief_gate_not_enforceable');
    expect(toolCalls).not.toContain('generate_video');
    expect(deps.generateCopy).not.toHaveBeenCalled();
  });

  it('Gate B FAIL aborts BEFORE derive_cuts is called', async () => {
    const { deps, toolCalls } = makeDeps({
      runBroadcastGrill: jest
        .fn()
        .mockResolvedValue(gateResult(false, ['no clear payoff in the cut'])),
    });

    const report = await runNexusViral(BASE_OPTIONS, deps);

    expect(report.ok).toBe(false);
    expect(report.terminatedAt).toBe('gateB');
    expect(report.reason).toBe('broadcast_grill_failed');
    // Generate + poll happened, but derive_cuts must NOT.
    expect(toolCalls).toContain('generate_video');
    expect(toolCalls).toContain('get_job');
    expect(toolCalls).not.toContain('derive_cuts');
  });

  it('Gate B fail-closed enforcement aborts before derive_cuts', async () => {
    let call = 0;
    const { deps, toolCalls } = makeDeps({
      // brief gate passes enforcement, broadcast gate throws.
      assertGatePassed: jest
        .fn()
        .mockImplementation(async (_ref: string, gate: string) => {
          call += 1;
          if (gate === 'broadcast') throw new Error('no_qa_report_found');
        }),
    });

    const report = await runNexusViral(BASE_OPTIONS, deps);

    expect(report.ok).toBe(false);
    expect(report.terminatedAt).toBe('gateB');
    expect(report.reason).toBe('broadcast_gate_not_enforceable');
    expect(toolCalls).not.toContain('derive_cuts');
    expect(call).toBe(2);
  });

  it('default (no --live) is a dry-run — generate_video is never called, run is a clean stop', async () => {
    const { deps, toolCalls } = makeDeps();

    const report = await runNexusViral(
      { ...BASE_OPTIONS, live: false, confirmSpend: false },
      deps
    );

    expect(report.ok).toBe(true); // clean composition, not a failure
    expect(report.terminatedAt).toBe('generate');
    expect(report.spendConfirmed).toBe(false);
    expect(toolCalls).toHaveLength(0);
    expect(deps.executeStudioTool).not.toHaveBeenCalled();
    // Gates + copy still ran up to the spend boundary.
    expect(deps.runBriefGrill).toHaveBeenCalledTimes(1);
    expect(deps.generateCopy).toHaveBeenCalledTimes(1);
  });

  it('--live WITHOUT --confirm-spend stops at generate and never spends', async () => {
    const { deps, toolCalls } = makeDeps();

    const report = await runNexusViral(
      { ...BASE_OPTIONS, live: true, confirmSpend: false },
      deps
    );

    expect(report.ok).toBe(true);
    expect(report.terminatedAt).toBe('generate');
    expect(report.stages.find(s => s.stage === 'generate')?.status).toBe(
      'stopped'
    );
    expect(toolCalls).toHaveLength(0);
  });

  it('render failure during poll aborts before Gate B / derive_cuts', async () => {
    const { deps, toolCalls } = makeDeps({
      executeStudioTool: jest.fn().mockImplementation(async (name: string) => {
        if (name === 'generate_video') return { jobs: [{ id: 'hero-1' }] };
        if (name === 'get_job')
          return { job: { id: 'hero-1', status: 'failed' } };
        return {};
      }),
    });

    const report = await runNexusViral(BASE_OPTIONS, deps);

    expect(report.ok).toBe(false);
    expect(report.terminatedAt).toBe('poll');
    expect(report.reason).toBe('render_failed');
    expect(deps.runBroadcastGrill).not.toHaveBeenCalled();
    expect(toolCalls).not.toContain('derive_cuts');
  });
});
