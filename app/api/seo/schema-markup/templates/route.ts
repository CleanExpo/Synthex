/**
 * Schema Markup Templates API
 *
 * GET /api/seo/schema-markup/templates
 * Returns predefined JSON-LD schema templates for all 14 supported types.
 * Templates include realistic example data grouped by category.
 *
 * Public endpoint (templates are non-sensitive reference data).
 *
 * ENVIRONMENT VARIABLES REQUIRED: None
 */

import { NextRequest } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { getSchemaTemplates } from '@/lib/seo/schema-markup-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/seo/schema-markup/templates
 * Get schema templates for all supported types
 */
export async function GET(request: NextRequest) {
  // Security check (public endpoint for templates)
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.PUBLIC_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  try {
    const templates = getSchemaTemplates();

    // Extract unique categories
    const categories = [...new Set(templates.map((t) => t.category))];

    return APISecurityChecker.createSecureResponse({
      success: true,
      templates,
      categories,
    });
  } catch (error) {
    logger.error('Schema Markup Templates API error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to load schema templates' },
      500
    );
  }
}
