#!/usr/bin/env npx tsx
/**
 * Past-Content Slop Audit Script
 *
 * Scans existing generated content in the database for AI writing patterns.
 * Uses the existing slop-scanner and humanness-scorer — no AI calls needed.
 *
 * Usage:
 *   npx tsx scripts/audit-content-slop.ts
 *   npx tsx scripts/audit-content-slop.ts --limit=50
 *   npx tsx scripts/audit-content-slop.ts --min-density=2.0
 *   npx tsx scripts/audit-content-slop.ts --org-id=clxyz123 --output=report.json
 *
 * @task SYN-570
 */

import { PrismaClient } from '@prisma/client';
import { scanForSlop } from '../lib/voice/slop-scanner';
import * as fs from 'fs';

// ── CLI arg parsing ──────────────────────────────────────────────────────────

function parseArgs() {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--(\w[\w-]*)=(.+)$/);
    if (match) args[match[1]] = match[2];
  }
  return {
    orgId: args['org-id'] ?? null,
    limit: args['limit'] ? parseInt(args['limit'], 10) : undefined,
    minDensity: args['min-density'] ? parseFloat(args['min-density']) : 0,
    output: args['output'] ?? null,
  };
}

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditItem {
  id: string;
  type: 'post' | 'campaign';
  platform?: string;
  slopDensity: number;
  wordCount: number;
  errorCount: number;
  warningCount: number;
  grade: string;
  topPhrases: string[];
  preview: string;
}

interface AuditReport {
  scannedAt: string;
  totalScanned: number;
  flaggedCount: number;
  avgDensity: number;
  gradeBreakdown: Record<string, number>;
  items: AuditItem[];
}

// ── Grade assignment ─────────────────────────────────────────────────────────

function assignGrade(density: number): string {
  if (density < 0.5) return 'A';
  if (density < 1.5) return 'B';
  if (density < 3.0) return 'C';
  if (density < 5.0) return 'D';
  return 'F';
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { orgId, limit, minDensity, output } = parseArgs();

  const prisma = new PrismaClient();
  const items: AuditItem[] = [];
  const BATCH_SIZE = 50;

  console.info('[audit] Starting content slop audit...');
  if (orgId) console.info(`[audit] Filtering to org: ${orgId}`);
  if (limit) console.info(`[audit] Limit: ${limit}`);
  if (minDensity > 0)
    console.info(`[audit] Min density threshold: ${minDensity}`);

  try {
    // ── Scan Posts ─────────────────────────────────────────────────────────
    let postCursor: string | undefined;
    let postsScanned = 0;

    while (true) {
      const batchLimit = limit
        ? Math.min(BATCH_SIZE, limit - postsScanned)
        : BATCH_SIZE;
      if (batchLimit <= 0) break;

      const posts = await prisma.post.findMany({
        where: {
          content: { not: null },
          ...(orgId ? { organizationId: orgId } : {}),
        },
        select: {
          id: true,
          content: true,
          platform: true,
        },
        take: batchLimit,
        ...(postCursor ? { skip: 1, cursor: { id: postCursor } } : {}),
        orderBy: { createdAt: 'desc' },
      });

      if (posts.length === 0) break;

      for (const post of posts) {
        if (!post.content) continue;
        const result = scanForSlop(post.content);

        if (result.slopDensity >= minDensity) {
          items.push({
            id: post.id,
            type: 'post',
            platform: post.platform ?? undefined,
            slopDensity: result.slopDensity,
            wordCount: result.wordCount,
            errorCount: result.errorCount,
            warningCount: result.warningCount,
            grade: assignGrade(result.slopDensity),
            topPhrases: result.matches.slice(0, 3).map(m => m.phrase),
            preview: post.content.slice(0, 100).replace(/\n/g, ' '),
          });
        }
      }

      postsScanned += posts.length;
      postCursor = posts[posts.length - 1].id;
      console.info(`[audit] Scanned ${postsScanned} posts...`);
    }

    // ── Scan Campaigns ────────────────────────────────────────────────────
    let campaignCursor: string | undefined;
    let campaignsScanned = 0;
    const campaignLimit = limit ? Math.max(0, limit - postsScanned) : undefined;

    while (true) {
      const batchLimit =
        campaignLimit !== undefined
          ? Math.min(BATCH_SIZE, campaignLimit - campaignsScanned)
          : BATCH_SIZE;
      if (batchLimit <= 0) break;

      const campaigns = await prisma.campaign.findMany({
        where: {
          description: { not: null },
          ...(orgId ? { organizationId: orgId } : {}),
        },
        select: {
          id: true,
          description: true,
        },
        take: batchLimit,
        ...(campaignCursor ? { skip: 1, cursor: { id: campaignCursor } } : {}),
        orderBy: { createdAt: 'desc' },
      });

      if (campaigns.length === 0) break;

      for (const campaign of campaigns) {
        if (!campaign.description) continue;
        const result = scanForSlop(campaign.description);

        if (result.slopDensity >= minDensity) {
          items.push({
            id: campaign.id,
            type: 'campaign',
            slopDensity: result.slopDensity,
            wordCount: result.wordCount,
            errorCount: result.errorCount,
            warningCount: result.warningCount,
            grade: assignGrade(result.slopDensity),
            topPhrases: result.matches.slice(0, 3).map(m => m.phrase),
            preview: campaign.description.slice(0, 100).replace(/\n/g, ' '),
          });
        }
      }

      campaignsScanned += campaigns.length;
      campaignCursor = campaigns[campaigns.length - 1].id;
      console.info(`[audit] Scanned ${campaignsScanned} campaigns...`);
    }

    // ── Build report ──────────────────────────────────────────────────────
    const totalScanned = postsScanned + campaignsScanned;
    const gradeBreakdown: Record<string, number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      F: 0,
    };
    for (const item of items) {
      gradeBreakdown[item.grade] = (gradeBreakdown[item.grade] ?? 0) + 1;
    }

    const avgDensity =
      items.length > 0
        ? Math.round(
            (items.reduce((sum, i) => sum + i.slopDensity, 0) / items.length) *
              100
          ) / 100
        : 0;

    // Sort by worst offenders first
    items.sort((a, b) => b.slopDensity - a.slopDensity);

    const report: AuditReport = {
      scannedAt: new Date().toISOString(),
      totalScanned,
      flaggedCount: items.length,
      avgDensity,
      gradeBreakdown,
      items,
    };

    // ── Output ────────────────────────────────────────────────────────────
    if (output) {
      fs.writeFileSync(output, JSON.stringify(report, null, 2));
      console.info(`[audit] Report written to ${output}`);
    } else {
      console.info('\n=== CONTENT SLOP AUDIT REPORT ===');
      console.info(`Scanned:  ${totalScanned} items`);
      console.info(
        `Flagged:  ${items.length} items (density >= ${minDensity})`
      );
      console.info(`Avg slop: ${avgDensity} per 100 words`);
      console.info(
        `Grades:   A=${gradeBreakdown.A} B=${gradeBreakdown.B} C=${gradeBreakdown.C} D=${gradeBreakdown.D} F=${gradeBreakdown.F}`
      );

      if (items.length > 0) {
        console.info('\n--- TOP 10 WORST OFFENDERS ---');
        for (const item of items.slice(0, 10)) {
          console.info(
            `  [${item.grade}] ${item.type}:${item.id} | density=${item.slopDensity} | ` +
              `phrases: ${item.topPhrases.join(', ')} | "${item.preview}..."`
          );
        }
      }
    }

    console.info('[audit] Done.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('[audit] Fatal error:', err);
  process.exit(1);
});
