/**
 * WS2 / SYN-1075 — weekly video-model drift canary.
 *
 * Fully mocked: prisma, quota module, and the fal provider adapter. No
 * network calls, no real spend — this suite proves the canary's control
 * flow (org resolution, spend cap, registry-driven model choice, poll loop,
 * dead-model-id detection, Sentry alerting) without ever touching a real
 * provider or database.
 */
/** @jest-environment node */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockCaptureServerException = jest.fn();
jest.mock('@/lib/observability/sentry-server', () => ({
  captureServerException: (...args: unknown[]) =>
    mockCaptureServerException(...args),
}));

const mockPrisma = {
  organization: { findFirst: jest.fn() },
  teamMember: { findFirst: jest.fn() },
  videoGeneration: { create: jest.fn(), update: jest.fn() },
};
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

const mockHoldQuota = jest.fn();
const mockReleaseQuota = jest.fn();
const mockSettleQuota = jest.fn();
jest.mock('@/lib/services/ai/video/quota', () => ({
  holdQuota: (...args: unknown[]) => mockHoldQuota(...args),
  releaseQuota: (...args: unknown[]) => mockReleaseQuota(...args),
  settleQuota: (...args: unknown[]) => mockSettleQuota(...args),
}));

const mockSubmitToFal = jest.fn();
const mockGetFalStatus = jest.fn();
const mockGetFalResult = jest.fn();
jest.mock('@/lib/services/ai/video/fal-adapter', () => ({
  submitToFal: (...args: unknown[]) => mockSubmitToFal(...args),
  getFalStatus: (...args: unknown[]) => mockGetFalStatus(...args),
  getFalResult: (...args: unknown[]) => mockGetFalResult(...args),
}));

import { runVideoCanary, resolveCanaryOrg } from '@/lib/video/drift-canary';
import { ModelRetiredError } from '@/lib/services/ai/video/types';

const CANARY_ORG = { id: 'canary-org-1' };
const CANARY_USER = { userId: 'canary-user-1' };

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.organization.findFirst.mockResolvedValue(CANARY_ORG);
  mockPrisma.teamMember.findFirst.mockResolvedValue(CANARY_USER);
  mockPrisma.videoGeneration.create.mockResolvedValue({ id: 'vg-1' });
  mockPrisma.videoGeneration.update.mockResolvedValue({ id: 'vg-1' });
  mockHoldQuota.mockResolvedValue(undefined);
  mockReleaseQuota.mockResolvedValue(undefined);
  mockSettleQuota.mockResolvedValue(undefined);
});

describe('resolveCanaryOrg', () => {
  it('queries an isolated top-level org flagged via settings JSON', async () => {
    await resolveCanaryOrg();
    expect(mockPrisma.organization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          parentOrgId: null,
          settings: { path: ['videoCanary'], equals: true },
        }),
      })
    );
  });

  it('returns null (config gap) when no canary org is flagged', async () => {
    mockPrisma.organization.findFirst.mockResolvedValue(null);
    const result = await resolveCanaryOrg();
    expect(result).toBeNull();
    expect(mockPrisma.teamMember.findFirst).not.toHaveBeenCalled();
  });

  it('returns null (config gap) when the flagged org has no team member to submit as', async () => {
    mockPrisma.teamMember.findFirst.mockResolvedValue(null);
    const result = await resolveCanaryOrg();
    expect(result).toBeNull();
  });
});

