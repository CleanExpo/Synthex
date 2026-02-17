/**
 * Sitemap Analysis API
 *
 * Fetches and validates XML sitemaps: structure, URL count, lastmod, duplicates.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';

const RequestSchema = z.object({
  url: z.string().url('Invalid sitemap URL'),
});

async function analyzeSitemap(url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SynthexBot/1.0 (+https://synthex.social)' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch sitemap: ${res.status}`);
  }

  const xml = await res.text();
  const issues: Array<{ severity: 'error' | 'warning' | 'info'; message: string }> = [];

  // Check basic XML structure
  const isXml = xml.trim().startsWith('<?xml') || xml.trim().startsWith('<urlset') || xml.trim().startsWith('<sitemapindex');
  if (!isXml) {
    issues.push({ severity: 'error', message: 'Response does not appear to be valid XML' });
    return {
      url,
      timestamp: new Date().toISOString(),
      valid: false,
      urlCount: 0,
      issues,
      urls: [],
      stats: { withLastmod: 0, withChangefreq: 0, withPriority: 0, duplicates: 0, staleUrls: 0 },
    };
  }

  // Parse URL entries using regex (server-side XML parsing without DOMParser)
  const urlBlocks = xml.match(/<url>([\s\S]*?)<\/url>/gi) || [];
  const urls: Array<{ loc: string; lastmod: string | null; changefreq: string | null; priority: string | null }> = [];
  const seenLocs = new Set<string>();
  let duplicates = 0;
  let withLastmod = 0;
  let withChangefreq = 0;
  let withPriority = 0;
  let staleUrls = 0;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>([\s\S]*?)<\/loc>/i);
    const lastmodMatch = block.match(/<lastmod>([\s\S]*?)<\/lastmod>/i);
    const changefreqMatch = block.match(/<changefreq>([\s\S]*?)<\/changefreq>/i);
    const priorityMatch = block.match(/<priority>([\s\S]*?)<\/priority>/i);

    const loc = locMatch?.[1]?.trim() || '';
    const lastmod = lastmodMatch?.[1]?.trim() || null;
    const changefreq = changefreqMatch?.[1]?.trim() || null;
    const priority = priorityMatch?.[1]?.trim() || null;

    if (!loc) continue;

    if (seenLocs.has(loc)) {
      duplicates++;
    } else {
      seenLocs.add(loc);
    }

    if (lastmod) {
      withLastmod++;
      const lastmodDate = new Date(lastmod);
      if (lastmodDate < sixMonthsAgo) {
        staleUrls++;
      }
    }
    if (changefreq) withChangefreq++;
    if (priority) withPriority++;

    urls.push({ loc, lastmod, changefreq, priority });
  }

  // Check for common issues
  if (urls.length === 0) {
    issues.push({ severity: 'error', message: 'No URLs found in sitemap' });
  }

  if (urls.length > 50000) {
    issues.push({ severity: 'error', message: `Sitemap exceeds 50,000 URL limit (${urls.length} found)` });
  }

  if (duplicates > 0) {
    issues.push({ severity: 'warning', message: `${duplicates} duplicate URL(s) found` });
  }

  if (withLastmod < urls.length) {
    issues.push({ severity: 'warning', message: `${urls.length - withLastmod} URL(s) missing <lastmod>` });
  }

  if (staleUrls > 0) {
    issues.push({ severity: 'info', message: `${staleUrls} URL(s) have lastmod older than 6 months` });
  }

  if (withChangefreq < urls.length) {
    issues.push({ severity: 'info', message: `${urls.length - withChangefreq} URL(s) missing <changefreq>` });
  }

  if (withPriority < urls.length) {
    issues.push({ severity: 'info', message: `${urls.length - withPriority} URL(s) missing <priority>` });
  }

  // Check if it's a sitemap index
  const isSitemapIndex = xml.includes('<sitemapindex');
  if (isSitemapIndex) {
    issues.push({ severity: 'info', message: 'This is a sitemap index file — individual sitemaps should be analyzed separately' });
  }

  return {
    url,
    timestamp: new Date().toISOString(),
    valid: issues.filter(i => i.severity === 'error').length === 0,
    urlCount: urls.length,
    issues,
    urls,
    stats: {
      withLastmod,
      withChangefreq,
      withPriority,
      duplicates,
      staleUrls,
    },
  };
}

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE);
  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      security.error === 'Authentication required' ? 401 : 403
    );
  }

  try {
    const body = await request.json();
    const validation = RequestSchema.safeParse(body);
    if (!validation.success) {
      return APISecurityChecker.createSecureResponse(
        { success: false, error: 'Invalid request', details: validation.error.errors },
        400
      );
    }

    const analysis = await analyzeSitemap(validation.data.url);
    return APISecurityChecker.createSecureResponse({ success: true, analysis });
  } catch (error) {
    console.error('Sitemap analysis error:', error);
    return APISecurityChecker.createSecureResponse(
      { error: 'Failed to analyze sitemap' },
      500
    );
  }
}
