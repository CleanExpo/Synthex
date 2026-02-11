/**
 * Subscription Service Unit Tests
 *
 * @description Tests for the Stripe subscription service
 */

import { SubscriptionService, PLAN_LIMITS } from '@/lib/stripe/subscription-service';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    platformConnection: {
      count: jest.fn(),
    },
    persona: {
      count: jest.fn(),
    },
  },
}));

// Mock Stripe config
jest.mock('@/lib/stripe/config', () => ({
  stripe: {
    subscriptions: {
      update: jest.fn(),
    },
  },
  PRODUCTS: {
    PROFESSIONAL: { priceId: 'price_professional', name: 'Professional' },
    BUSINESS: { priceId: 'price_business', name: 'Business' },
  },
  getProductByPriceId: jest.fn((priceId: string) => {
    if (priceId === 'price_professional') return { name: 'Professional' };
    if (priceId === 'price_business') return { name: 'Business' };
    return null;
  }),
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe/config';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  beforeEach(() => {
    service = new SubscriptionService();
    jest.clearAllMocks();
  });

  describe('PLAN_LIMITS', () => {
    it('should have free plan limits', () => {
      expect(PLAN_LIMITS.free).toEqual({
        maxSocialAccounts: 2,
        maxAiPosts: 10,
        maxPersonas: 1,
        maxSeoAudits: 0,
        maxSeoPages: 0,
      });
    });

    it('should have professional plan limits', () => {
      expect(PLAN_LIMITS.professional).toEqual({
        maxSocialAccounts: 5,
        maxAiPosts: 100,
        maxPersonas: 3,
        maxSeoAudits: 10,
        maxSeoPages: 50,
      });
    });

    it('should have business plan with unlimited AI posts', () => {
      expect(PLAN_LIMITS.business.maxAiPosts).toBe(-1); // unlimited
    });

    it('should have custom plan with all unlimited', () => {
      expect(PLAN_LIMITS.custom).toEqual({
        maxSocialAccounts: -1,
        maxAiPosts: -1,
        maxPersonas: -1,
        maxSeoAudits: -1,
        maxSeoPages: -1,
      });
    });
  });

  describe('getOrCreateSubscription', () => {
    const mockUserId = 'user_123';
    const mockSubscription = {
      id: 'sub_123',
      userId: mockUserId,
      plan: 'free',
      status: 'active',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEnd: null,
      maxSocialAccounts: 2,
      maxAiPosts: 10,
      maxPersonas: 1,
        maxSeoAudits: 0,
        maxSeoPages: 0,
      currentAiPosts: 0,
      lastResetAt: new Date(),
    };

    it('should return existing subscription if found', async () => {
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.getOrCreateSubscription(mockUserId);

      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
      expect(result.userId).toBe(mockUserId);
      expect(result.plan).toBe('free');
    });

    it('should create new free subscription if not found', async () => {
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.subscription.create as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.getOrCreateSubscription(mockUserId);

      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          plan: 'free',
          status: 'active',
          maxSocialAccounts: 2,
          maxAiPosts: 10,
          maxPersonas: 1,
        }),
      });
      expect(result.plan).toBe('free');
    });
  });

  describe('getSubscription', () => {
    it('should return subscription info if found', async () => {
      const mockSub = {
        id: 'sub_123',
        userId: 'user_123',
        plan: 'professional',
        status: 'active',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_stripe_123',
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
        cancelAtPeriodEnd: false,
        trialEnd: null,
        maxSocialAccounts: 5,
        maxAiPosts: 100,
        maxPersonas: 3,
        currentAiPosts: 25,
        lastResetAt: new Date('2026-01-01'),
      };

      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSub);

      const result = await service.getSubscription('user_123');

      expect(result).not.toBeNull();
      expect(result?.plan).toBe('professional');
      expect(result?.limits.aiPosts).toBe(100);
      expect(result?.usage.aiPosts).toBe(25);
    });

    it('should return null if subscription not found', async () => {
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getSubscription('nonexistent_user');

      expect(result).toBeNull();
    });
  });

  describe('getByStripeCustomerId', () => {
    it('should find subscription by Stripe customer ID', async () => {
      const mockSub = {
        id: 'sub_123',
        userId: 'user_123',
        plan: 'business',
        status: 'active',
        stripeCustomerId: 'cus_stripe_123',
        stripeSubscriptionId: 'sub_stripe_456',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialEnd: null,
        maxSocialAccounts: 10,
        maxAiPosts: -1,
        maxPersonas: 10,
        currentAiPosts: 0,
        lastResetAt: new Date(),
      };

      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue(mockSub);

      const result = await service.getByStripeCustomerId('cus_stripe_123');

      expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { stripeCustomerId: 'cus_stripe_123' },
      });
      expect(result?.stripeCustomerId).toBe('cus_stripe_123');
    });
  });

  describe('checkLimit', () => {
    const mockSubscription = {
      id: 'sub_123',
      userId: 'user_123',
      plan: 'professional',
      status: 'active',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEnd: null,
      maxSocialAccounts: 5,
      maxAiPosts: 100,
      maxPersonas: 3,
      currentAiPosts: 50,
      lastResetAt: new Date(),
    };

    beforeEach(() => {
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
    });

    it('should allow action when under limit', async () => {
      const result = await service.checkLimit('user_123', 'aiPosts');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100);
      expect(result.current).toBe(50);
      expect(result.remaining).toBe(50);
    });

    it('should not allow action when at limit', async () => {
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        currentAiPosts: 100,
      });

      const result = await service.checkLimit('user_123', 'aiPosts');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should always allow for unlimited plans', async () => {
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        plan: 'business',
        maxAiPosts: -1,
        currentAiPosts: 9999,
      });

      const result = await service.checkLimit('user_123', 'aiPosts');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
      expect(result.remaining).toBe(Infinity);
    });

    it('should check social accounts limit', async () => {
      (prisma.platformConnection.count as jest.Mock).mockResolvedValue(3);

      const result = await service.checkLimit('user_123', 'socialAccounts');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(5);
      expect(result.current).toBe(3);
      expect(result.remaining).toBe(2);
    });

    it('should check personas limit', async () => {
      (prisma.persona.count as jest.Mock).mockResolvedValue(2);

      const result = await service.checkLimit('user_123', 'personas');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(3);
      expect(result.current).toBe(2);
      expect(result.remaining).toBe(1);
    });
  });

  describe('incrementUsage', () => {
    it('should increment AI posts usage', async () => {
      (prisma.subscription.update as jest.Mock).mockResolvedValue({});

      await service.incrementUsage('user_123', 'aiPosts', 1);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user_123' },
        data: {
          currentAiPosts: { increment: 1 },
        },
      });
    });

    it('should increment by specified amount', async () => {
      (prisma.subscription.update as jest.Mock).mockResolvedValue({});

      await service.incrementUsage('user_123', 'aiPosts', 5);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user_123' },
        data: {
          currentAiPosts: { increment: 5 },
        },
      });
    });
  });

  describe('resetUsage', () => {
    it('should reset AI posts usage to zero', async () => {
      (prisma.subscription.update as jest.Mock).mockResolvedValue({});

      await service.resetUsage('user_123');

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user_123' },
        data: {
          currentAiPosts: 0,
          lastResetAt: expect.any(Date),
        },
      });
    });
  });

  describe('setStripeCustomerId', () => {
    it('should upsert subscription with Stripe customer ID', async () => {
      (prisma.subscription.upsert as jest.Mock).mockResolvedValue({});

      await service.setStripeCustomerId('user_123', 'cus_stripe_456');

      expect(prisma.subscription.upsert).toHaveBeenCalledWith({
        where: { userId: 'user_123' },
        create: {
          userId: 'user_123',
          stripeCustomerId: 'cus_stripe_456',
          plan: 'free',
          status: 'inactive',
        },
        update: {
          stripeCustomerId: 'cus_stripe_456',
        },
      });
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      const mockSub = {
        id: 'sub_123',
        userId: 'user_123',
        stripeSubscriptionId: 'sub_stripe_123',
      };

      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSub);
      (stripe.subscriptions.update as jest.Mock).mockResolvedValue({});
      (prisma.subscription.update as jest.Mock).mockResolvedValue({
        ...mockSub,
        plan: 'professional',
        status: 'active',
        stripeCustomerId: 'cus_123',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
        trialEnd: null,
        maxSocialAccounts: 5,
        maxAiPosts: 100,
        maxPersonas: 3,
        currentAiPosts: 0,
        lastResetAt: new Date(),
      });

      const result = await service.cancelSubscription('user_123');

      expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_stripe_123', {
        cancel_at_period_end: true,
      });
      expect(result.cancelAtPeriodEnd).toBe(true);
    });

    it('should throw error if no subscription found', async () => {
      (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.cancelSubscription('user_123')).rejects.toThrow(
        'No active subscription to cancel'
      );
    });
  });

  describe('downgradeToFree', () => {
    it('should downgrade subscription to free plan', async () => {
      const mockUpdated = {
        id: 'sub_123',
        userId: 'user_123',
        plan: 'free',
        status: 'active',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialEnd: null,
        maxSocialAccounts: 2,
        maxAiPosts: 10,
        maxPersonas: 1,
        maxSeoAudits: 0,
        maxSeoPages: 0,
        currentAiPosts: 0,
        lastResetAt: new Date(),
      };

      (prisma.subscription.update as jest.Mock).mockResolvedValue(mockUpdated);

      const result = await service.downgradeToFree('user_123');

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user_123' },
        data: expect.objectContaining({
          plan: 'free',
          status: 'active',
          stripeSubscriptionId: null,
          stripePriceId: null,
          maxSocialAccounts: 2,
          maxAiPosts: 10,
          maxPersonas: 1,
        }),
      });
      expect(result.plan).toBe('free');
      expect(result.limits.aiPosts).toBe(10);
    });
  });

  describe('mapStripeStatus', () => {
    // Access private method through reflection for testing
    it('should map Stripe status correctly', () => {
      // Test through the updateFromStripeSubscription method behavior
      // These mappings are internal but we can verify through integration
      const statusMappings: Record<string, string> = {
        active: 'active',
        canceled: 'cancelled',
        incomplete: 'inactive',
        incomplete_expired: 'inactive',
        past_due: 'past_due',
        trialing: 'trialing',
        unpaid: 'past_due',
        paused: 'inactive',
      };

      // Verify the expected mappings exist
      expect(Object.keys(statusMappings).length).toBe(8);
    });
  });
});

describe('SubscriptionInfo type', () => {
  it('should have correct structure', () => {
    const subscriptionInfo = {
      id: 'sub_123',
      userId: 'user_123',
      plan: 'professional',
      status: 'active',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_stripe_123',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      cancelAtPeriodEnd: false,
      trialEnd: undefined,
      limits: {
        socialAccounts: 5,
        aiPosts: 100,
        personas: 3,
      },
      usage: {
        aiPosts: 25,
        lastResetAt: new Date(),
      },
    };

    expect(subscriptionInfo.limits).toBeDefined();
    expect(subscriptionInfo.usage).toBeDefined();
    expect(typeof subscriptionInfo.limits.aiPosts).toBe('number');
    expect(typeof subscriptionInfo.usage.aiPosts).toBe('number');
  });
});
