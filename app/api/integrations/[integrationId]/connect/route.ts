import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { IntegrationPlatform, IntegrationService } from '@/lib/platform/integration';
import { verifyToken } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';

const connectCredentialsSchema = z
  .object({
    accountName: z.string().optional(),
  })
  .passthrough();

async function getAuthenticatedUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;

  try {
    const decoded = verifyToken(token) as { userId?: string };
    return decoded.userId ?? null;
  } catch {
    return null;
  }
}

function parsePlatform(integrationId: string): IntegrationPlatform | null {
  const platform = integrationId as IntegrationPlatform;
  const allowed: IntegrationPlatform[] = [
    'twitter',
    'linkedin',
    'instagram',
    'facebook',
    'tiktok',
    'youtube',
    'pinterest',
    'threads',
  ];
  return allowed.includes(platform) ? platform : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { integrationId } = await params;
    const platform = parsePlatform(integrationId);
    if (!platform) {
      return NextResponse.json({ error: 'Unsupported integration' }, { status: 400 });
    }

    const body = await request.json();
    const bodyValidation = connectCredentialsSchema.safeParse(body);
    if (!bodyValidation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: bodyValidation.error.issues },
        { status: 400 }
      );
    }

    const { accountName, ...credentials } = bodyValidation.data;
    const validation = IntegrationService.validateCredentials(platform, credentials);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error, missing: validation.missing }, { status: 400 });
    }

    const integration = await IntegrationService.connectIntegration(
      userId,
      platform,
      credentials,
      accountName
    );
    return NextResponse.json({ integration });
  } catch (error) {
    logger.error('Integration connect failed', error);
    return NextResponse.json({ error: 'Failed to connect integration' }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { integrationId } = await params;
    const platform = parsePlatform(integrationId);
    if (!platform) {
      return NextResponse.json({ error: 'Unsupported integration' }, { status: 400 });
    }

    const result = await IntegrationService.getIntegrationWithCredentials(userId, platform);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Integration fetch failed', error);
    return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { integrationId } = await params;
    const platform = parsePlatform(integrationId);
    if (!platform) {
      return NextResponse.json({ error: 'Unsupported integration' }, { status: 400 });
    }

    await IntegrationService.disconnectIntegration(userId, platform);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Integration disconnect failed', error);
    return NextResponse.json({ error: 'Failed to disconnect integration' }, { status: 500 });
  }
}