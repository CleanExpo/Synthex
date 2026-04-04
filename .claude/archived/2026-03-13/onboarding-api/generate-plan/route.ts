/**
 * Onboarding — Generate Marketing Plan (UNI-1188)
 *
 * Receives the 6-question onboarding answers and generates a personalised
 * 90-day marketing plan using the premium AI model (quality > speed here).
 *
 * If the user already has an organisation, the result is saved to
 * OnboardingProgress.goalsData for persistence.
 * Otherwise the data is returned for the client to cache via sessionStorage.
 *
 * POST /api/onboarding/generate-plan
 * Body: GoalsAnswers
 * Returns: MarketingPlan
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getAuthUser } from '@/lib/supabase-server';
import { getAIProvider } from '@/lib/ai/providers';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ============================================================================
// VALIDATION
// ============================================================================

const goalsSchema = z.object({
  businessType: z.enum(['ecommerce', 'service', 'saas', 'personal', 'agency', 'nonprofit']),
  primaryGoal: z.enum(['awareness', 'leads', 'sales', 'community', 'thought', 'retention']),
  targetAudience: z.enum(['b2b', 'local', 'young', 'parents', 'consumers', 'global']),
  contentVolume: z.enum(['light', 'moderate', 'active', 'intensive']),
  budgetTier: z.enum(['bootstrap', 'starter', 'growth', 'scale']),
  biggestChallenge: z.enum(['time', 'ideas', 'engagement', 'reach', 'consistency', 'platforms']),
});

// ============================================================================
// TYPES (exported so the page component can import them)
// ============================================================================

export type GoalsAnswers = z.infer<typeof goalsSchema>;

export interface PlatformRecommendation {
  name: string;
  priority: 'primary' | 'secondary';
  reason: string;
  contentTypes: string[];
  frequency: string;
}

export interface ContentPillar {
  name: string;
  description: string;
  examples: string[];
}

export interface MarketingPlan {
  headline: string;
  summary: string;
  platforms: PlatformRecommendation[];
  contentPillars: ContentPillar[];
  thirtyDayActions: string[];
  metrics: { name: string; target: string }[];
  estimatedTimePerWeek: string;
}

// ============================================================================
// LABEL MAPS — human-readable context passed to the AI prompt
// ============================================================================

const BUSINESS_TYPE_LABELS: Record<GoalsAnswers['businessType'], string> = {
  ecommerce: 'E-commerce (selling products online)',
  service: 'Service Business (professional services)',
  saas: 'SaaS / Software product',
  personal: 'Personal Brand / Creator',
  agency: 'Agency or Consultancy',
  nonprofit: 'Non-profit / Community Organisation',
};

const GOAL_LABELS: Record<GoalsAnswers['primaryGoal'], string> = {
  awareness: 'Brand Awareness — get more people to know the brand',
  leads: 'Lead Generation — attract new potential customers',
  sales: 'Drive Sales — convert audience into paying customers',
  community: 'Build Community — grow an engaged audience',
  thought: 'Thought Leadership — establish authority in the industry',
  retention: 'Customer Retention — keep existing customers engaged',
};

const AUDIENCE_LABELS: Record<GoalsAnswers['targetAudience'], string> = {
  b2b: 'B2B professionals — business owners and decision-makers',
  local: 'Local community — people in a specific city or region',
  young: 'Young Adults 18-35 — Millennials and Gen Z',
  parents: 'Parents and Families',
  consumers: 'General consumers — broad B2C demographics',
  global: 'Global / digital-first audience',
};

const VOLUME_LABELS: Record<GoalsAnswers['contentVolume'], string> = {
  light: '1-2 posts per week (sustainable cadence)',
  moderate: '3-4 posts per week (consistent presence)',
  active: '5-7 posts per week (daily posting)',
  intensive: 'Multiple posts per day (maximum visibility)',
};

const BUDGET_LABELS: Record<GoalsAnswers['budgetTier'], string> = {
  bootstrap: 'Bootstrapped — organic growth, no paid budget',
  starter: 'Starter — $1-500/month for targeted boosts',
  growth: 'Growth — $500-2,000/month for paid promotion',
  scale: 'Scale — $2,000+/month serious marketing investment',
};

const CHALLENGE_LABELS: Record<GoalsAnswers['biggestChallenge'], string> = {
  time: 'Not enough time to create content consistently',
  ideas: 'Running out of content ideas',
  engagement: 'Low engagement — posts get little interaction',
  reach: 'Limited reach — not getting in front of new people',
  consistency: 'Inconsistent results month to month',
  platforms: 'Overwhelmed managing too many platforms at once',
};

// ============================================================================
// FALLBACK PLAN (if AI call fails)
// ============================================================================

const FALLBACK_PLAN: MarketingPlan = {
  headline: 'Your Personalised 90-Day Marketing Plan',
  summary:
    'Focus on building a consistent content presence across two to three key platforms. ' +
    'Start with your strongest channel, establish a posting rhythm, and expand from there.',
  platforms: [
    {
      name: 'LinkedIn',
      priority: 'primary',
      reason: 'Strong organic reach for professional audiences',
      contentTypes: ['Behind-the-scenes', 'Industry insights', 'Case studies'],
      frequency: '3x/week',
    },
    {
      name: 'Instagram',
      priority: 'secondary',
      reason: 'Visual storytelling to build brand awareness',
      contentTypes: ['Product showcases', 'Stories', 'Reels'],
      frequency: '2x/week',
    },
  ],
  contentPillars: [
    {
      name: 'Education',
      description: 'Teach your audience something valuable',
      examples: ['How-to guides', 'Tips and tricks', 'Industry explainers'],
    },
    {
      name: 'Social Proof',
      description: 'Show real results and customer stories',
      examples: ['Testimonials', 'Case studies', 'Before/after'],
    },
    {
      name: 'Behind the Brand',
      description: 'Humanise your business with authentic content',
      examples: ['Team spotlights', 'Process reveals', 'Day-in-the-life'],
    },
  ],
  thirtyDayActions: [
    'Optimise your top social media profile bio and link',
    'Create a content calendar for the next 4 weeks',
    'Batch-produce 2 weeks of posts in a single session',
    'Engage daily with 5-10 accounts in your target audience',
    'Publish one long-form piece to establish thought leadership',
  ],
  metrics: [
    { name: 'Follower growth rate', target: '5-10% per month' },
    { name: 'Post engagement rate', target: '3-5% average' },
    { name: 'Profile reach', target: '2× current in 30 days' },
  ],
  estimatedTimePerWeek: '3-5 hours',
};

// ============================================================================
// AI PLAN GENERATION
// ============================================================================

async function generatePlanWithAI(answers: GoalsAnswers): Promise<MarketingPlan> {
  try {
    const ai = getAIProvider();

    const prompt = `You are a senior digital marketing strategist creating a personalised 90-day social media marketing plan for an Australian business.

CLIENT PROFILE:
- Business type: ${BUSINESS_TYPE_LABELS[answers.businessType]}
- Primary goal: ${GOAL_LABELS[answers.primaryGoal]}
- Target audience: ${AUDIENCE_LABELS[answers.targetAudience]}
- Content volume: ${VOLUME_LABELS[answers.contentVolume]}
- Monthly budget: ${BUDGET_LABELS[answers.budgetTier]}
- Biggest challenge: ${CHALLENGE_LABELS[answers.biggestChallenge]}

Create a highly personalised, actionable 90-day marketing plan tailored to this specific profile.

Return a JSON object with EXACTLY these fields:
{
  "headline": "<compelling 8-12 word plan title tailored to their goal and business type>",
  "summary": "<3 sentences: what this plan achieves, why it's right for their profile, what success looks like at 90 days>",
  "platforms": [
    {
      "name": "<platform name: LinkedIn | Instagram | Facebook | TikTok | YouTube | Pinterest | X | Reddit | Threads>",
      "priority": "<primary or secondary>",
      "reason": "<one sentence why this platform suits their specific audience and goal>",
      "contentTypes": ["<3 specific content formats suited to their profile>"],
      "frequency": "<e.g. 3x/week>"
    }
  ],
  "contentPillars": [
    {
      "name": "<pillar name>",
      "description": "<one sentence what this pillar achieves for their goal>",
      "examples": ["<3 specific content ideas for their business type>"]
    }
  ],
  "thirtyDayActions": ["<5 specific, immediately actionable tasks — use exact steps, not vague advice>"],
  "metrics": [
    { "name": "<metric name>", "target": "<realistic target for 90 days given their volume and budget>" }
  ],
  "estimatedTimePerWeek": "<realistic weekly time commitment given their content volume>"
}

Rules:
- Include 2-3 platforms (1 primary, 1-2 secondary) — match to their audience and goal
- Include exactly 3 content pillars — be specific to their business type
- Exactly 5 thirty-day actions — concrete steps, not platitudes
- Exactly 3 metrics with realistic targets
- Address their biggest challenge in at least one action item
- For bootstrap budget: focus exclusively on organic tactics
- Use Australian English spelling (colour, organise, etc.)
- Return ONLY valid JSON, no markdown fences`;

    const response = await ai.complete({
      model: ai.models.premium,
      messages: [
        {
          role: 'system',
          content:
            'You are a precise marketing strategist. Return only valid JSON. Use Australian English.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content ?? '';
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr) as MarketingPlan;

    // Validate required fields are present
    if (!parsed.headline || !parsed.summary || !Array.isArray(parsed.platforms)) {
      throw new Error('AI response missing required plan fields');
    }

    return {
      headline: String(parsed.headline),
      summary: String(parsed.summary),
      platforms: Array.isArray(parsed.platforms) ? parsed.platforms.slice(0, 3) : FALLBACK_PLAN.platforms,
      contentPillars: Array.isArray(parsed.contentPillars)
        ? parsed.contentPillars.slice(0, 3)
        : FALLBACK_PLAN.contentPillars,
      thirtyDayActions: Array.isArray(parsed.thirtyDayActions)
        ? parsed.thirtyDayActions.slice(0, 5)
        : FALLBACK_PLAN.thirtyDayActions,
      metrics: Array.isArray(parsed.metrics) ? parsed.metrics.slice(0, 3) : FALLBACK_PLAN.metrics,
      estimatedTimePerWeek: String(parsed.estimatedTimePerWeek || FALLBACK_PLAN.estimatedTimePerWeek),
    };
  } catch (error) {
    logger.warn('AI marketing plan generation failed — using fallback', { error: String(error) });
    return FALLBACK_PLAN;
  }
}

// ============================================================================
// POST — Generate Marketing Plan
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const rawBody = await request.json();
    const validation = goalsSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 },
      );
    }

    const answers = validation.data;
    logger.info('Generating marketing plan', { userId: user.id, answers });

    const plan = await generatePlanWithAI(answers);

    // Persist to OnboardingProgress if user already has an organisation
    // (Non-fatal — client falls back to sessionStorage if org doesn't exist yet)
    const goalsPayload = { answers, plan };

    try {
      const org = await prisma.organization.findFirst({
        where: { users: { some: { id: user.id } } },
        select: { id: true },
      });

      if (org) {
        await prisma.onboardingProgress.upsert({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: org.id,
            },
          },
          create: {
            userId: user.id,
            organizationId: org.id,
            goalsData: goalsPayload as unknown as Prisma.InputJsonValue,
            completedStages: [],
            requiredProviders: [],
            selectedPlatforms: [],
          },
          update: {
            goalsData: goalsPayload as unknown as Prisma.InputJsonValue,
          },
        });
        logger.info('goalsData saved to OnboardingProgress', { userId: user.id });
      }
    } catch (dbErr) {
      logger.warn('OnboardingProgress goalsData save skipped', { error: String(dbErr) });
    }

    return NextResponse.json(plan);
  } catch (error) {
    logger.error('Generate plan error', { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
