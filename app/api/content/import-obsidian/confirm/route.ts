import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { writeDefault } from '@/lib/rate-limit';
import { confirmObsidianImport } from '@/lib/content/obsidian-importer';

const ConfirmSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(100_000),
  platform: z.string().max(100),
  tone: z.string().max(100).optional(),
  topic: z.string().max(200).optional(),
  hashtags: z.array(z.string()).max(30),
  frontMatter: z.record(z.unknown()),
});

export async function POST(req: NextRequest) {
  return writeDefault(req, async () => {
    const userId = await getUserIdFromRequestOrCookies(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = ConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    try {
      const result = await confirmObsidianImport(
        parsed.data,
        userId,
        null // organizationId — future: could accept orgId from body for multi-tenant
      );
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      console.error('[import-obsidian/confirm]', err);
      return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 });
    }
  });
}
