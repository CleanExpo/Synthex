/**
 * Unit tests — AffiliateLinkService.recordConversion idempotency
 *
 * Money-integrity: replaying the same orderId must NOT multiply revenue.
 * The conversionCount / totalRevenue increment (the money write) must run at
 * most once per (linkId, orderId). This test mocks the Prisma client and the
 * interactive transaction so we can assert exactly which writes fire.
 */

import { AffiliateLinkService } from '@/lib/affiliates/affiliate-link-service';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => {
  const tx = {
    affiliateLinkClick: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    affiliateLink: {
      update: jest.fn(),
    },
  };
  return {
    prisma: {
      __tx: tx,
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    },
  };
});

// Access the inner tx mock the $transaction callback receives.
const mockedPrisma = prisma as unknown as {
  __tx: {
    affiliateLinkClick: {
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    affiliateLink: { update: jest.Mock };
  };
  $transaction: jest.Mock;
};
const tx = mockedPrisma.__tx;

describe('AffiliateLinkService.recordConversion — idempotency', () => {
  beforeEach(() => {
    // NOTE: jest.worktree.cjs sets resetMocks: true, which strips ALL mock
    // implementations (including the factory's $transaction) before each test.
    // Re-establish the interactive-transaction shim that invokes the callback
    // with our tx double, and clear any queued once-values on the tx mocks.
    mockedPrisma.$transaction.mockImplementation(
      (cb: (t: typeof tx) => unknown) => cb(tx)
    );
    tx.affiliateLinkClick.findFirst.mockReset();
    tx.affiliateLinkClick.update.mockReset();
    tx.affiliateLinkClick.create.mockReset();
    tx.affiliateLink.update.mockReset();
  });

  it('applies the revenue increment exactly once for a first-seen orderId', async () => {
    // No prior converted click for this orderId; an unconverted click exists.
    tx.affiliateLinkClick.findFirst
      .mockResolvedValueOnce(null) // replay guard: not yet recorded
      .mockResolvedValueOnce({ id: 'click_1' }); // unconverted target click
    tx.affiliateLinkClick.update.mockResolvedValue({});
    tx.affiliateLink.update.mockResolvedValue({});

    await AffiliateLinkService.recordConversion('link_1', {
      orderId: 'order_1',
      revenue: 25,
    });

    expect(tx.affiliateLinkClick.update).toHaveBeenCalledTimes(1);
    expect(tx.affiliateLink.update).toHaveBeenCalledTimes(1);
    expect(tx.affiliateLink.update).toHaveBeenCalledWith({
      where: { id: 'link_1' },
      data: {
        conversionCount: { increment: 1 },
        totalRevenue: { increment: 25 },
      },
    });
  });

  it('REPLAY: does NOT increment revenue when the orderId is already recorded', async () => {
    // Replay guard finds an already-converted click with this orderId.
    tx.affiliateLinkClick.findFirst.mockResolvedValueOnce({ id: 'click_prior' });

    await AffiliateLinkService.recordConversion('link_1', {
      orderId: 'order_1',
      revenue: 25,
    });

    // No money write, no click mutation — pure no-op.
    expect(tx.affiliateLink.update).not.toHaveBeenCalled();
    expect(tx.affiliateLinkClick.update).not.toHaveBeenCalled();
    expect(tx.affiliateLinkClick.create).not.toHaveBeenCalled();
  });

  it('creates a standalone converted click when no unconverted click exists', async () => {
    tx.affiliateLinkClick.findFirst
      .mockResolvedValueOnce(null) // replay guard
      .mockResolvedValueOnce(null); // no unconverted click to attribute to
    tx.affiliateLinkClick.create.mockResolvedValue({});
    tx.affiliateLink.update.mockResolvedValue({});

    await AffiliateLinkService.recordConversion('link_1', {
      orderId: 'order_2',
      revenue: 10,
    });

    expect(tx.affiliateLinkClick.create).toHaveBeenCalledTimes(1);
    expect(tx.affiliateLink.update).toHaveBeenCalledTimes(1);
  });

  it('two replays of the same orderId increment revenue only once in total', async () => {
    // First call: first-seen → increments.
    tx.affiliateLinkClick.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'click_1' });
    tx.affiliateLinkClick.update.mockResolvedValue({});
    tx.affiliateLink.update.mockResolvedValue({});

    await AffiliateLinkService.recordConversion('link_1', {
      orderId: 'order_dup',
      revenue: 100,
    });

    // Second call (replay): guard finds the now-converted click → no-op.
    tx.affiliateLinkClick.findFirst.mockResolvedValueOnce({ id: 'click_1' });

    await AffiliateLinkService.recordConversion('link_1', {
      orderId: 'order_dup',
      revenue: 100,
    });

    expect(tx.affiliateLink.update).toHaveBeenCalledTimes(1);
  });
});
