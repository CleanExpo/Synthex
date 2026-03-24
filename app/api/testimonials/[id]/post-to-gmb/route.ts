/**
 * Post Approved Testimonial to GMB
 *
 * POST /api/testimonials/[id]/post-to-gmb
 *
 * Creates a Google Business Profile local post from an approved testimonial.
 * The post summary includes the reviewer name, rating, and their text.
 * If the testimonial has photos, the first photo is attached as media.
 *
 * Requires the organisation to have a primary GBPLocation + active
 * googlebusiness PlatformConnection.
 *
 * UNI-1637
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { prisma } from '@/lib/prisma';
import { createPost } from '@/lib/google/business-profile';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const STAR_EMOJI = ['', '★', '★★', '★★★', '★★★★', '★★★★★'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromRequestOrCookies(request);
  if (!userId) return unauthorizedResponse();

  const organizationId = await getEffectiveOrganizationId(userId);
  if (!organizationId) {
    return NextResponse.json(
      { error: 'No organisation found' },
      { status: 404 }
    );
  }

  const { id } = await params;

  // Load testimonial (org-scoped)
  const testimonial = await prisma.testimonial.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      submitterName: true,
      rating: true,
      text: true,
      photoUrls: true,
      videoUrl: true,
      status: true,
      gbpPostId: true,
    },
  });

  if (!testimonial) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (testimonial.status !== 'approved') {
    return NextResponse.json(
      { error: 'Testimonial must be approved before posting to GMB' },
      { status: 422 }
    );
  }
  if (testimonial.gbpPostId) {
    return NextResponse.json(
      { error: 'Already posted to GMB', gbpPostId: testimonial.gbpPostId },
      { status: 409 }
    );
  }

  // Load primary GBP location
  const gbpLocation = await prisma.gBPLocation.findFirst({
    where: { organizationId, isPrimary: true },
    select: { locationId: true, connectionId: true },
  });
  if (!gbpLocation) {
    return NextResponse.json(
      {
        error:
          'No primary GBP location found. Connect Google Business Profile first.',
      },
      { status: 422 }
    );
  }

  // Build the post
  const stars = STAR_EMOJI[testimonial.rating] ?? '';
  const summary = `${stars} "${testimonial.text}"\n\n— ${testimonial.submitterName}`;

  const photoUrls = Array.isArray(testimonial.photoUrls)
    ? (testimonial.photoUrls as string[])
    : [];

  const media: { mediaFormat: string; sourceUrl: string }[] = [];
  if (photoUrls[0]) {
    media.push({ mediaFormat: 'PHOTO', sourceUrl: photoUrls[0] });
  } else if (
    testimonial.videoUrl &&
    !testimonial.videoUrl.includes('youtube')
  ) {
    media.push({ mediaFormat: 'VIDEO', sourceUrl: testimonial.videoUrl });
  }

  try {
    const post = await createPost(
      gbpLocation.connectionId,
      gbpLocation.locationId,
      {
        summary,
        topicType: 'STANDARD',
        ...(media.length > 0 && { media }),
      }
    );

    const updated = await prisma.testimonial.update({
      where: { id },
      data: {
        status: 'posted_to_gmb',
        gbpPostId: post.name ?? null,
        postedToGmbAt: new Date(),
      },
      select: { id: true, status: true, gbpPostId: true, postedToGmbAt: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Failed to post testimonial to GMB', {
      error,
      testimonialId: id,
    });
    return NextResponse.json(
      {
        error:
          'Failed to post to Google Business Profile. Check GBP connection.',
      },
      { status: 502 }
    );
  }
}
