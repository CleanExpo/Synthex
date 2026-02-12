/**
 * White-Label Configuration API
 *
 * @description Manage white-label theming and customization settings
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - JWT_SECRET: Token verification (CRITICAL)
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 *
 * FAILURE MODE: Returns appropriate error responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for white-label configuration
const whiteLabelConfigSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl: z.string().url().optional(),
  faviconUrl: z.string().url().optional(),
  companyName: z.string().max(100).optional(),
  customCss: z.string().max(10000).optional(),
  customDomain: z.string().max(253).optional(),
  footerLinks: z.array(z.object({
    label: z.string().max(50),
    url: z.string().url(),
  })).optional(),
});

/**
 * GET /api/white-label/config
 * Get current organization's white-label configuration
 */
export async function GET(request: NextRequest) {
  // Security check - requires authentication
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error || 'Authentication required' },
      security.error?.includes('Rate limit') ? 429 : 401,
      security.context
    );
  }

  try {
    const userId = security.context.userId;

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return APISecurityChecker.createSecureResponse(
        { theme: {}, message: 'No organization found' },
        200,
        security.context
      );
    }

    // Get organization settings
    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { settings: true, customDomain: true },
    });

    const settings = (organization?.settings as Record<string, unknown>) || {};
    const whiteLabelConfig = {
      primaryColor: settings.primaryColor || '#6366f1',
      secondaryColor: settings.secondaryColor || '#06b6d4',
      logoUrl: settings.logoUrl || null,
      faviconUrl: settings.faviconUrl || null,
      companyName: settings.companyName || null,
      customCss: settings.customCss || null,
      customDomain: organization?.customDomain || null,
      footerLinks: settings.footerLinks || [],
    };

    return APISecurityChecker.createSecureResponse(
      { theme: whiteLabelConfig },
      200,
      security.context
    );
  } catch (error) {
    console.error('Error fetching white-label config:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to fetch white-label configuration' },
      500,
      security.context
    );
  }
}

/**
 * PUT /api/white-label/config
 * Update organization's white-label configuration (Admin only)
 */
export async function PUT(request: NextRequest) {
  // Security check - requires admin authentication
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.ADMIN_ONLY
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error || 'Admin access required' },
      security.error?.includes('Rate limit') ? 429 :
      security.error?.includes('permission') ? 403 : 401,
      security.context
    );
  }

  try {
    const userId = security.context.userId;
    const body = await request.json();

    // Validate input
    const validation = whiteLabelConfigSchema.safeParse(body);
    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation failed', details: validation.error.errors },
        400,
        security.context
      );
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'No organization found' },
        400,
        security.context
      );
    }

    // Get current settings
    const organization = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { settings: true },
    });

    const currentSettings = (organization?.settings as Record<string, unknown>) || {};
    const configUpdate = validation.data;

    // Separate customDomain for direct field update
    const { customDomain, ...settingsUpdate } = configUpdate;

    // Merge new settings
    const updatedSettings = {
      ...currentSettings,
      ...settingsUpdate,
    };

    // Update organization
    await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        settings: updatedSettings,
        ...(customDomain !== undefined && { customDomain }),
        updatedAt: new Date(),
      },
    });

    return APISecurityChecker.createSecureResponse(
      { success: true, theme: { ...settingsUpdate, customDomain } },
      200,
      security.context
    );
  } catch (error) {
    console.error('Error updating white-label config:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to update white-label configuration' },
      500,
      security.context
    );
  }
}

// Node.js runtime required for Prisma
export const runtime = 'nodejs';

