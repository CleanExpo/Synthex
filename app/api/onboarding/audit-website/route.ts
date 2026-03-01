/**
 * Onboarding — Audit Website Route (UNI-1187)
 *
 * Performs a comprehensive website audit combining:
 *   1. Cheerio HTML scraping  — SEO signals (title, meta, headings, OG, images, links)
 *   2. Google PageSpeed Insights — mobile + desktop performance scores (no API key needed)
 *   3. AI analysis             — content gaps, keyword opportunities, quick wins
 *
 * If the user already has an organisation, the result is saved to OnboardingProgress.auditData.
 * Otherwise the data is returned for the client to persist via sessionStorage.
 *
 * POST /api/onboarding/audit-website
 * Body: { url: string }
 * Returns: WebsiteAuditResult
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { load } from 'cheerio';
import { Prisma } from '@prisma/client';
import { getAuthUser } from '@/lib/supabase-server';
import { getAIProvider } from '@/lib/ai/providers';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ============================================================================
// VALIDATION
// ============================================================================

const auditSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
});

// ============================================================================
// TYPES (exported so the page component can import them)
// ============================================================================

export interface SEOAuditSignals {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h1Count: number;
  h2Count: number;
  h3Count: number;
  canonical: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  imagesWithoutAlt: number;
  totalImages: number;
  outboundLinks: number;
  wordCount: number;
}

export interface PageSpeedResult {
  score: number;  // 0-100
  fcp: number;    // First Contentful Paint (ms)
  lcp: number;    // Largest Contentful Paint (ms)
  cls: number;    // Cumulative Layout Shift
  tbt: number;    // Total Blocking Time (ms)
  si: number;     // Speed Index (ms)
}

export interface AIAuditInsights {
  contentGaps: string[];
  keywordOpportunities: string[];
  competitorTypes: string[];
  quickWins: string[];
  overallHealth: 'excellent' | 'good' | 'needs-work' | 'poor';
  summary: string;
}

export interface WebsiteAuditResult {
  url: string;
  seo: SEOAuditSignals;
  performance: {
    mobile: PageSpeedResult | null;
    desktop: PageSpeedResult | null;
  };
  insights: AIAuditInsights;
  auditedAt: string;
}

// ============================================================================
// SEO SCRAPING VIA CHEERIO
// ============================================================================

async function scrapeForSEO(url: string): Promise<SEOAuditSignals | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SynthexAuditBot/1.0 (+https://synthex.social/bot)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      logger.warn('Audit scrape non-200', { url, status: response.status });
      return null;
    }

    const html = await response.text();
    const $ = load(html);

    // Strip scripts + styles before measuring word count
    $('script, style, noscript').remove();
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

    // Images missing alt attribute
    const allImages = $('img').toArray();
    const imagesWithoutAlt = allImages.filter(
      (img) => !$(img).attr('alt') || $(img).attr('alt') === '',
    ).length;

    // Outbound links (absolute URLs pointing to a different hostname)
    let parsedHostname = '';
    try { parsedHostname = new URL(url).hostname; } catch { /* ignore */ }

    const outboundLinks = $('a[href]')
      .toArray()
      .filter((a) => {
        const href = $(a).attr('href') ?? '';
        if (!href.startsWith('http')) return false;
        try { return new URL(href).hostname !== parsedHostname; } catch { return false; }
      }).length;

    return {
      title: $('title').first().text().trim() || null,
      metaDescription:
        $('meta[name="description"]').attr('content') ||
        $('meta[property="og:description"]').attr('content') ||
        null,
      h1: $('h1').first().text().trim() || null,
      h1Count: $('h1').length,
      h2Count: $('h2').length,
      h3Count: $('h3').length,
      canonical: $('link[rel="canonical"]').attr('href') || null,
      ogTitle: $('meta[property="og:title"]').attr('content') || null,
      ogDescription: $('meta[property="og:description"]').attr('content') || null,
      ogImage: $('meta[property="og:image"]').attr('content') || null,
      imagesWithoutAlt,
      totalImages: allImages.length,
      outboundLinks,
      wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    };
  } catch (error) {
    logger.warn('Cheerio scrape failed', { url, error: String(error) });
    return null;
  }
}

