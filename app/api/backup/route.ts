import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { notProvisionedResponse } from '@/lib/api/not-provisioned';

// ── Validation — optional cron body ──────────────────────────────────────────

const backupBodySchema = z
  .object({
    tables: z.array(z.string().max(100)).optional(),
    type: z.enum(['full', 'incremental']).optional(),
  })
  .strict()
  .optional();

// NOT PROVISIONED: this route backed up profiles and content_posts and recorded
// runs in system_backups. None of those three tables exist in
// prisma/schema.prisma, and the backup payload was never stored anywhere, so both
// handlers answer 501 FEATURE_NOT_PROVISIONED after auth rather than report a
// backup that did not happen.
const NOT_PROVISIONED_MESSAGE =
  'Backups are not available: the system_backups, profiles and content_posts tables are not provisioned.';

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  // Guard: reject immediately if CRON_SECRET is not configured — prevents 'Bearer undefined' bypass
  if (!process.env.CRON_SECRET) return false;
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(request: NextRequest) {
  // Verify this is a legitimate cron job request
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate optional body (reject unexpected fields)
  const rawBody = await request.json().catch(() => ({}));
  const parsed = backupBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  return notProvisionedResponse(NOT_PROVISIONED_MESSAGE);
}

export async function GET(request: NextRequest) {
  // Verify admin access - either cron secret or admin API key
  const authHeader = request.headers.get('authorization');
  const adminApiKey = request.headers.get('x-admin-api-key');

  const isCronAuth =
    !!process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAdminAuth = adminApiKey && adminApiKey === process.env.ADMIN_API_KEY;

  if (!isCronAuth && !isAdminAuth) {
    return NextResponse.json(
      { error: 'Unauthorized - Admin access required' },
      { status: 401 }
    );
  }

  return notProvisionedResponse(NOT_PROVISIONED_MESSAGE, {
    available: false,
    reason: NOT_PROVISIONED_MESSAGE,
  });
}
// Node.js runtime required for Prisma
export const runtime = 'nodejs';
