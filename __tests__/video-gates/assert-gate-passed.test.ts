/**
 * Unit tests for lib/video/gates/assert-gate-passed.ts
 *
 * Mock strategy: prisma.marketingAgencyQaReport.findFirst mocked — NO real DB
 * call. lib/observability/sentry-server mocked to prove the FAIL-path alert
 * fires exactly once and never on the PASS path.
 */

const mockFindFirst = jest.fn();
const mockCaptureServerException = jest.fn();
const mockIsSentryServerEnabled = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: { marketingAgencyQaReport: { findFirst: mockFindFirst } },
}));

jest.mock('@/lib/observability/sentry-server', () => ({
  captureServerException: mockCaptureServerException,
  isSentryServerEnabled: mockIsSentryServerEnabled,
}));

import { assertGatePassed } from '@/lib/video/gates/assert-gate-passed';
import { GateFailedError } from '@/lib/video/gates/types';

describe('assertGatePassed()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSentryServerEnabled.mockReturnValue(true);
  });

  it('resolves when the latest QA report has status "passed"', async () => {
    mockFindFirst.mockResolvedValue({ status: 'passed', blockedReasons: [] });

    await expect(assertGatePassed('asset-1', 'broadcast')).resolves.toBeUndefined();
    expect(mockCaptureServerException).not.toHaveBeenCalled();
  });

  it('throws GateFailedError when the latest QA report has status "blocked"', async () => {
    mockFindFirst.mockResolvedValue({
      status: 'blocked',
      blockedReasons: ['caption mismatch with transcript'],
    });

    await expect(assertGatePassed('asset-2', 'broadcast')).rejects.toThrow(GateFailedError);
    expect(mockCaptureServerException).toHaveBeenCalledTimes(1);
  });

  it('fails closed (throws) when NO QA report exists at all', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(assertGatePassed('asset-3', 'broadcast')).rejects.toThrow(GateFailedError);

    try {
      await assertGatePassed('asset-3', 'broadcast');
    } catch (err) {
      expect(err).toBeInstanceOf(GateFailedError);
      expect((err as InstanceType<typeof GateFailedError>).blockedReasons).toContain(
        'no_qa_report_found'
      );
    }
  });

  it('queries the latest report for the given assetRef + gate, ordered by createdAt desc', async () => {
    mockFindFirst.mockResolvedValue({ status: 'passed', blockedReasons: [] });

    await assertGatePassed('asset-4', 'brief');

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('never alerts when Sentry is disabled (DSN unset)', async () => {
    mockIsSentryServerEnabled.mockReturnValue(false);
    mockFindFirst.mockResolvedValue(null);

    await expect(assertGatePassed('asset-5', 'broadcast')).rejects.toThrow(GateFailedError);
    expect(mockCaptureServerException).not.toHaveBeenCalled();
  });
});
