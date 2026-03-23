import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';
import { writeDefault } from '@/lib/rate-limit';
import { previewObsidianImport } from '@/lib/content/obsidian-importer';

const BodySchema = z.union([
  z.object({ markdown: z.string().min(1).max(100_000) }),
  z.object({ notePath: z.string().min(1) }),
]);

export async function POST(req: NextRequest) {
  return writeDefault(req, async () => {
    const userId = await getUserIdFromRequestOrCookies(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    // Handle multipart (file upload) OR JSON (paste/vault path)
    let body: unknown;
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }
      const text = await (file as File).text();
      body = { markdown: text };
    } else {
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    try {
      const preview = await previewObsidianImport(parsed.data);
      return NextResponse.json(preview);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse note';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
