/**
 * GBP Posts API
 *
 * GET  — List Google Posts for a location
 * POST — Create a new Google Post
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { findOAuthConnection } from '@/lib/google/google-auth';
import { listPosts, createPost } from '@/lib/google/business-profile';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const locationDbId = searchParams.get('locationId');

  if (!locationDbId) {
    return NextResponse.json(
      { error: 'Missing locationId parameter' },
      { status: 400 }
    );
  }

  try {
    const location = await prisma.gBPLocation.findFirst({
      where: { id: locationDbId, organizationId },
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    const connectionId = await findOAuthConnection(
      organizationId,
      'googlebusiness'
    );
    if (!connectionId) {
      return NextResponse.json(
        { error: 'No GBP connection found' },
        { status: 400 }
      );
    }

    const result = await listPosts(connectionId, location.locationId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error('GBP list posts error:', error);
    return NextResponse.json(
      { error: 'Failed to list posts' },
      { status: 500 }
    );
  }
}

const CreatePostSchema = z.object({
  locationId: z.string().min(1),
  summary: z.string().min(1).max(1500),
  topicType: z
    .enum(['STANDARD', 'EVENT', 'OFFER'])
    .optional()
    .default('STANDARD'),
  callToAction: z
    .object({
      actionType: z.string(),
      url: z.string().url().optional(),
    })
    .optional(),
  // EVENT fields
  eventTitle: z.string().max(58).optional(),
  eventStartDate: z.string().optional(), // ISO date string
  eventEndDate: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );
  if (!security.allowed) {
    return NextResponse.json({ error: security.error }, { status: 401 });
  }

  const userId = security.context.userId!;
  const organizationId = await getEffectiveOrganizationId(userId);

  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const parsed = CreatePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const location = await prisma.gBPLocation.findFirst({
      where: { id: parsed.data.locationId, organizationId },
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    const connectionId = await findOAuthConnection(
      organizationId,
      'googlebusiness'
    );
    if (!connectionId) {
      return NextResponse.json(
        { error: 'No GBP connection found' },
        { status: 400 }
      );
    }

    const {
      summary,
      topicType,
      callToAction,
      eventTitle,
      eventStartDate,
      eventEndDate,
    } = parsed.data;

    // Build event object for EVENT type
    let event:
      | {
          title: string;
          schedule: {
            startDate: { year: number; month: number; day: number };
            endDate: { year: number; month: number; day: number };
          };
        }
      | undefined;
    if (topicType === 'EVENT' && eventTitle && eventStartDate && eventEndDate) {
      const parseDate = (iso: string) => {
        const d = new Date(iso);
        return {
          year: d.getUTCFullYear(),
          month: d.getUTCMonth() + 1,
          day: d.getUTCDate(),
        };
      };
      event = {
        title: eventTitle,
        schedule: {
          startDate: parseDate(eventStartDate),
          endDate: parseDate(eventEndDate),
        },
      };
    }

    const post = await createPost(connectionId, location.locationId, {
      summary,
      callToAction,
      topicType: topicType || 'STANDARD',
      ...(event ? { event } : {}),
    });

    return NextResponse.json({ success: true, post }, { status: 201 });
  } catch (error) {
    logger.error('GBP create post error:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}
