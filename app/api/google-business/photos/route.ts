/**
 * GBP Photos API
 *
 * GET — List photos for a location
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  APISecurityChecker,
  DEFAULT_POLICIES,
} from '@/lib/security/api-security-checker';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import { findOAuthConnection } from '@/lib/google/google-auth';
import { listPhotos, uploadPhoto } from '@/lib/google/business-profile';
import { validateFile, uploadToStorage } from '@/lib/storage/supabase-storage';
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

    const photos = await listPhotos(connectionId, location.locationId);
    return NextResponse.json({ success: true, photos });
  } catch (error) {
    logger.error('GBP photos error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/google-business/photos
 *
 * Multipart upload: accepts an image file + locationId form fields.
 * Uploads to Supabase Storage to obtain a public URL, then posts to GBP.
 */
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
    const formData = await request.formData();
    const locationDbId = formData.get('locationId');
    const photo = formData.get('photo');
    const category = (formData.get('category') as string) || 'ADDITIONAL';

    if (!locationDbId || typeof locationDbId !== 'string') {
      return NextResponse.json(
        { error: 'Missing locationId' },
        { status: 400 }
      );
    }
    if (!(photo instanceof File)) {
      return NextResponse.json(
        { error: 'Missing photo file' },
        { status: 400 }
      );
    }

    // Validate file type/size
    const validationError = validateFile({
      size: photo.size,
      type: photo.type,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Org-scope check
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

    // Upload to Supabase Storage → get public URL
    const buffer = Buffer.from(await photo.arrayBuffer());
    const uploaded = await uploadToStorage(
      userId,
      photo.name,
      buffer,
      photo.type
    );

    // Forward to GBP Media API
    const media = await uploadPhoto(
      connectionId,
      location.locationId,
      uploaded.url,
      category
    );

    return NextResponse.json(
      { success: true, media, storageUrl: uploaded.url },
      { status: 201 }
    );
  } catch (error) {
    logger.error('GBP photo upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    );
  }
}
