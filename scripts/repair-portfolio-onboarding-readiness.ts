#!/usr/bin/env tsx
/**
 * Idempotently marks the in-house Synthex portfolio as fully onboarded for
 * founder-owner generation workflows.
 *
 * This does not publish content or enable ad spend. It fills the app's current
 * readiness sources: owner flags, organisation plan/status, BrandDNA where
 * missing, and OnboardingProgress completion rows.
 */

import { prisma } from '../lib/prisma';

const OWNER_EMAILS = (
  process.env.OWNER_EMAILS ??
  process.env.UNITE_GROUP_OWNER_EMAILS ??
  process.env.UNITE_GROUP_OWNER_EMAIL ??
  'phill.mcgurk@gmail.com,contact@unite-group.in'
)
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

const PORTFOLIO_SLUGS = [
  'unite-group',
  'disaster-recovery',
  'nrpg',
  'restoreassist',
  'carsi',
  'synthex',
  'ccw',
] as const;

type PortfolioSlug = (typeof PORTFOLIO_SLUGS)[number];

interface BrandReadinessSpec {
  businessName: string;
  vertical: string;
  industry: string;
  sourceUrl: string;
  brandVoice: {
    voiceTag: string;
    formality: number;
    boldness: number;
    tone: string;
    samplePhrases: string[];
  };
  persona: {
    description: string;
    values: string[];
    painPoints: string[];
  };
  offerings: string[];
}

const BRAND_FALLBACKS: Record<PortfolioSlug, BrandReadinessSpec> = {
  'unite-group': {
    businessName: 'Unite-Group',
    vertical: 'portfolio',
    industry: 'technology',
    sourceUrl: 'https://unite-group.com.au',
    brandVoice: {
      voiceTag: 'founder_direct',
      formality: 4,
      boldness: 4,
      tone: 'Direct, operational, evidence-led founder voice.',
      samplePhrases: [
        'Ship the production-safe path.',
        'Show the evidence before calling it done.',
      ],
    },
    persona: {
      description:
        'Portfolio command layer for Unite-Group ventures and founder-operated execution.',
      values: ['production safety', 'evidence', 'speed', 'accountability'],
      painPoints: ['fragmented operations', 'slow execution', 'weak evidence'],
    },
    offerings: [
      'Portfolio operations',
      'Production delivery oversight',
      'Founder execution systems',
    ],
  },
  'disaster-recovery': {
    businessName: 'Disaster Recovery',
    vertical: 'restoration',
    industry: 'professional-services',
    sourceUrl: 'https://disasterrecovery.com.au',
    brandVoice: {
      voiceTag: 'brand_anonymous',
      formality: 4,
      boldness: 4,
      tone: 'Authoritative, urgent, insurance-aware restoration voice.',
      samplePhrases: [
        'Rapid Response. Resilient Future.',
        'Restore Your Property. Reclaim Your Life.',
      ],
    },
    persona: {
      description:
        'Emergency restoration brand serving property owners, managers, insurers, and contractors.',
      values: ['speed', 'compliance', 'documentation', 'coverage'],
      painPoints: ['property damage', 'claim complexity', 'downtime'],
    },
    offerings: ['Water damage', 'Fire damage', 'Mould remediation'],
  },
  nrpg: {
    businessName: 'NRPG',
    vertical: 'restoration',
    industry: 'professional-services',
    sourceUrl: 'https://nrpg.com.au',
    brandVoice: {
      voiceTag: 'hybrid_phill_strategic',
      formality: 3,
      boldness: 5,
      tone: 'Peer-to-peer contractor network and standards voice.',
      samplePhrases: [
        'Built by restoration owners, for restoration owners.',
        'Standards-led contractor network.',
      ],
    },
    persona: {
      description:
        'Restoration contractor network focused on standards, pipeline, and operational trust.',
      values: ['standards', 'trade respect', 'pipeline reliability'],
      painPoints: ['inconsistent work', 'compliance burden', 'regional gaps'],
    },
    offerings: ['Contractor network', 'Standards alignment', 'Work pipeline'],
  },
  restoreassist: {
    businessName: 'RestoreAssist',
    vertical: 'saas',
    industry: 'technology',
    sourceUrl: 'https://restoreassist.app',
    brandVoice: {
      voiceTag: 'hybrid_phill_strategic_brand_routine',
      formality: 4,
      boldness: 4,
      tone: 'Clear Australian restoration SaaS voice.',
      samplePhrases: [
        'One System. Fewer Gaps. More Confidence.',
        'AI assists administration and field technicians.',
      ],
    },
    persona: {
      description:
        'Australian restoration CRM unifying office, field, scope, estimate, and reporting workflows.',
      values: ['Australian-designed', 'compliance', 'field clarity'],
      painPoints: ['double-handling', 'documentation gaps', 'tool sprawl'],
    },
    offerings: ['Inspection', 'AI analysis', 'Scoping', 'Estimating'],
  },
  carsi: {
    businessName: 'CARSI',
    vertical: 'education',
    industry: 'education',
    sourceUrl: 'https://carsi.com.au',
    brandVoice: {
      voiceTag: 'brand_anonymous',
      formality: 3,
      boldness: 4,
      tone: 'Practical IICRC training and credential maintenance voice.',
      samplePhrases: [
        'No travel. 24/7 access. Any device.',
        'Verifiable credential.',
      ],
    },
    persona: {
      description:
        'IICRC-approved online CEC training for Australian restoration technicians.',
      values: ['standards', 'access', 'cost transparency'],
      painPoints: ['travel cost', 'lost billable days', 'course scheduling'],
    },
    offerings: ['IICRC CEC courses', 'Online access', 'Credential records'],
  },
  synthex: {
    businessName: 'Synthex',
    vertical: 'saas',
    industry: 'AI Marketing Automation / SaaS',
    sourceUrl: 'https://synthex.social',
    brandVoice: {
      voiceTag: 'synthex_operator',
      formality: 4,
      boldness: 4,
      tone: 'Operational, direct, production-focused AI marketing voice.',
      samplePhrases: [
        'Draft, approve, and measure from one workspace.',
        'No publishing without approval gates.',
      ],
    },
    persona: {
      description:
        'AI marketing execution platform for evidence-led content, approvals, and multi-channel workflows.',
      values: ['control', 'security', 'measurable output', 'speed'],
      painPoints: ['slow content cycles', 'approval drift', 'manual reporting'],
    },
    offerings: ['Content generation', 'Approvals', 'SEO intelligence'],
  },
  ccw: {
    businessName: 'CCW',
    vertical: 'retail',
    industry: 'retail',
    sourceUrl: 'https://ccwonline.com.au',
    brandVoice: {
      voiceTag: 'retail_eofy_sales',
      formality: 3,
      boldness: 4,
      tone: 'Direct retail sales voice with practical EOFY urgency.',
      samplePhrases: [
        'EOFY offers available now.',
        'Built for customers who need the right product without delay.',
      ],
    },
    persona: {
      description:
        'Retail business preparing EOFY sales campaigns across social channels.',
      values: ['availability', 'value', 'speed', 'service'],
      painPoints: ['missed sales windows', 'unclear offers', 'channel lag'],
    },
    offerings: ['EOFY sales campaigns', 'Product posts', 'Social promotions'],
  },
};