describe('runVideoCanary — happy path (mocked render)', () => {
  it('resolves the cheapest registry draft model, submits, polls to completion, and marks the row rendered', async () => {
    mockSubmitToFal.mockResolvedValue('req-happy-1');
    mockGetFalStatus.mockResolvedValue('COMPLETED');
    mockGetFalResult.mockResolvedValue({
      videoUrl: 'https://cdn.fal.run/canary.mp4',
    });

    const result = await runVideoCanary({ sleepMs: 0, maxAttempts: 3 });

    expect(result.status).toBe('pass');
    expect(result.videoUrl).toBe('https://cdn.fal.run/canary.mp4');
    expect(result.canaryOrgId).toBe(CANARY_ORG.id);
    // Registry-driven: not hardcoded — must be one of the real draft-tier ids.
    expect(result.modelId).toMatch(/^bytedance\/seedance-2\.0\//);

    expect(mockHoldQuota).toHaveBeenCalledWith(
      CANARY_ORG.id,
      expect.any(Number),
      'studio',
      expect.any(String) // SYN-1115 round-6: the reservation's hold id
    );
    expect(mockPrisma.videoGeneration.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: CANARY_ORG.id,
          userId: CANARY_USER.userId,
          providerJobId: 'req-happy-1',
        }),
      })
    );
    expect(mockPrisma.videoGeneration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'vg-1' },
        data: {
          status: 'rendered',
          videoUrl: 'https://cdn.fal.run/canary.mp4',
        },
      })
    );
    expect(mockSettleQuota).toHaveBeenCalled();
    expect(mockReleaseQuota).not.toHaveBeenCalled();
    expect(mockCaptureServerException).not.toHaveBeenCalled();
  });

  it('polls multiple times until COMPLETED before fetching the result', async () => {
    mockSubmitToFal.mockResolvedValue('req-poll-1');
    mockGetFalStatus
      .mockResolvedValueOnce('IN_QUEUE')
      .mockResolvedValueOnce('IN_PROGRESS')
      .mockResolvedValueOnce('COMPLETED');
    mockGetFalResult.mockResolvedValue({
      videoUrl: 'https://cdn.fal.run/x.mp4',
    });

    const result = await runVideoCanary({ sleepMs: 0, maxAttempts: 5 });

    expect(result.status).toBe('pass');
    expect(mockGetFalStatus).toHaveBeenCalledTimes(3);
  });
});

describe('runVideoCanary — dead model id detection', () => {
  it('surfaces ModelRetiredError from submit as a fail with code model_retired, releases quota, and alerts Sentry', async () => {
    const retired = new ModelRetiredError(
      'bytedance/seedance-2.0/fast/text-to-video',
      404,
      'Path not found'
    );
    mockSubmitToFal.mockRejectedValue(retired);

    const result = await runVideoCanary({ sleepMs: 0, maxAttempts: 1 });

    expect(result.status).toBe('fail');
    expect(result.code).toBe('model_retired');
    expect(mockReleaseQuota).toHaveBeenCalledWith(
      CANARY_ORG.id,
      expect.any(String), // SYN-1115 round-6: the reservation's hold id
      expect.any(Number),
      'studio'
    );
    expect(mockPrisma.videoGeneration.create).not.toHaveBeenCalled();
    expect(mockCaptureServerException).toHaveBeenCalledWith(
      retired,
      expect.objectContaining({
        tags: expect.objectContaining({ code: 'model_retired' }),
      })
    );
  });

  it('surfaces a mid-render ModelRetiredError as a fail, marks the row failed, and KEEPS the spend', async () => {
    mockSubmitToFal.mockResolvedValue('req-dead-1');
    const retired = new ModelRetiredError(
      'bytedance/seedance-2.0/fast/text-to-video',
      404,
      'Path not found'
    );
    mockGetFalStatus.mockRejectedValue(retired);

    const result = await runVideoCanary({ sleepMs: 0, maxAttempts: 1 });

    expect(result.status).toBe('fail');
    expect(result.code).toBe('model_retired');
    expect(mockPrisma.videoGeneration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'vg-1' },
        data: expect.objectContaining({ status: 'failed' }),
      })
    );
    // This used to assert a RELEASE, pinning the defect. Everything after
    // submitToFal returns a request id happens with the job ALREADY ACCEPTED by
    // fal: a dead model id caught on the poll describes our view of the render,
    // not whether the call was billed. Releasing handed the money back, took
    // the hold's terminal key so nothing could correct it, and repeated canary
    // failures restored admission headroom past the canary org's own caps
    // (release review, pass 3).
    expect(mockReleaseQuota).not.toHaveBeenCalled();
    expect(mockSettleQuota).toHaveBeenCalled();
  });

  it('persists the spend hold on the row, so the sweep can link it', async () => {
    // Without this the canary row had no spendHoldId, so a stale canary hold
    // looked like a video hold with NO owner row — and the sweep settles those
    // at zero on the inference that an unlinked video hold never submitted.
    // That inference is only sound if the submit path always persists the link.
    mockSubmitToFal.mockResolvedValue('req-linked-1');
    mockGetFalStatus.mockResolvedValue('COMPLETED');

    await runVideoCanary({ sleepMs: 0, maxAttempts: 1 });

    const created = mockPrisma.videoGeneration.create.mock
      .calls[0][0] as unknown as { data: { spendHoldId?: string } };
    expect(typeof created.data.spendHoldId).toBe('string');
    expect(created.data.spendHoldId).toBeTruthy();
  });

  it('times out (fail, not a crash) when the job never reaches COMPLETED', async () => {
    mockSubmitToFal.mockResolvedValue('req-timeout-1');
    mockGetFalStatus.mockResolvedValue('IN_PROGRESS');

    const result = await runVideoCanary({ sleepMs: 0, maxAttempts: 2 });

    expect(result.status).toBe('fail');
    expect(result.code).toBe('render_failed');
    expect(mockGetFalResult).not.toHaveBeenCalled();
  });
});

