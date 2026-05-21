// Repairs the founder account's portfolio access in the canonical Synthex
// multi-business model. This is intentionally idempotent so it can be rerun
// after restores, seed drift, or production data repairs.

import { prisma } from '../lib/prisma';

const OWNER_EMAILS = (
  process.env.UNITE_GROUP_OWNER_EMAILS ??
  process.env.UNITE_GROUP_OWNER_EMAIL ??
  'phill.mcgurk@gmail.com,contact@unite-group.in'
)
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

const PRIMARY_ORG_SLUG = 'unite-group';

const PORTFOLIO_SLUGS = [
  'unite-group',
  'disaster-recovery',
  'nrpg',
  'restoreassist',
  'carsi',
  'synthex',
  'ccw',
];

const INTERNAL_MONTHLY_RATE = 249;
const INTERNAL_PLAN = 'enterprise';
const SUBSCRIPTION_PLAN = 'scale';
const MAX_LIMIT = 999_999;

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

async function main() {
  if (OWNER_EMAILS.length === 0) {
    throw new Error('No owner emails configured');
  }

  const owners = await prisma.user.findMany({
    where: { email: { in: OWNER_EMAILS } },
    select: {
      id: true,
      email: true,
      preferences: true,
    },
  });

  const missingOwners = OWNER_EMAILS.filter(
    email => !owners.some(owner => owner.email.toLowerCase() === email)
  );
  if (missingOwners.length > 0) {
    throw new Error(`Owner account not found for ${missingOwners.join(', ')}`);
  }

  const orgs = await prisma.organization.findMany({
    where: { slug: { in: PORTFOLIO_SLUGS } },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  const missingSlugs = PORTFOLIO_SLUGS.filter(
    slug => !orgs.some(org => org.slug === slug)
  );
  if (missingSlugs.length > 0) {
    throw new Error(`Missing required organizations: ${missingSlugs.join(', ')}`);
  }

  const primaryOrg = orgs.find(org => org.slug === PRIMARY_ORG_SLUG);
  if (!primaryOrg) {
    throw new Error(`Primary organization ${PRIMARY_ORG_SLUG} not found`);
  }

  for (const owner of owners) {
    const preferences = {
      ...asObject(owner.preferences),
      role: 'superadmin',
      status: 'active',
      internalPortfolioOwner: true,
    };

    await prisma.user.update({
      where: { id: owner.id },
      data: {
        organizationId: primaryOrg.id,
        activeOrganizationId: primaryOrg.id,
        isMultiBusinessOwner: true,
        onboardingComplete: true,
        onboardingStep: 4,
        businessProfileComplete: true,
        apiKeyConfigured: true,
        apiKeyValid: true,
        apiKeyLastValidated: new Date(),
        timezone: 'Australia/Brisbane',
        preferences,
      },
    });

    await prisma.subscription.upsert({
      where: { userId: owner.id },
      create: {
        userId: owner.id,
        plan: SUBSCRIPTION_PLAN,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date('2036-01-01T00:00:00.000Z'),
        maxSocialAccounts: -1,
        maxAiPosts: -1,
        maxPersonas: -1,
      },
      update: {
        plan: SUBSCRIPTION_PLAN,
        status: 'active',
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date('2036-01-01T00:00:00.000Z'),
        maxSocialAccounts: -1,
        maxAiPosts: -1,
        maxPersonas: -1,
      },
    });
  }

  for (const org of orgs) {
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        plan: INTERNAL_PLAN,
        status: 'active',
        billingStatus: 'active',
        maxUsers: MAX_LIMIT,
        maxPosts: MAX_LIMIT,
        maxCampaigns: MAX_LIMIT,
      },
    });

    for (const owner of owners) {
      await prisma.businessOwnership.upsert({
        where: {
          ownerId_organizationId: {
            ownerId: owner.id,
            organizationId: org.id,
          },
        },
        create: {
          ownerId: owner.id,
          organizationId: org.id,
          displayName: org.name,
          isActive: true,
          billingStatus: 'active',
          monthlyRate: INTERNAL_MONTHLY_RATE,
        },
        update: {
          displayName: org.name,
          isActive: true,
          billingStatus: 'active',
          monthlyRate: INTERNAL_MONTHLY_RATE,
        },
      });

      await prisma.teamMember.upsert({
        where: {
          team_member_user_org: {
            userId: owner.id,
            organizationId: org.id,
          },
        },
        create: {
          userId: owner.id,
          organizationId: org.id,
          role: 'owner',
          acceptedAt: new Date(),
          lastActiveAt: new Date(),
        },
        update: {
          role: 'owner',
          acceptedAt: new Date(),
          lastActiveAt: new Date(),
        },
      });
    }
  }

  const verification = await prisma.user.findMany({
    where: { id: { in: owners.map(owner => owner.id) } },
    select: {
      email: true,
      id: true,
      isMultiBusinessOwner: true,
      onboardingComplete: true,
      apiKeyConfigured: true,
      activeOrganizationId: true,
      organization: { select: { slug: true, plan: true, status: true } },
      ownedBusinesses: {
        where: { isActive: true },
        select: {
          billingStatus: true,
          organization: { select: { slug: true, plan: true, status: true } },
        },
        orderBy: { organization: { slug: 'asc' } },
      },
      teamMemberships: {
        select: {
          role: true,
          organization: { select: { slug: true } },
        },
        orderBy: { organization: { slug: 'asc' } },
      },
    },
    orderBy: { email: 'asc' },
  });

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: { in: owners.map(owner => owner.id) } },
    select: { userId: true, plan: true, status: true },
  });

  console.log(
    JSON.stringify(
      verification.map(owner => {
        const businessSlugs = owner.ownedBusinesses.map(
          item => item.organization.slug
        );
        const teamSlugs = owner.teamMemberships.map(
          item => item.organization.slug
        );
        const activeOrgSlug =
          orgs.find(org => org.id === owner.activeOrganizationId)?.slug ?? null;
        return {
          owner: owner.email,
          primaryOrg: owner.organization,
          activeOrg: activeOrgSlug,
          subscription: (() => {
            const subscription = subscriptions.find(
              item => item.userId === owner.id
            );
            if (!subscription) {
              return null;
            }
            return {
              plan: subscription.plan,
              status: subscription.status,
            };
          })(),
          isMultiBusinessOwner: owner.isMultiBusinessOwner,
          onboardingComplete: owner.onboardingComplete,
          apiKeyConfigured: owner.apiKeyConfigured,
          activeBusinesses: {
            count: businessSlugs.length,
            slugs: businessSlugs,
          },
          teamOwnerMemberships: {
            count: teamSlugs.length,
            slugs: teamSlugs,
          },
        };
      }),
      null,
      2
    )
  );
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
