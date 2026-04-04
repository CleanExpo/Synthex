// SYN-507: ISR revalidation webhook
// Called by YouTube publish pipeline (SYN-499) when a new video is published.
// Revalidates the client's Authority Hub page to pick up new VideoObject schema.

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    // Simple shared-secret auth
    const secret = req.headers.get('x-webhook-secret');
    if (secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { clientSlug } = body;

    if (!clientSlug || typeof clientSlug !== 'string') {
      return NextResponse.json(
        { error: 'clientSlug required' },
        { status: 400 }
      );
    }

    revalidatePath(`/clients/${clientSlug}`);

    logger.info('[webhook] authority_hub_revalidated', {
      client_slug: clientSlug,
    });

    return NextResponse.json({ revalidated: true, slug: clientSlug });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
