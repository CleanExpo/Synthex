/**
 * GET /api/brand/dna
 *
 * Returns the Business DNA (Obsidian vault markdown) for the authenticated
 * user's organisation, plus the structured BrandDNA record from Prisma.
 *
 * Also parses the markdown note from the Obsidian vault to surface the
 * structured fields (industry, tone, targetAudience, usp, keywords, etc.)
 * that the AI content pipeline consumes.
 *
 * @task SYN-451 — Business DNA profile viewer
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/jwt-utils';
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope';
import { prisma } from '@/lib/prisma';
import { getClientDNA } from '@/lib/obsidian/business-dna-vault';

export const runtime = 'nodejs';

/**
 * Parse the Obsidian business-dna.md markdown into structured fields.
 * The markdown format produced by syncBusinessDNA() uses bold-label lines:
 *   **Industry:** value
 *   **Tone of Voice:** value
 *   etc.
 */
function parseDNAMarkdown(markdown: string): {
  name: string | null;
  industry: string | null;
  tone: string | null;
  targetAudience: string | null;
  usp: string | null;
  keywords: string[];
  colours: string[];
  typography: string | null;
} {
  const result = {
    name: null as string | null,
    industry: null as string | null,
    tone: null as string | null,
    targetAudience: null as string | null,
    usp: null as string | null,
    keywords: [] as string[],
    colours: [] as string[],
    typography: null as string | null,
  };

  if (!markdown) return result;

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();

    // Title line: # Business DNA — Org Name
    const titleMatch = trimmed.match(/^#\s+Business DNA\s+[—-]\s+(.+)/);
    if (titleMatch) {
      result.name = titleMatch[1].trim();
      continue;
    }

    const field = (label: string) => {
      const pattern = new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.+)`);
      const m = trimmed.match(pattern);
      return m ? m[1].trim() : null;
    };

    result.industry ??= field('Industry');
    result.tone ??= field('Tone of Voice');
    result.targetAudience ??= field('Target Audience');
    result.usp ??= field('USP');
    result.typography ??= field('Typography');

    const kw = field('Keywords');
    if (kw && result.keywords.length === 0) {
      result.keywords = kw
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);
    }

    const col = field('Brand Colours');
    if (col && result.colours.length === 0) {
      result.colours = col
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);
    }
  }

  return result;
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequestOrCookies(req);
  if (!userId) return unauthorizedResponse();

  const orgId = await getEffectiveOrganizationId(userId);
  if (!orgId) return forbiddenResponse('No organisation context found');

  // Fetch both the Obsidian vault note (raw markdown) and the Prisma BrandDNA record
  const [vaultMarkdown, brandDna] = await Promise.all([
    getClientDNA(orgId).catch(() => ''),
    prisma.brandDNA
      .findUnique({ where: { organizationId: orgId } })
      .catch(() => null),
  ]);

  const vaultParsed = parseDNAMarkdown(vaultMarkdown);

  return NextResponse.json({
    vault: {
      raw: vaultMarkdown || null,
      parsed: vaultParsed,
    },
    brandDna: brandDna ?? null,
  });
}
