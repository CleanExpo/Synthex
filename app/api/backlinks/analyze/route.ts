/**
 * Backlink Analysis API — Run Analysis (Phase 95)
 *
 * POST /api/backlinks/analyze — Discover link opportunities for a topic/domain
 *
 * Calls backlink-analyzer orchestrator which uses:
 * - Google Custom Search API (100 queries/day free)
 * - OpenPageRank API (100 requests/day free)
 *
 * @module app/api/backlinks/analyze/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';
import { analyzeOpportunities } from '@/lib/backlinks/backlink-analyzer';

// ─── Validation ─────────────────────────────────────────────────────────────

const AnalyzeSchema = z.object({
  orgId:              z.string().min(1),
  topic:              z.string().min(1).max(200),
  userDomain:         z.string().min(1).max(253),
  competitorDomains:  z.array(z.string().max(253)).max(5).optional().default([]),
});

// ─── POST /api/backlinks/analyze ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = AnalyzeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { orgId, topic, userDomain, competitorDomains } = parsed.data;

    // Run analysis (may take 5–15 seconds depending on API response times)
    const result = await analyzeOpportunities({
      orgId,
      userId,
      topic,
      userDomain,
      competitorDomains,
    });

    // Persist BacklinkAnalysis record
    const analysis = await prisma.backlinkAnalysis.create({
      data: {
        userId,
        orgId,
        sourceUrl:      userDomain,
        analysisResult: result as object,
        linksFound:     result.linksFound,
        highValueCount: result.highValueCount,
      },
    });

    // Bulk-create BacklinkProspect records (skip if no results)
    let prospects: object[] = [];
    if (result.prospects.length > 0) {
      // Upsert — avoid duplicate targetUrl per user
      const existing = await prisma.backlinkProspect.findMany({
        where:  { userId },
        select: { targetUrl: true },
      });
      const existingUrls = new Set(existing.map(e => e.targetUrl));

      const toCreate = result.prospects.filter(p => !existingUrls.has(p.url));

      if (toCreate.length > 0) {
        await prisma.backlinkProspect.createMany({
          data: toCreate.map(p => ({
            userId,
            orgId,
            targetUrl:       p.url,
            targetDomain:    p.domain,
            domainAuthority: p.domainAuthority,
            pageRank:        p.pageRank,
            opportunityType: p.opportunityType,
          })),
          skipDuplicates: true,
        });
      }

      // Return all user prospects (including pre-existing)
      prospects = await prisma.backlinkProspect.findMany({
        where:   { userId, orgId },
        orderBy: [{ domainAuthority: 'desc' }, { discoveredAt: 'desc' }],
        take:    50,
      });
    }

    return NextResponse.json({ analysis, prospects, summary: result }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/backlinks/analyze]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