const COMPLETED_STAGES = [
  'vetting',
  'api-setup',
  'platforms',
  'persona',
  'complete',
];
const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'linkedin', 'reddit'];

function buildAuditData(
  slug: PortfolioSlug,
  spec: BrandReadinessSpec,
  website: string | null
) {
  return {
    businessName: spec.businessName,
    websiteUrl: website ?? spec.sourceUrl,
    industry: spec.industry,
    suggestedTone: spec.brandVoice.tone,
    suggestedPersonaName: `${spec.businessName} AI`,
    keyTopics: spec.offerings,
    targetAudience: spec.persona.description,
    brandColours: [],
    socialProfiles: SOCIAL_PLATFORMS.map(platform => ({
      platform,
      url: '',
      verified: false,
    })),
    pomelliOnboarding: {
      status: 'completed',
      completedAt: new Date().toISOString(),
      source: 'repair-portfolio-onboarding-readiness',
    },
    readiness: {
      slug,
      contentGenerationReady: true,
      publishEnabled: false,
      adSpendEnabled: false,
    },
  };
}

async function main() {
  if (OWNER_EMAILS.length === 0) {
    throw new Error('OWNER_EMAILS must contain at least one owner email');
  }

  const owners = await prisma.user.findMany({
    where: { email: { in: OWNER_EMAILS } },
    select: { id: true, email: true },
  });
  const missingOwners = OWNER_EMAILS.filter(
    email => !owners.some(owner => owner.email.toLowerCase() === email)
  );
  if (missingOwners.length > 0) {
    throw new Error(`Missing owner accounts: ${missingOwners.join(', ')}`);
  }

  const orgs = await prisma.organization.findMany({
    where: { slug: { in: [...PORTFOLIO_SLUGS] } },
    select: {
      id: true,
      slug: true,
      name: true,
      website: true,
      industry: true,
      brandDna: { select: { id: true } },
    },
  });
  const missingOrgs = PORTFOLIO_SLUGS.filter(
    slug => !orgs.some(org => org.slug === slug)
  );
  if (missingOrgs.length > 0) {
    throw new Error(
      `Missing portfolio organisations: ${missingOrgs.join(', ')}`
    );
  }

  let brandDnaCreated = 0;
  let brandDnaPreserved = 0;
  let onboardingUpserts = 0;

  for (const org of orgs) {
    const slug = org.slug as PortfolioSlug;
    const spec = BRAND_FALLBACKS[slug];

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        plan: 'enterprise',
        status: 'active',
        billingStatus: 'active',
        maxUsers: 999_999,
        maxPosts: 999_999,
        maxCampaigns: 999_999,
      },
    });

    if (!org.brandDna) {
      await prisma.brandDNA.create({
        data: {
          organizationId: org.id,
          businessName: spec.businessName,
          vertical: spec.vertical,
          industry: org.industry ?? spec.industry,
          brandVoice: spec.brandVoice,
          persona: spec.persona,
          offerings: spec.offerings,
          socialProfiles: [],
          sourceUrl: org.website ?? spec.sourceUrl,
          lastRefreshedAt: new Date(),
        },
      });
      brandDnaCreated += 1;
    } else {
      brandDnaPreserved += 1;
    }

    for (const owner of owners) {
      await prisma.onboardingProgress.upsert({
        where: {
          userId_organizationId: {
            userId: owner.id,
            organizationId: org.id,
          },
        },
        create: {
          userId: owner.id,
          organizationId: org.id,
          currentStage: 'complete',
          completedStages: COMPLETED_STAGES,
          businessName: org.name,
          website: org.website ?? spec.sourceUrl,
          vettingApproved: true,
          vettingApprovedAt: new Date(),
          apiCredentialsAdded: true,
          apiSetupCompletedAt: new Date(),
          requiredProviders: [],
          selectedPlatforms: SOCIAL_PLATFORMS,
          platformsApprovedAt: new Date(),
          personaData: {
            name: `${spec.businessName} AI`,
            tone: spec.brandVoice.tone,
            topics: spec.offerings,
          },
          personaApprovedAt: new Date(),
          auditData: buildAuditData(slug, spec, org.website),
          postingMode: 'assisted',
          socialProfileUrls: {},
          status: 'completed',
          completedAt: new Date(),
          metadata: {
            source: 'repair-portfolio-onboarding-readiness',
            googlePomelliOnboarding: 'completed',
          },
        },
        update: {
          currentStage: 'complete',
          completedStages: COMPLETED_STAGES,
          businessName: org.name,
          website: org.website ?? spec.sourceUrl,
          vettingApproved: true,
          vettingApprovedAt: new Date(),
          apiCredentialsAdded: true,
          apiSetupCompletedAt: new Date(),
          requiredProviders: [],
          selectedPlatforms: SOCIAL_PLATFORMS,
          platformsApprovedAt: new Date(),
          personaData: {
            name: `${spec.businessName} AI`,
            tone: spec.brandVoice.tone,
            topics: spec.offerings,
          },
          personaApprovedAt: new Date(),
          auditData: buildAuditData(slug, spec, org.website),
          postingMode: 'assisted',
          socialProfileUrls: {},
          status: 'completed',
          completedAt: new Date(),
          metadata: {
            source: 'repair-portfolio-onboarding-readiness',
            googlePomelliOnboarding: 'completed',
          },
        },
      });
      onboardingUpserts += 1;
    }
  }

  await prisma.user.updateMany({
    where: { id: { in: owners.map(owner => owner.id) } },
    data: {
      isMultiBusinessOwner: true,
      onboardingComplete: true,
      onboardingStep: 4,
      businessProfileComplete: true,
      apiKeyConfigured: true,
      apiKeyValid: true,
      apiKeyLastValidated: new Date(),
      timezone: 'Australia/Brisbane',
    },
  });

  await Promise.all(
    owners.map(owner =>
      prisma.subscription.upsert({
        where: { userId: owner.id },
        create: {
          userId: owner.id,
          plan: 'scale',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date('2036-01-01T00:00:00.000Z'),
          maxSocialAccounts: -1,
          maxAiPosts: -1,
          maxPersonas: -1,
        },
        update: {
          plan: 'scale',
          status: 'active',
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date('2036-01-01T00:00:00.000Z'),
          maxSocialAccounts: -1,
          maxAiPosts: -1,
          maxPersonas: -1,
        },
      })
    )
  );

  console.log(
    JSON.stringify(
      {
        owners: owners.length,
        organizations: orgs.length,
        brandDnaCreated,
        brandDnaPreserved,
        onboardingUpserts,
        publishEnabled: false,
        adSpendEnabled: false,
      },
      null,
      2
    )
  );
}

main()
  .catch(error => {
    console.error(
      '[repair-portfolio-onboarding-readiness] failed:',
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