// ============================================================================
// GOOGLE PAGESPEED INSIGHTS  (no API key required for public URLs)
// ============================================================================

async function fetchPageSpeed(
  url: string,
  strategy: 'mobile' | 'desktop',
): Promise<PageSpeedResult | null> {
  try {
    const apiUrl =
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
      `?url=${encodeURIComponent(url)}&strategy=${strategy}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = (await response.json()) as {
      lighthouseResult?: {
        categories?: { performance?: { score?: number } };
        audits?: {
          'first-contentful-paint'?: { numericValue?: number };
          'largest-contentful-paint'?: { numericValue?: number };
          'cumulative-layout-shift'?: { numericValue?: number };
          'total-blocking-time'?: { numericValue?: number };
          'speed-index'?: { numericValue?: number };
        };
      };
    };

    const categories = data.lighthouseResult?.categories;
    const audits = data.lighthouseResult?.audits;
    if (!categories?.performance) return null;

    return {
      score: Math.round((categories.performance.score ?? 0) * 100),
      fcp: Math.round(audits?.['first-contentful-paint']?.numericValue ?? 0),
      lcp: Math.round(audits?.['largest-contentful-paint']?.numericValue ?? 0),
      cls: Number((audits?.['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3)),
      tbt: Math.round(audits?.['total-blocking-time']?.numericValue ?? 0),
      si: Math.round(audits?.['speed-index']?.numericValue ?? 0),
    };
  } catch (error) {
    logger.warn('PageSpeed fetch failed', { url, strategy, error: String(error) });
    return null;
  }
}

// ============================================================================
// AI ANALYSIS — content gaps, keyword opportunities, quick wins
// ============================================================================

const FALLBACK_INSIGHTS: AIAuditInsights = {
  contentGaps: ['Audit data unavailable — add content to analyse gaps'],
  keywordOpportunities: [],
  competitorTypes: [],
  quickWins: ['Add a meta description', 'Optimise images with alt text', 'Improve page load speed'],
  overallHealth: 'needs-work',
  summary: 'Website audit complete. Manual review recommended for full marketing readiness assessment.',
};

async function analyseWithAI(
  url: string,
  seo: SEOAuditSignals,
  mobile: PageSpeedResult | null,
  desktop: PageSpeedResult | null,
): Promise<AIAuditInsights> {
  try {
    const ai = getAIProvider();

    const prompt = `You are an expert digital marketing consultant specialising in SEO and content strategy.
Analyse this website audit data and return actionable marketing insights.

URL: ${url}

SEO Signals:
- Title: ${seo.title ?? 'MISSING'}
- Meta Description: ${seo.metaDescription ?? 'MISSING'}
- H1: ${seo.h1 ?? 'MISSING'} (${seo.h1Count} H1 tags found)
- Headings: ${seo.h2Count} H2s, ${seo.h3Count} H3s
- Canonical URL: ${seo.canonical ?? 'Not set'}
- Open Graph: title=${seo.ogTitle ? 'Set' : 'Missing'}, desc=${seo.ogDescription ? 'Set' : 'Missing'}, image=${seo.ogImage ? 'Set' : 'Missing'}
- Images: ${seo.totalImages} total, ${seo.imagesWithoutAlt} missing alt text
- Word count: ~${seo.wordCount}
- Outbound links: ${seo.outboundLinks}

Performance:
- Mobile score: ${mobile?.score ?? 'Unavailable'}/100 | LCP: ${mobile ? `${(mobile.lcp / 1000).toFixed(1)}s` : 'N/A'}
- Desktop score: ${desktop?.score ?? 'Unavailable'}/100 | LCP: ${desktop ? `${(desktop.lcp / 1000).toFixed(1)}s` : 'N/A'}

Return a JSON object with EXACTLY these fields:
{
  "contentGaps": ["<3 specific content gaps this site is missing — be concrete>"],
  "keywordOpportunities": ["<3 specific keyword opportunities with likely search intent>"],
  "competitorTypes": ["<3 types of competing businesses this site likely faces>"],
  "quickWins": ["<3 specific, immediately actionable improvements>"],
  "overallHealth": "<one of: excellent | good | needs-work | poor>",
  "summary": "<2-3 sentence plain English summary of this site's marketing readiness>"
}

Scoring guide for overallHealth:
- excellent: title + meta + H1 all set, OG complete, perf score 85+
- good: title + meta + H1 all set, minor issues, perf score 60+
- needs-work: 1-2 critical SEO elements missing OR perf score below 60
- poor: multiple critical missing elements OR perf score below 40

Rules:
- Be specific and actionable — no generic advice
- Return ONLY valid JSON, no markdown code fences`;

    const response = await ai.complete({
      model: ai.models.fast,
      messages: [
        { role: 'system', content: 'You are a precise digital marketing analyst. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content ?? '';
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr) as AIAuditInsights;

    const VALID_HEALTH = ['excellent', 'good', 'needs-work', 'poor'] as const;
    return {
      contentGaps: Array.isArray(parsed.contentGaps) ? parsed.contentGaps.slice(0, 3) : FALLBACK_INSIGHTS.contentGaps,
      keywordOpportunities: Array.isArray(parsed.keywordOpportunities) ? parsed.keywordOpportunities.slice(0, 3) : [],
      competitorTypes: Array.isArray(parsed.competitorTypes) ? parsed.competitorTypes.slice(0, 3) : [],
      quickWins: Array.isArray(parsed.quickWins) ? parsed.quickWins.slice(0, 3) : FALLBACK_INSIGHTS.quickWins,
      overallHealth: VALID_HEALTH.includes(parsed.overallHealth as typeof VALID_HEALTH[number])
        ? parsed.overallHealth
        : 'needs-work',
      summary: String(parsed.summary ?? ''),
    };
  } catch (error) {
    logger.warn('AI audit analysis failed', { error: String(error) });
    return FALLBACK_INSIGHTS;
  }
}

// ============================================================================
// POST — Run Website Audit
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const rawBody = await request.json();
    const validation = auditSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 },
      );
    }

    const rawUrl = validation.data.url;
    const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

    logger.info('Starting website audit', { userId: user.id, url });

    // Run HTML scraping + both PageSpeed requests in parallel
    const [seoSignals, mobileSpeed, desktopSpeed] = await Promise.all([
      scrapeForSEO(url),
      fetchPageSpeed(url, 'mobile'),
      fetchPageSpeed(url, 'desktop'),
    ]);

    const seo: SEOAuditSignals = seoSignals ?? {
      title: null,
      metaDescription: null,
      h1: null,
      h1Count: 0,
      h2Count: 0,
      h3Count: 0,
      canonical: null,
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      imagesWithoutAlt: 0,
      totalImages: 0,
      outboundLinks: 0,
      wordCount: 0,
    };

    // AI insights (uses fast model — results in ~2-3s)
    const insights = await analyseWithAI(url, seo, mobileSpeed, desktopSpeed);

    const result: WebsiteAuditResult = {
      url,
      seo,
      performance: { mobile: mobileSpeed, desktop: desktopSpeed },
      insights,
      auditedAt: new Date().toISOString(),
    };

    // Persist to OnboardingProgress if user already has an organisation
    // (Non-fatal — client falls back to sessionStorage if this doesn't run yet)
    try {
      const org = await prisma.organization.findFirst({
        where: { users: { some: { id: user.id } } },
        select: { id: true },
      });
      if (org) {
        await prisma.onboardingProgress.upsert({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: org.id,
            },
          },
          create: {
            userId: user.id,
            organizationId: org.id,
            auditData: result as unknown as Prisma.InputJsonValue,
            completedStages: [],
            requiredProviders: [],
            selectedPlatforms: [],
          },
          update: {
            auditData: result as unknown as Prisma.InputJsonValue,
          },
        });
        logger.info('auditData saved to OnboardingProgress', { userId: user.id });
      }
    } catch (dbErr) {
      logger.warn('OnboardingProgress auditData save skipped', { error: String(dbErr) });
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Website audit error', { error: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
