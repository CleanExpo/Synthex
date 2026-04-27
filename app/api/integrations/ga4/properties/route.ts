/**
 * GET /api/integrations/ga4/properties
 *
 * Lists the GA4 properties the authenticated user can access, using the
 * OAuth token stored in PlatformConnection (platform='googleanalytics') for
 * the caller's active organization. Calls the Google Analytics Admin API.
 *
 * SYN-793
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { decryptField } from '@/lib/security/field-encryption';
import { logger } from '@/lib/logger';

const GA4_PLATFORM = 'googleanalytics';
const ADMIN_API_URL =
  'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200';

interface AdminPropertySummary {
  property: string; // "properties/123456789"
  displayName?: string;
  parent?: string;
}

interface AdminAccountSummary {
  account?: string;
  displayName?: string;
  propertySummaries?: AdminPropertySummary[];
}

interface AdminResponse {
  accountSummaries?: AdminAccountSummary[];
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await getEffectiveOrganizationId(userId);

    const connection = await prisma.platformConnection.findFirst({
      where: {
        userId,
        platform: GA4_PLATFORM,
        organizationId: organizationId ?? null,
        isActive: true,
      },
      select: { accessToken: true, expiresAt: true },
    });

    if (!connection) {
      return NextResponse.json(
        {
          error: 'Google Analytics not connected',
          message:
            'Connect Google Analytics first via POST /api/integrations/ga4/connect.',
        },
        { status: 403 }
      );
    }

    const accessToken = decryptField(connection.accessToken);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Stored GA4 access token could not be decrypted' },
        { status: 500 }
      );
    }

    const upstream = await fetch(ADMIN_API_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      logger.error('GA4 Admin API error', {
        status: upstream.status,
        body: errorText.substring(0, 200),
      });
      return NextResponse.json(
        {
          error: 'Failed to fetch GA4 properties',
          status: upstream.status,
        },
        { status: upstream.status === 401 ? 401 : 502 }
      );
    }

    const data = (await upstream.json()) as AdminResponse;

    const properties = (data.accountSummaries ?? []).flatMap(account =>
      (account.propertySummaries ?? []).map(p => ({
        propertyId: p.property?.replace(/^properties\//, '') ?? '',
        displayName: p.displayName ?? null,
        accountName: account.displayName ?? null,
      }))
    );

    return NextResponse.json({
      properties,
      organizationId: organizationId ?? null,
    });
  } catch (error) {
    logger.error('GA4 properties list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GA4 properties' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
