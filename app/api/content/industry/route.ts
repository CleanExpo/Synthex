/**
 * POST /api/content/industry
 *
 * Generates social media copy from an industry template by:
 * 1. Looking up the requested template from the industry_templates table.
 * 2. Interpolating caller-supplied variables into the prompt.
 * 3. Calling the AI content generator.
 * 4. Scoring the result with the engagement scorer.
 *
 * Part of SYN-408 — Voice Onboarding + Industry Modes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { prisma } from '@/lib/prisma';
import { contentGenerator } from '@/lib/services/content-generator';
import { scoreEngagement } from '@/lib/content/engagement-scorer';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// ─────────────────────────────────────────────────────────────────────────────
// Validation schema
// ─────────────────────────────────────────────────────────────────────────────

const industryContentSchema = z.object({
  /** The industry key, e.g. "trades", "cafe". */
  industry: z.string().min(1).max(64),
  /** The exact scenarioName from the industry_templates table. */
  scenarioName: z.string().min(1).max(255),
  /**
   * Template variable substitutions.
   * Keys must match `{{key}}` placeholders in the promptTemplate.
   * All values must be non-empty strings.
   */
  variables: z.record(z.string(), z.string()),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replace every `{{key}}` occurrence in `template` with `vars[key]`.
 * Keys with no matching variable are replaced with an empty string.
 */
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] ?? '';
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Security check — authentication, rate limiting, CSRF
  const security = await APISecurityChecker.check(
    req,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error ?? 'Unauthorised' },
      401,
      security.context
    );
  }

  const userId = security.context.userId;
  if (!userId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'Unauthorised' },
      401,
      security.context
    );
  }

  // 2. Resolve the user's effective organisation
  const orgId = await getEffectiveOrganizationId(userId);
  if (!orgId) {
    return APISecurityChecker.createSecureResponse(
      { error: 'No organisation context found for this account.' },
      403,
      security.context
    );
  }

  // 3. Parse and validate request body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return APISecurityChecker.createSecureResponse(
      { error: 'Invalid JSON body.' },
      400,
      security.context
    );
  }

  const parsed = industryContentSchema.safeParse(rawBody);
  if (!parsed.success) {
    return APISecurityChecker.createSecureResponse(
      {
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      400,
      security.context
    );
  }

  const { industry, scenarioName, variables } = parsed.data;

  // 4. Look up the requested template
  const template = await prisma.industryTemplate.findFirst({
    where: { industry, scenarioName },
  });

  if (!template) {
    return APISecurityChecker.createSecureResponse(
      {
        error: 'Template not found',
        message: `No template exists for industry "${industry}" with scenario "${scenarioName}".`,
      },
      404,
      security.context
    );
  }

  // 5. Interpolate template variables into the prompt
  const prompt = interpolate(template.promptTemplate, variables);

  // 6. Generate content via the AI service
  let generatedContent: string;
  try {
    generatedContent = await contentGenerator.generateWithAI(prompt, 500);
  } catch (err) {
    logger.error('Industry content generation failed', {
      industry,
      scenarioName,
      orgId,
      error: err,
    });

    return APISecurityChecker.createSecureResponse(
      {
        error: 'Content generation failed. Please try again.',
      },
      500,
      security.context
    );
  }

  // 7. Score the generated content
  const score = scoreEngagement(generatedContent);

  return APISecurityChecker.createSecureResponse(
    { content: generatedContent, score },
    200,
    security.context
  );
}
