/**
 * Connection organisation override (LinkedIn)
 *
 * @description Sets a LinkedIn connection's profileId to the NUMERIC LinkedIn
 * organisation id so publishing targets the company page, not the member's
 * personal feed. Deterministic backstop for the connect-time auto-resolution
 * (lib/social/linkedin-organization.ts) when the member admins zero or many
 * organisations, or when organizationAcls is unavailable.
 *
 * Spec: docs/specs/2026-07-09-carsi-linkedin-golive-spec.md (E2).
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - JWT_SECRET: For validating auth tokens (CRITICAL)
 *
 * FAILURE MODE: Returns structured error response; never exposes tokens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { OWNED_PAGE_ACCOUNT_TYPE } from '@/lib/social/owned-page-policy';
import { logger } from '@/lib/logger';
import { writeDefault } from '@/lib/rate-limit';

const paramsSchema = z.object({
  connectionId: z.string().min(1),
});

const bodySchema = z.object({
  organizationProfileId: z
    .string()
    .regex(
      /^\d+$/,
      'organizationProfileId must be the numeric LinkedIn organisation id'
    ),
});

interface RouteParams {
  params: Promise<{ connectionId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return writeDefault(request, async () => {
    try {
      const userId = await getUserIdFromRequestOrCookies(request);
      if (!userId) {
        return unauthorizedResponse();
      }

      const resolvedParams = await params;
      const { connectionId } = paramsSchema.parse(resolvedParams);

      const rawBody = await request.json();
      const validation = bodySchema.safeParse(rawBody);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.flatten() },
          { status: 400 }
        );
      }
      const { organizationProfileId } = validation.data;

      // Org-scope: the connection must belong to the caller AND the caller's
      // ACTIVE organisation — a brand switch never reaches another brand's
      // connection.
      const organizationId = await getEffectiveOrganizationId(userId);

      const connection = await prisma.platformConnection.findFirst({
        where: {
          id: connectionId,
          userId,
          organizationId: organizationId ?? null,
          isActive: true,
        },
        select: {
          id: true,
          platform: true,
          profileId: true,
          profileName: true,
          accountType: true,
          metadata: true,
        },
      });

      if (!connection) {
        return NextResponse.json(
          { error: 'Connection not found in the active organisation' },
          { status: 404 }
        );
      }

      if (connection.platform !== 'linkedin') {
        return NextResponse.json(
          {
            error:
              'Organisation override is only supported for LinkedIn connections',
          },
          { status: 400 }
        );
      }

      const existingMetadata =
        connection.metadata &&
        typeof connection.metadata === 'object' &&
        !Array.isArray(connection.metadata)
          ? (connection.metadata as Record<string, unknown>)
          : {};

      const updated = await prisma.platformConnection.update({
        where: { id: connection.id },
        data: {
          profileId: organizationProfileId,
          accountType: OWNED_PAGE_ACCOUNT_TYPE,
          metadata: {
            ...existingMetadata,
            linkedinOrganization: {
              resolvedOrganizationId: organizationProfileId,
              source: 'manual-override',
              previousProfileId: connection.profileId ?? null,
              overriddenAt: new Date().toISOString(),
            },
          },
          updatedAt: new Date(),
        },
        select: {
          id: true,
          platform: true,
          profileId: true,
          profileName: true,
          accountType: true,
        },
      });

      logger.info('[linkedin] connection organisation override applied', {
        connectionId: updated.id,
        organizationId,
      });

      return NextResponse.json({ success: true, connection: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.flatten() },
          { status: 400 }
        );
      }
      logger.error('Connection organisation override failed', { error });
      return NextResponse.json(
        { error: 'Failed to update connection organisation' },
        { status: 500 }
      );
    }
  });
}
