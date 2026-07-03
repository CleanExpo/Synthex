/**
 * LIVE smoke test — spends ~$0.30 on fal (Wan 2.5, 6s). Run manually:
 *   npx tsx scripts/video-smoke-test.ts
 * Requires: FAL_API_KEY, FAL_WEBHOOK_SECRET, NEXT_PUBLIC_APP_URL (publicly
 * reachable for the webhook — use the Vercel deployment URL or a tunnel),
 * DATABASE_URL, VIDEO_SMOKE_ORG_ID, VIDEO_SMOKE_USER_ID.
 *
 * Per proof-discipline: the engine is not GREEN until this passes once on the
 * real path (submit -> fal -> webhook -> Supabase storage -> media library).
 */
import { prisma } from '../lib/prisma';
import { submitGenerativeVideo } from '../lib/services/ai/video/generation-service';

async function main() {
  for (const k of [
    'FAL_API_KEY',
    'FAL_WEBHOOK_SECRET',
    'NEXT_PUBLIC_APP_URL',
    'VIDEO_SMOKE_ORG_ID',
    'VIDEO_SMOKE_USER_ID',
  ]) {
    if (!process.env[k]) throw new Error(`${k} required — refusing to run`);
  }

  const [job] = await submitGenerativeVideo({
    userId: process.env.VIDEO_SMOKE_USER_ID!,
    organizationId: process.env.VIDEO_SMOKE_ORG_ID!,
    initiatedBy: 'studio',
    prompt: 'a steaming coffee cup on a workbench, morning light',
    methodCardId: 'lifestyle-broll',
    modelTier: 'draft',
    durationSeconds: 6,
  });
  console.log(
    `submitted: row=${job.id} fal=${job.providerJobId} est=$${job.estimatedCostUsd}`
  );

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 15000));
    const row = await prisma.videoGeneration.findUnique({
      where: { id: job.id },
    });
    console.log(`  status=${row?.status}`);
    if (row?.status === 'rendered') {
      console.log(
        `PASS — videoUrl=${row.videoUrl} actual=$${row.actualCostUsd}`
      );
      process.exit(0);
    }
    if (row?.status === 'failed') {
      console.error(`FAIL — ${row.errorMessage}`);
      process.exit(1);
    }
  }
  console.error('FAIL — timed out after 10 minutes');
  process.exit(1);
}

main();
