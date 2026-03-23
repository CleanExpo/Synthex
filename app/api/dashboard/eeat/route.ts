/**
 * app/api/dashboard/eeat/route.ts
 *
 * Dashboard: E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) scores.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequestOrCookies } from '@/lib/auth/jwt-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function statusFromScore(score: number): 'good' | 'fair' | 'poor' {
  if (score >= 70) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prisma } = await import('@/lib/prisma');

    let eeatRow: {
      overallScore?: number;
      experienceScore?: number;
      expertiseScore?: number;
      authorityScore?: number;
      trustScore?: number;
      updatedAt?: Date | string;
    } | null = null;

    try {
      eeatRow =
        (await (
          prisma as unknown as Record<string, unknown> & {
            eEATScore?: {
              findFirst: (args: unknown) => Promise<typeof eeatRow>;
            };
            eeatScore?: {
              findFirst: (args: unknown) => Promise<typeof eeatRow>;
            };
          }
        ).eEATScore?.findFirst({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
        })) ??
        (await (
          prisma as unknown as Record<string, unknown> & {
            eeatScore?: {
              findFirst: (args: unknown) => Promise<typeof eeatRow>;
            };
          }
        ).eeatScore?.findFirst({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
        })) ??
        null;
    } catch {
      // Model may not exist yet
    }

    const exp = eeatRow?.experienceScore ?? 0;
    const expertise = eeatRow?.expertiseScore ?? 0;
    const authority = eeatRow?.authorityScore ?? 0;
    const trust = eeatRow?.trustScore ?? 0;
    const overall =
      eeatRow?.overallScore ??
      Math.round((exp + expertise + authority + trust) / 4);

    const data = {
      overallScore: overall,
      grade: gradeFromScore(overall),
      experience: {
        label: 'Experience',
        score: exp,
        maxScore: 100,
        status: statusFromScore(exp),
        tips:
          exp < 70
            ? [
                'Add first-hand experience examples to content',
                'Include personal anecdotes and case studies',
              ]
            : [],
      },
      expertise: {
        label: 'Expertise',
        score: expertise,
        maxScore: 100,
        status: statusFromScore(expertise),
        tips:
          expertise < 70
            ? [
                'Demonstrate deep subject matter knowledge',
                'Cite credible external sources',
              ]
            : [],
      },
      authoritativeness: {
        label: 'Authoritativeness',
        score: authority,
        maxScore: 100,
        status: statusFromScore(authority),
        tips:
          authority < 70
            ? [
                'Build more backlinks from authoritative sites',
                'Get featured in industry publications',
              ]
            : [],
      },
      trustworthiness: {
        label: 'Trustworthiness',
        score: trust,
        maxScore: 100,
        status: statusFromScore(trust),
        tips:
          trust < 70
            ? [
                'Add author bios and credentials',
                'Include transparent disclosures and privacy policy',
              ]
            : [],
      },
      recommendations: [
        ...(overall < 70
          ? [
              {
                priority: 'high' as const,
                text: 'Complete your author profile and credentials',
              },
            ]
          : []),
        ...(authority < 60
          ? [
              {
                priority: 'medium' as const,
                text: 'Pursue guest posting opportunities to build authority',
              },
            ]
          : []),
      ],
    };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[dashboard/eeat]', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