describe('runVideoCanary — config + spend-cap guards', () => {
  it('returns skipped (not fail) and never submits when no canary org is configured', async () => {
    mockPrisma.organization.findFirst.mockResolvedValue(null);

    const result = await runVideoCanary();

    expect(result.status).toBe('skipped');
    expect(result.code).toBe('canary_not_configured');
    expect(mockSubmitToFal).not.toHaveBeenCalled();
    expect(mockHoldQuota).not.toHaveBeenCalled();
  });

  it('fails closed and never submits/holds quota when the resolved model estimate exceeds the hard spend cap', async () => {
    const result = await runVideoCanary({ maxSpendUsd: 0.0000001 });

    expect(result.status).toBe('fail');
    expect(result.code).toBe('spend_cap_exceeded');
    expect(mockSubmitToFal).not.toHaveBeenCalled();
    expect(mockHoldQuota).not.toHaveBeenCalled();
    expect(mockCaptureServerException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ code: 'spend_cap_exceeded' }),
      })
    );
  });
});

describe('runVideoCanary — accepted-but-unaddressable submit', () => {
  it('SETTLES rather than releases, so a possibly-billed call is not written off', async () => {
    // submitToFal is shared by the generator and this canary. When the typed
    // error was introduced only the generator handled it, so the canary caught
    // it as an ordinary failure and released the whole reservation —
    // explicitly recording a provider-accepted call as zero spend.
    const { UnaddressableSubmitError } = jest.requireActual(
      '@/lib/services/ai/video/types'
    ) as { UnaddressableSubmitError: new (m: string, s: number) => Error };

    mockSubmitToFal.mockRejectedValueOnce(
      new UnaddressableSubmitError(
        'bytedance/seedance-2.0/fast/text-to-video',
        200
      )
    );

    await runVideoCanary();

    expect(mockReleaseQuota).not.toHaveBeenCalled();
    expect(mockSettleQuota).toHaveBeenCalledTimes(1);
    const [, , heldUsd, actualUsd] = mockSettleQuota.mock
      .calls[0] as unknown as [string, string, number, number];
    // Charged at the reservation — erring high beats erasing real money.
    expect(actualUsd).toBeCloseTo(heldUsd, 4);
  });

  it('still RELEASES on an ordinary submit failure', async () => {
    mockSubmitToFal.mockRejectedValueOnce(new Error('network down'));
    await runVideoCanary();
    expect(mockReleaseQuota).toHaveBeenCalledTimes(1);
  });
});
