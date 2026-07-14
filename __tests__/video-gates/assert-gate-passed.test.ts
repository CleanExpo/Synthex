/**
 * Unit tests for lib/video/gates/assert-gate-passed.ts
 *
 * Mock strategy: prisma.videoGateVerdict.findFirst mocked — NO real DB call.
 * logger mocked to prove the FAIL-path logs exactly once and never on PASS.
 */

const mockFindFirst = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: { videoGateVerdict: { findFirst: mockFindFirst } },
}));

jest.mock('@/lib/logger', () => ({
  logger: { error: mockLoggerError },
}));

import { assertGatePassed } from '@/lib/video/gates/assert-gate-passed';
import { GateFailedError } from '@/lib/video/gates/types';

describe('assertGatePassed()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves when the latest QA report has status "passed"', async () => {
    mockFindFirst.mockResolvedValue({ status: 'passed', blockedReasons: [] });

    await expect(
      assertGatePassed('asset-1', 'broadcast')
    ).resolves.toBeUndefined();
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('throws GateFailedError when the latest QA report has status "blocked"', async () => {
    mockFindFirst.mockResolvedValue({
      status: 'blocked',
      blockedReasons: ['caption mismatch with transcript'],
    });

    await expect(assertGatePassed('asset-2', 'broadcast')).rejects.toThrow(
      GateFailedError
    );
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
  });

  it('fails closed (throws) when NO QA report exists at all', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(assertGatePassed('asset-3', 'broadcast')).rejects.toThrow(
      GateFailedError
    );

    try {
      await assertGatePassed('asset-3', 'broadcast');
    } catch (err) {
      expect(err).toBeInstanceOf(GateFailedError);
      expect(
        (err as InstanceType<typeof GateFailedError>).blockedReasons
      ).toContain('no_qa_report_found');
    }
  });

  it('queries the latest verdict for the given ref + gate, ordered by createdAt desc', async () => {
    mockFindFirst.mockResolvedValue({ status: 'passed', blockedReasons: [] });

    await assertGatePassed('asset-4', 'brief');

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ref: 'asset-4', gate: 'brief' },
        orderBy: { createdAt: 'desc' },
      })
    );
  });
});
